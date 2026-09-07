import "server-only";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { getAssetPrecision } from "@/lib/money/format";
import { isFiatAsset } from "@/lib/money/asset-kind";
import { getTicker } from "@/lib/bybit/client";
import { verifyTransactionPin } from "@/lib/auth/transaction-pin";
import { postLedgerEntries } from "@/lib/ledger/postLedgerEntries";
import { getOrCreatePlatformLedgerAccount, externalSettlementPoolName, feeRevenuePoolName } from "@/lib/ledger/platform-accounts";
import { ensureAssetBalanceAndLedgerAccount } from "@/features/crypto/wallet-helpers";
import { withIdempotentFallback } from "@/lib/ledger/idempotency";
import { writeAuditLog } from "@/lib/audit/log";
import type { WithdrawalInput } from "@/lib/validation/treasury";
import { AuthError } from "@/features/authentication/errors";

/** Above this USD-equivalent value, a withdrawal is held for admin review. */
const REVIEW_THRESHOLD_USD = new Decimal(1000);
const FIAT_USD_APPROX_RATE: Record<string, Decimal.Value> = { USD: 1, EUR: 1, GBP: 1, NGN: "0.000666666666666667" };
const WITHDRAWAL_FEE_RATE = "0.005"; // 0.5% flat demo fee

async function estimateUsdValue(assetSymbol: string, amount: string): Promise<Decimal> {
  if (isFiatAsset(assetSymbol)) {
    return new Decimal(amount).mul(FIAT_USD_APPROX_RATE[assetSymbol] ?? 1);
  }
  if (assetSymbol === "USDT") return new Decimal(amount);
  try {
    const ticker = await getTicker(`${assetSymbol}USDT`);
    return new Decimal(amount).mul(ticker.lastPrice);
  } catch {
    // Fail closed: uncertain valuation enters review rather than being
    // treated as a small, instantly approved withdrawal.
    return REVIEW_THRESHOLD_USD.add(1);
  }
}

function isValidDestinationFormat(assetSymbol: string, destination: string): boolean {
  if (isFiatAsset(assetSymbol)) return destination.trim().length >= 4;
  // Loose crypto-address-shaped heuristic — long enough, no whitespace.
  // A real integration would validate per-network checksum rules.
  return /^\S{10,120}$/.test(destination.trim());
}

