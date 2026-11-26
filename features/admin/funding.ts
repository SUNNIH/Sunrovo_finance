import "server-only";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { getAssetPrecision } from "@/lib/money/format";
import { postLedgerEntries } from "@/lib/ledger/postLedgerEntries";
import { getOrCreatePlatformLedgerAccount } from "@/lib/ledger/platform-accounts";
import { ensureAssetBalanceAndLedgerAccount } from "@/features/crypto/wallet-helpers";
import { withIdempotentFallback } from "@/lib/ledger/idempotency";
import { AuthError } from "@/features/authentication/errors";

export const ADMIN_FUNDING_POOL_NAME = (assetSymbol: string) =>
  `Platform Treasury Funding Pool (${assetSymbol})`;

export type FundingTarget = {
  userId: string;
  accountId?: string;
  walletId?: string;
  assetSymbol: string;
};

export type AdminFundingInput = {
  targetUserId: string;
  targetAccountId?: string;
  targetWalletId?: string;
  assetSymbol: string;
  amount: string;
  reason: string;
};

/**
 * Admin-only operation to fund a user's account or wallet from the platform
 * treasury funding pool. This is the only way to add funds to user accounts
 * after zero-balance provisioning.
 *
 * Flow:
 * 1. Authorization check (caller must be ADMIN)
 * 2. Ownership validation (target belongs to userId)
 * 3. Asset compatibility check
 * 4. Idempotent balanced ledger posting
 * 5. Cache update via increment
 * 6. Transaction history for user
 * 7. Audit log for admin action
 */
export async function fundUserAccount(
  adminUserId: string,
  input: AdminFundingInput,
  idempotencyKey: string
) {
  // Validate admin authorization
  const admin = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { role: true },
  });

  if (!admin || admin.role !== "ADMIN") {
    throw new AuthError(
      "FORBIDDEN",
      "Administrator access is required to fund user accounts.",
      403
    );
  }

  // Validate amount
  const amount = new Decimal(input.amount);
  if (amount.lte(0)) {
    throw new AuthError("VALIDATION_ERROR", "Amount must be greater than zero.", 422);
  }

  // Exactly one target must be specified
  if (
    (input.targetAccountId && input.targetWalletId) ||
    (!input.targetAccountId && !input.targetWalletId)
  ) {
    throw new AuthError(
      "VALIDATION_ERROR",
      "Specify exactly one target: accountId or walletId.",
      422
    );
  }

  // Namespace idempotency key with admin ID to prevent cross-admin collisions
  const namespacedKey = `admin-funding:${adminUserId}:${idempotencyKey}`;

  // Check for existing funding transaction with this idempotency key
  const existing = await prisma.transaction.findFirst({
    where: {
      referenceType: "AdminFunding",
      referenceId: namespacedKey,
    },
  });

  if (existing) {
    return {
      transactionId: existing.id,
      ledgerGroupId: existing.ledgerGroupId,
      alreadyProcessed: true,
    };
  }

  if (input.targetAccountId) {
    return fundBankAccount(adminUserId, input, namespacedKey);
  } else {
    return fundCryptoWallet(adminUserId, input, namespacedKey);
  }
}

