import "server-only";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { getAssetPrecision } from "@/lib/money/format";
import { postLedgerEntries } from "@/lib/ledger/postLedgerEntries";
import { getOrCreatePlatformLedgerAccount, demoFundingPoolName } from "@/lib/ledger/platform-accounts";
import { ensureAssetBalanceAndLedgerAccount } from "@/features/crypto/wallet-helpers";
import { getOwnedAccountOrThrow } from "@/features/banking/accounts";
import { withIdempotentFallback } from "@/lib/ledger/idempotency";
import { writeAuditLog } from "@/lib/audit/log";
import type { FiatDepositInput, CryptoDepositInput } from "@/lib/validation/treasury";
import { getDemoDepositAddress } from "./demo-address";
import { AuthError } from "@/features/authentication/errors";
import { isFiatAsset } from "@/lib/money/asset-kind";

export async function createFiatDeposit(userId: string, input: FiatDepositInput, idempotencyKey: string) {
  const namespacedKey = `${userId}:${idempotencyKey}`;
  const existing = await prisma.deposit.findUnique({ where: { idempotencyKey: namespacedKey } });
  if (existing) return existing;

  const account = await getOwnedAccountOrThrow(userId, input.accountId);
  if (!isFiatAsset(account.currencySymbol)) {
    throw new AuthError("INVALID_CURRENCY", "Account currency is not a supported fiat currency.", 422);
  }
  const precision = getAssetPrecision(account.currencySymbol);

  const result = await withIdempotentFallback(
    () =>
      prisma.$transaction(async (tx) => {
        const deposit = await tx.deposit.create({
          data: {
            userId,
            bankAccountId: account.id,
            assetSymbol: account.currencySymbol,
            amount: input.amount,
            sendingBank: input.sendingBank.trim(),
            senderName: input.senderName.trim(),
            transferReference: input.transferReference.trim(),
            customerNote: input.customerNote?.trim() || null,
            status: "PENDING",
            idempotencyKey: namespacedKey,
            completedAt: null,
            ledgerGroupId: null,
          },
        });

        await tx.transaction.create({
          data: {
            userId,
            type: "DEPOSIT",
            direction: "CREDIT",
            status: "PENDING",
            assetSymbol: account.currencySymbol,
            amount: new Decimal(input.amount).toFixed(precision),
            counterparty: input.sendingBank.trim(),
            narration: `Incoming bank transfer from ${input.sendingBank.trim()} (Ref: ${input.transferReference.trim()})`,
            referenceType: "Deposit",
            referenceId: deposit.id,
            ledgerGroupId: null,
            isDemo: true,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: userId,
            actorRole: "USER",
            action: "treasury.fiat_deposit_requested",
            targetType: "Deposit",
            targetId: deposit.id,
            metadata: {
              bankAccountId: account.id,
              assetSymbol: account.currencySymbol,
              amount: input.amount,
              sendingBank: input.sendingBank.trim(),
              senderName: input.senderName.trim(),
              transferReference: input.transferReference.trim(),
              status: "PENDING",
            },
          },
        });

        return deposit;
      }),
    () => prisma.deposit.findUnique({ where: { idempotencyKey: namespacedKey } })
  );

  if (!result) throw new Error("Deposit could not be created or recovered after a duplicate-key conflict.");

  return result;
}

export async function createCryptoDeposit(userId: string, input: CryptoDepositInput, idempotencyKey: string) {
  const namespacedKey = `${userId}:${idempotencyKey}`;
  const existing = await prisma.deposit.findUnique({ where: { idempotencyKey: namespacedKey } });
  if (existing) return existing;

  const wallet = await prisma.cryptoWallet.findFirst({ where: { userId } });
  if (!wallet) throw new AuthError("WALLET_NOT_FOUND", "No crypto wallet found for this account.", 404);

  const { address, network } = getDemoDepositAddress(userId, input.assetSymbol);
  const precision = getAssetPrecision(input.assetSymbol);

  const result = await withIdempotentFallback(
    () =>
      prisma.$transaction(async (tx) => {
        const { ledgerAccount } = await ensureAssetBalanceAndLedgerAccount(tx, wallet.id, input.assetSymbol);
        const fundingPool = await getOrCreatePlatformLedgerAccount(tx, {
          type: "EQUITY",
          assetSymbol: input.assetSymbol,
          name: demoFundingPoolName(input.assetSymbol),
        });

        const deposit = await tx.deposit.create({
          data: {
            userId,
            assetSymbol: input.assetSymbol,
            amount: input.amount,
            network,
            demoAddress: address,
            status: "COMPLETED",
            idempotencyKey: namespacedKey,
            completedAt: new Date(),
          },
        });

        const { groupId } = await postLedgerEntries(tx, [
          { ledgerAccountId: ledgerAccount.id, direction: "DEBIT", assetSymbol: input.assetSymbol, amount: input.amount, referenceType: "Deposit", referenceId: deposit.id },
          { ledgerAccountId: fundingPool.id, direction: "CREDIT", assetSymbol: input.assetSymbol, amount: input.amount, referenceType: "Deposit", referenceId: deposit.id },
        ]);

        await tx.deposit.update({ where: { id: deposit.id }, data: { ledgerGroupId: groupId } });
        await tx.assetBalance.update({
          where: { walletId_assetSymbol: { walletId: wallet.id, assetSymbol: input.assetSymbol } },
          data: { available: { increment: input.amount } },
        });

        await tx.transaction.create({
          data: {
            userId,
            type: "DEPOSIT",
            direction: "CREDIT",
            status: "COMPLETED",
            assetSymbol: input.assetSymbol,
            amount: new Decimal(input.amount).toFixed(precision),
            counterparty: "Simulated on-chain deposit",
            narration: `Simulated deposit via ${network}`,
            referenceType: "Deposit",
            referenceId: deposit.id,
            ledgerGroupId: groupId,
            isDemo: true,
          },
        });

        return deposit;
      }),
    () => prisma.deposit.findUnique({ where: { idempotencyKey: namespacedKey } })
  );

  if (!result) throw new Error("Deposit could not be created or recovered after a duplicate-key conflict.");

  await writeAuditLog({ actorUserId: userId, actorRole: "USER", action: "treasury.crypto_deposit", targetType: "Deposit", targetId: result.id });
  return result;
}

export async function listDeposits(userId: string, limit = 20) {
  return prisma.deposit.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
}