export async function createWithdrawal(userId: string, input: WithdrawalInput, idempotencyKey: string) {
  const namespacedKey = `${userId}:${idempotencyKey}`;
  const existing = await prisma.withdrawal.findUnique({ where: { idempotencyKey: namespacedKey } });
  if (existing) return existing;

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
        AND: [{ OR: [{ network: input.network ?? "" }, { network: "" }] }],
      },
      select: { id: true },
    });
    if (!allowedDestination) {
      throw new AuthError("DESTINATION_NOT_ALLOWLISTED", "This destination is not on your withdrawal allowlist.", 422);
    }
  }

  const precision = getAssetPrecision(input.assetSymbol);
  const fee = new Decimal(input.amount).mul(WITHDRAWAL_FEE_RATE).toFixed(precision);
  const totalDebit = new Decimal(input.amount).add(fee).toFixed(precision);
  const usdValue = await estimateUsdValue(input.assetSymbol, input.amount);
  const requiresReview = usdValue.gt(REVIEW_THRESHOLD_USD);

  const fiat = isFiatAsset(input.assetSymbol);

  const result = await withIdempotentFallback(
    () =>
      prisma.$transaction(async (tx) => {
        let ledgerAccountId: string;

        if (fiat) {
          const account = await tx.bankAccount.findFirst({ where: { userId, currencySymbol: input.assetSymbol } });
          if (!account) throw new AuthError("ACCOUNT_NOT_FOUND", `No ${input.assetSymbol} account found.`, 404);
          if (new Decimal(account.balanceCache.toString()).lt(totalDebit)) {
            throw new AuthError("INSUFFICIENT_FUNDS", "Your available balance is lower than the amount required.", 422);
          }
          const ledgerAccount = await tx.ledgerAccount.findUnique({ where: { bankAccountId: account.id } });
          if (!ledgerAccount) throw new Error(`Account ${account.id} has no ledger account`);
          ledgerAccountId = ledgerAccount.id;
          await tx.bankAccount.update({ where: { id: account.id }, data: { balanceCache: { decrement: totalDebit } } });
        } else {
          const wallet = await tx.cryptoWallet.findFirst({ where: { userId } });
          if (!wallet) throw new AuthError("WALLET_NOT_FOUND", "No crypto wallet found for this account.", 404);
          const { balance, ledgerAccount } = await ensureAssetBalanceAndLedgerAccount(tx, wallet.id, input.assetSymbol);
          if (new Decimal(balance.available.toString()).lt(totalDebit)) {
            throw new AuthError("INSUFFICIENT_FUNDS", `Insufficient ${input.assetSymbol} balance.`, 422);
          }
          ledgerAccountId = ledgerAccount.id;
          await tx.assetBalance.update({ where: { id: balance.id }, data: { available: { decrement: totalDebit } } });
        }

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

        const status = requiresReview ? "PENDING" : "COMPLETED";
        const withdrawal = await tx.withdrawal.create({
          data: {
            userId,
            assetSymbol: input.assetSymbol,
            amount: input.amount,
            feeAmount: fee,
            destination: input.destination,
            network: input.network,
            status,
            idempotencyKey: namespacedKey,
          },
        });

        const { groupId } = await postLedgerEntries(tx, [
          { ledgerAccountId, direction: "DEBIT", assetSymbol: input.assetSymbol, amount: input.amount, referenceType: "Withdrawal", referenceId: withdrawal.id },
          { ledgerAccountId: settlementPool.id, direction: "CREDIT", assetSymbol: input.assetSymbol, amount: input.amount, referenceType: "Withdrawal", referenceId: withdrawal.id },
          { ledgerAccountId, direction: "DEBIT", assetSymbol: input.assetSymbol, amount: fee, referenceType: "Withdrawal", referenceId: withdrawal.id },
          { ledgerAccountId: feePool.id, direction: "CREDIT", assetSymbol: input.assetSymbol, amount: fee, referenceType: "Withdrawal", referenceId: withdrawal.id },
        ]);

        await tx.withdrawal.update({ where: { id: withdrawal.id }, data: { ledgerGroupId: groupId } });

        await tx.transaction.create({
          data: {
            userId,
            type: "WITHDRAWAL",
            direction: "DEBIT",
            status: requiresReview ? "PENDING" : "COMPLETED",
            assetSymbol: input.assetSymbol,
            amount: input.amount,
            feeAmount: fee,
            counterparty: input.destination,
            narration: requiresReview ? "Withdrawal pending review" : "Simulated withdrawal",
            referenceType: "Withdrawal",
            referenceId: withdrawal.id,
            ledgerGroupId: groupId,
            isDemo: true,
          },
        });

        if (requiresReview) {
          await tx.notification.create({
            data: {
              userId,
              type: "TRANSACTION",
              title: "Withdrawal pending review",
              body: `Your withdrawal of ${input.amount} ${input.assetSymbol} exceeds the instant-approval limit and is pending review.`,
            },
          });
        }

        return withdrawal;
      }),
    () => prisma.withdrawal.findUnique({ where: { idempotencyKey: namespacedKey } })
  );

  if (!result) throw new Error("Withdrawal could not be created or recovered after a duplicate-key conflict.");

  await writeAuditLog({
    actorUserId: userId,
    actorRole: "USER",
    action: "treasury.withdrawal_request",
    targetType: "Withdrawal",
    targetId: result.id,
    metadata: { assetSymbol: input.assetSymbol, requiresReview },
  });

  return result;
}

export async function listWithdrawals(userId: string, limit = 20) {
  return prisma.withdrawal.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
}