async function fundBankAccount(
  adminUserId: string,
  input: AdminFundingInput,
  idempotencyKey: string
) {
  const account = await prisma.bankAccount.findUnique({
    where: { id: input.targetAccountId },
    select: { id: true, userId: true, currencySymbol: true, nickname: true },
  });

  if (!account) {
    throw new AuthError("NOT_FOUND", "Bank account not found.", 404);
  }

  if (account.userId !== input.targetUserId) {
    throw new AuthError(
      "FORBIDDEN",
      "Target account does not belong to specified user.",
      403
    );
  }

  if (account.currencySymbol !== input.assetSymbol) {
    throw new AuthError(
      "VALIDATION_ERROR",
      `Account currency ${account.currencySymbol} does not match funding asset ${input.assetSymbol}.`,
      422
    );
  }

  const precision = getAssetPrecision(input.assetSymbol);

  const result = await withIdempotentFallback(
    () =>
      prisma.$transaction(async (tx) => {
        const ledgerAccount = await tx.ledgerAccount.findUnique({
          where: { bankAccountId: account.id },
        });

        if (!ledgerAccount) {
          throw new Error(`Bank account ${account.id} has no ledger account`);
        }

        const fundingPool = await getOrCreatePlatformLedgerAccount(tx, {
          type: "EQUITY",
          assetSymbol: input.assetSymbol,
          name: ADMIN_FUNDING_POOL_NAME(input.assetSymbol),
        });

        const { groupId } = await postLedgerEntries(tx, [
          {
            ledgerAccountId: ledgerAccount.id,
            direction: "DEBIT",
            assetSymbol: input.assetSymbol,
            amount: input.amount,
            referenceType: "AdminFunding",
            referenceId: idempotencyKey,
          },
          {
            ledgerAccountId: fundingPool.id,
            direction: "CREDIT",
            assetSymbol: input.assetSymbol,
            amount: input.amount,
            referenceType: "AdminFunding",
            referenceId: idempotencyKey,
          },
        ]);

        // Update balance cache
        await tx.bankAccount.update({
          where: { id: account.id },
          data: { balanceCache: { increment: input.amount } },
        });

        // Create user-visible transaction
        const transaction = await tx.transaction.create({
          data: {
            userId: input.targetUserId,
            type: "DEPOSIT",
            direction: "CREDIT",
            status: "COMPLETED",
            assetSymbol: input.assetSymbol,
            amount: new Decimal(input.amount).toFixed(precision),
            counterparty: "Platform Treasury",
            narration: input.reason,
            referenceType: "AdminFunding",
            referenceId: idempotencyKey,
            ledgerGroupId: groupId,
            isDemo: true,
          },
        });

        // Atomic audit log within the same transaction
        await tx.auditLog.create({
          data: {
            actorUserId: adminUserId,
            actorRole: "ADMIN",
            action: "admin.fund_account",
            targetType: "BankAccount",
            targetId: account.id,
            metadata: {
              targetUserId: input.targetUserId,
              assetSymbol: input.assetSymbol,
              amount: input.amount,
              reason: input.reason,
            },
          },
        });

        return { transactionId: transaction.id, ledgerGroupId: groupId };
      }),
    async () => {
      const tx = await prisma.transaction.findFirst({
        where: {
          referenceType: "AdminFunding",
          referenceId: idempotencyKey,
        },
      });
      return tx
        ? { transactionId: tx.id, ledgerGroupId: tx.ledgerGroupId ?? idempotencyKey }
        : null;
    }
  );

  if (!result) {
    throw new Error(
      "Admin funding could not be created or recovered after a duplicate-key conflict."
    );
  }

  return { ...result, alreadyProcessed: false };
}

