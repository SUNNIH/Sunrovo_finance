import "server-only";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { getAssetPrecision } from "@/lib/money/format";
import { isFiatAsset } from "@/lib/money/asset-kind";
import { meetsMinimumWithdrawal, MINIMUM_WITHDRAWAL_USD } from "@/lib/money/usd-equivalent";
import { verifyTransactionPin } from "@/lib/auth/transaction-pin";
import { postLedgerEntries } from "@/lib/ledger/postLedgerEntries";
import { getOrCreatePlatformLedgerAccount, externalSettlementPoolName, feeRevenuePoolName } from "@/lib/ledger/platform-accounts";
import { withIdempotentFallback } from "@/lib/ledger/idempotency";
import type { WithdrawalInput } from "@/lib/validation/treasury";
import { AuthError } from "@/features/authentication/errors";

const WITHDRAWAL_FEE_RATE = "0.005"; // 0.5% flat demo fee

function isValidDestinationFormat(assetSymbol: string, destination: string): boolean {
  // Fiat only - bank account/routing identifier
  return destination.trim().length >= 4;
}

export async function createWithdrawal(userId: string, input: WithdrawalInput, idempotencyKey: string) {
  const namespacedKey = `${userId}:${idempotencyKey}`;
  const existing = await prisma.withdrawal.findUnique({ where: { idempotencyKey: namespacedKey } });
  if (existing) return existing;

  // Phase 8: Reject crypto withdrawals - only fiat withdrawals are supported
  if (!isFiatAsset(input.assetSymbol)) {
    throw new AuthError(
      "CRYPTO_WITHDRAWAL_NOT_SUPPORTED",
      "Crypto withdrawals are no longer supported. Only fiat withdrawals to bank accounts are available.",
      422
    );
  }

  if (!isValidDestinationFormat(input.assetSymbol, input.destination)) {
    throw new AuthError("INVALID_DESTINATION", "That destination doesn't look valid.", 422);
  }

  const [user, security] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.securitySetting.findUnique({ where: { userId } }),
  ]);
  if (!user || !security?.transactionPinHash) {
    throw new AuthError("PIN_NOT_SET", "Set a transaction PIN in Security before withdrawing.", 400);
  }
  if (!(await verifyTransactionPin(security.transactionPinHash, input.transactionPin))) {
    throw new AuthError("INVALID_PIN", "That transaction PIN is incorrect.", 401);
  }

  if (security.withdrawalAllowlistEnabled) {
    const allowedDestination = await prisma.withdrawalAllowlistEntry.findFirst({
      where: {
        userId,
        destination: input.destination.trim(),
        OR: [{ assetSymbol: input.assetSymbol }, { assetSymbol: "" }],
        AND: [{ OR: [{ network: "" }] }],
      },
      select: { id: true },
    });
    if (!allowedDestination) {
      throw new AuthError("DESTINATION_NOT_ALLOWLISTED", "This destination is not on your withdrawal allowlist.", 422);
    }
  }

  // Check minimum withdrawal amount ($100 USD equivalent)
  try {
    const meetsMinimum = await meetsMinimumWithdrawal(input.assetSymbol, input.amount);
    if (!meetsMinimum) {
      throw new AuthError(
        "BELOW_MINIMUM_WITHDRAWAL",
        `Minimum withdrawal is $${MINIMUM_WITHDRAWAL_USD.toString()} USD equivalent.`,
        422
      );
    }
  } catch (error) {
    // If it's already our AuthError, rethrow it
    if (error instanceof AuthError) {
      throw error;
    }
    // If pricing failed, reject the withdrawal (fail-safe)
    throw new AuthError(
      "PRICING_UNAVAILABLE",
      "Unable to verify minimum withdrawal amount. Please try again later.",
      503
    );
  }

  const precision = getAssetPrecision(input.assetSymbol);
  const fee = new Decimal(input.amount).mul(WITHDRAWAL_FEE_RATE).toFixed(precision);
  const totalDebit = new Decimal(input.amount).add(fee).toFixed(precision);

  const result = await withIdempotentFallback(
    () =>
      prisma.$transaction(async (tx) => {
        // Fiat only - find exact specified bank account
        const account = await tx.bankAccount.findFirst({
          where: {
            id: input.sourceAccountId,
            userId,
            currencySymbol: input.assetSymbol,
          },
        });
        if (!account) throw new AuthError("ACCOUNT_NOT_FOUND", `No ${input.assetSymbol} account found.`, 404);
        if (new Decimal(account.balanceCache.toString()).lt(totalDebit)) {
          throw new AuthError("INSUFFICIENT_FUNDS", "Your available balance is lower than the amount required.", 422);
        }
        const ledgerAccount = await tx.ledgerAccount.findUnique({ where: { bankAccountId: account.id } });
        if (!ledgerAccount) throw new Error(`Account ${account.id} has no ledger account`);
        
        const ledgerAccountId = ledgerAccount.id;
        const sourceAccountId = account.id;

        await tx.bankAccount.update({ where: { id: account.id }, data: { balanceCache: { decrement: totalDebit } } });

        const settlementPool = await getOrCreatePlatformLedgerAccount(tx, {
          type: "EQUITY",
          assetSymbol: input.assetSymbol,
          name: externalSettlementPoolName(input.assetSymbol),
        });
        const feePool = await getOrCreatePlatformLedgerAccount(tx, {
          type: "REVENUE",
          assetSymbol: input.assetSymbol,
          name: feeRevenuePoolName(input.assetSymbol),
        });

        // ALL withdrawals now require admin review
        const status = "PENDING";
        const withdrawal = await tx.withdrawal.create({
          data: {
            userId,
            assetSymbol: input.assetSymbol,
            amount: input.amount,
            feeAmount: fee,
            destination: input.destination,
            network: null, // Fiat withdrawals have no network
            status,
            idempotencyKey: namespacedKey,
            sourceAccountId,
            sourceWalletId: null, // Fiat withdrawals have no wallet
          },
        });

        const { groupId } = await postLedgerEntries(tx, [
          { ledgerAccountId, direction: "DEBIT", assetSymbol: input.assetSymbol, amount: input.amount, referenceType: "Withdrawal", referenceId: withdrawal.id },
          { ledgerAccountId: settlementPool.id, direction: "CREDIT", assetSymbol: input.assetSymbol, amount: input.amount, referenceType: "Withdrawal", referenceId: withdrawal.id },
          { ledgerAccountId, direction: "DEBIT", assetSymbol: input.assetSymbol, amount: fee, referenceType: "Withdrawal", referenceId: withdrawal.id },
          { ledgerAccountId: feePool.id, direction: "CREDIT", assetSymbol: input.assetSymbol, amount: fee, referenceType: "Withdrawal", referenceId: withdrawal.id },
        ]);

        const updatedWithdrawal = await tx.withdrawal.update({ where: { id: withdrawal.id }, data: { ledgerGroupId: groupId } });

        await tx.transaction.create({
          data: {
            userId,
            type: "WITHDRAWAL",
            direction: "DEBIT",
            status: "PENDING",
            assetSymbol: input.assetSymbol,
            amount: input.amount,
            feeAmount: fee,
            counterparty: input.destination,
            narration: "Withdrawal pending administrator review",
            referenceType: "Withdrawal",
            referenceId: withdrawal.id,
            ledgerGroupId: groupId,
            isDemo: true,
          },
        });

        await tx.notification.create({
          data: {
            userId,
            type: "TRANSACTION",
            title: "Withdrawal pending review",
            body: `Your withdrawal of ${input.amount} ${input.assetSymbol} is pending administrator review.`,
          },
        });

        // Atomic audit log for critical financial operation
        await tx.auditLog.create({
          data: {
            actorUserId: userId,
            actorRole: "USER",
            action: "treasury.withdrawal_request",
            targetType: "Withdrawal",
            targetId: withdrawal.id,
            metadata: { assetSymbol: input.assetSymbol, requiresReview: true },
          },
        });

        return updatedWithdrawal;
      }),
    () => prisma.withdrawal.findUnique({ where: { idempotencyKey: namespacedKey } })
  );

  if (!result) throw new Error("Withdrawal could not be created or recovered after a duplicate-key conflict.");

  return result;
}

export async function listWithdrawals(userId: string, limit = 20) {
  return prisma.withdrawal.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
}