async function fundCryptoWallet(
  adminUserId: string,
  input: AdminFundingInput,
  idempotencyKey: string
) {
  const wallet = await prisma.cryptoWallet.findUnique({
    where: { id: input.targetWalletId },
    select: { id: true, userId: true, label: true },
  });

  if (!wallet) {
    throw new AuthError("NOT_FOUND", "Crypto wallet not found.", 404);
  }

  if (wallet.userId !== input.targetUserId) {
    throw new AuthError(
      "FORBIDDEN",
      "Target wallet does not belong to specified user.",
      403
    );
  }

  const precision = getAssetPrecision(input.assetSymbol);

  const result = await withIdempotentFallback(
    () =>
      prisma.$transaction(async (tx) => {
        const { ledgerAccount } = await ensureAssetBalanceAndLedgerAccount(
          tx,
          wallet.id,
          input.assetSymbol
        );

        const fundingPool = await getOrCreatePlatformLedgerAccount(tx, {
          type: "EQUITY",
          assetSymbol: input.assetSymbol,
          name: ADMIN_FUNDING_POOL_NAME(input.assetSymbol),
        });

        const { groupId } = await postLedgerEntries(tx, [
          {
            ledgerAccountId: ledgerAccount.id,
            direction: "DEBIT",
            assetSymbol: input.assetSymbol,
            amount: input.amount,
            referenceType: "AdminFunding",
            referenceId: idempotencyKey,
          },
          {
            ledgerAccountId: fundingPool.id,
            direction: "CREDIT",
            assetSymbol: input.assetSymbol,
            amount: input.amount,
            referenceType: "AdminFunding",
            referenceId: idempotencyKey,
          },
        ]);

        // Update asset balance cache
        await tx.assetBalance.update({
          where: {
            walletId_assetSymbol: { walletId: wallet.id, assetSymbol: input.assetSymbol },
          },
          data: { available: { increment: input.amount } },
        });

        // Create user-visible transaction
        const transaction = await tx.transaction.create({
          data: {
            userId: input.targetUserId,
            type: "DEPOSIT",
            direction: "CREDIT",
            status: "COMPLETED",
            assetSymbol: input.assetSymbol,
            amount: new Decimal(input.amount).toFixed(precision),
            counterparty: "Platform Treasury",
            narration: input.reason,
            referenceType: "AdminFunding",
            referenceId: idempotencyKey,
            ledgerGroupId: groupId,
            isDemo: true,
          },
        });

        // Atomic audit log within the same transaction
        await tx.auditLog.create({
          data: {
            actorUserId: adminUserId,
            actorRole: "ADMIN",
            action: "admin.fund_wallet",
            targetType: "CryptoWallet",
            targetId: wallet.id,
            metadata: {
              targetUserId: input.targetUserId,
              assetSymbol: input.assetSymbol,
              amount: input.amount,
              reason: input.reason,
            },
          },
        });

        return { transactionId: transaction.id, ledgerGroupId: groupId };
      }),
    async () => {
      const tx = await prisma.transaction.findFirst({
        where: {
          referenceType: "AdminFunding",
          referenceId: idempotencyKey,
        },
      });
      return tx
        ? { transactionId: tx.id, ledgerGroupId: tx.ledgerGroupId ?? idempotencyKey }
        : null;
    }
  );

  if (!result) {
    throw new Error(
      "Admin funding could not be created or recovered after a duplicate-key conflict."
    );
  }

  return { ...result, alreadyProcessed: false };
}

/**
 * List all users with their accounts and wallets for admin funding interface.
 */
export async function listUsersForFunding(searchEmail?: string) {
  const where = searchEmail
    ? {
        email: { contains: searchEmail, mode: "insensitive" as const },
        profile: { onboardingCompletedAt: { not: null } },
      }
    : {
        profile: { onboardingCompletedAt: { not: null } },
      };

  return prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      role: true,
      profile: {
        select: {
          fullName: true,
          preferredFiatCurrency: true,
        },
      },
      bankAccounts: {
        select: {
          id: true,
          type: true,
          currencySymbol: true,
          accountNumber: true,
          nickname: true,
          balanceCache: true,
        },
        orderBy: { isPrimary: "desc" },
      },
      cryptoWallets: {
        select: {
          id: true,
          label: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/**
 * Get user details with accounts and wallets by user ID.
 */
export async function getUserForFunding(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      profile: {
        select: {
          fullName: true,
          preferredFiatCurrency: true,
        },
      },
      bankAccounts: {
        select: {
          id: true,
          type: true,
          currencySymbol: true,
          accountNumber: true,
          nickname: true,
          balanceCache: true,
        },
        orderBy: { isPrimary: "desc" },
      },
      cryptoWallets: {
        select: {
          id: true,
          label: true,
          balances: {
            select: {
              assetSymbol: true,
              available: true,
              locked: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new AuthError("NOT_FOUND", "User not found.", 404);
  }

  return user;
}
