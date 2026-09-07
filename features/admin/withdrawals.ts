import "server-only";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { postLedgerEntries } from "@/lib/ledger/postLedgerEntries";
import { externalSettlementPoolName, feeRevenuePoolName, getOrCreatePlatformLedgerAccount } from "@/lib/ledger/platform-accounts";
import { isFiatAsset } from "@/lib/money/asset-kind";
import { AuthError } from "@/features/authentication/errors";
import { writeAuditLog } from "@/lib/audit/log";

export async function listPendingWithdrawals(limit = 100) {
  return prisma.withdrawal.findMany({
    where: { status: { in: ["PENDING", "REVIEWING"] } },
    include: { user: { select: { email: true, profile: { select: { fullName: true } } } } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function reviewWithdrawal(
  adminId: string,
  withdrawalId: string,
  decision: "APPROVE" | "REJECT",
  rejectionReason?: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw new AuthError("WITHDRAWAL_NOT_FOUND", "Withdrawal not found.", 404);
    if (withdrawal.status !== "PENDING") {
      throw new AuthError("WITHDRAWAL_NOT_REVIEWABLE", "Only pending withdrawals can be reviewed.", 409);
    }

    // Conditional update serializes competing administrators. Any later
    // ledger/cache action happens only after this transaction-local lock.
    const claimed = await tx.withdrawal.updateMany({
      where: { id: withdrawal.id, status: "PENDING" },
      data: { status: "REVIEWING", reviewedByAdminId: adminId, reviewedAt: new Date() },
    });
    if (claimed.count !== 1) throw new AuthError("WITHDRAWAL_ALREADY_REVIEWED", "This withdrawal was just reviewed by another administrator.", 409);

    if (decision === "APPROVE") {
      await tx.withdrawal.update({ where: { id: withdrawal.id }, data: { status: "COMPLETED" } });
      await tx.transaction.updateMany({
        where: { userId: withdrawal.userId, referenceType: "Withdrawal", referenceId: withdrawal.id },
        data: { status: "COMPLETED", narration: "Simulated withdrawal approved by review" },
      });
      await tx.notification.create({
        data: { userId: withdrawal.userId, type: "TRANSACTION", title: "Withdrawal approved", body: `Your withdrawal of ${withdrawal.amount.toString()} ${withdrawal.assetSymbol} was approved.` },
      });
      return { withdrawal, decision, reversalLedgerGroupId: null };
    }

    const ledgerAccount = isFiatAsset(withdrawal.assetSymbol)
      ? await tx.ledgerAccount.findFirst({
          where: { bankAccount: { userId: withdrawal.userId, currencySymbol: withdrawal.assetSymbol } },
        })
      : await tx.ledgerAccount.findFirst({
          where: { cryptoWallet: { userId: withdrawal.userId }, assetSymbol: withdrawal.assetSymbol },
        });
    if (!ledgerAccount) throw new Error(`Withdrawal ${withdrawal.id} has no customer ledger account.`);

    const settlementPool = await getOrCreatePlatformLedgerAccount(tx, {
      type: "EQUITY", assetSymbol: withdrawal.assetSymbol, name: externalSettlementPoolName(withdrawal.assetSymbol),
    });
    const feePool = await getOrCreatePlatformLedgerAccount(tx, {
      type: "REVENUE", assetSymbol: withdrawal.assetSymbol, name: feeRevenuePoolName(withdrawal.assetSymbol),
    });
    const amount = withdrawal.amount.toString();
    const fee = withdrawal.feeAmount.toString();
    // Exact inverse of the original request posting. The original group is
    // retained untouched; this separately balanced group is the audit trail.
    const { groupId } = await postLedgerEntries(tx, [
      { ledgerAccountId: settlementPool.id, direction: "DEBIT", assetSymbol: withdrawal.assetSymbol, amount, referenceType: "WithdrawalReversal", referenceId: withdrawal.id },
      { ledgerAccountId: ledgerAccount.id, direction: "CREDIT", assetSymbol: withdrawal.assetSymbol, amount, referenceType: "WithdrawalReversal", referenceId: withdrawal.id },
      { ledgerAccountId: feePool.id, direction: "DEBIT", assetSymbol: withdrawal.assetSymbol, amount: fee, referenceType: "WithdrawalReversal", referenceId: withdrawal.id },
      { ledgerAccountId: ledgerAccount.id, direction: "CREDIT", assetSymbol: withdrawal.assetSymbol, amount: fee, referenceType: "WithdrawalReversal", referenceId: withdrawal.id },
    ]);

    const totalRefund = new Decimal(amount).add(fee).toFixed();
    if (isFiatAsset(withdrawal.assetSymbol)) {
      const account = await tx.bankAccount.findFirst({ where: { userId: withdrawal.userId, currencySymbol: withdrawal.assetSymbol } });
      if (!account) throw new Error(`Withdrawal ${withdrawal.id} has no customer bank account.`);
      await tx.bankAccount.update({ where: { id: account.id }, data: { balanceCache: { increment: totalRefund } } });
    } else {
      const balance = await tx.assetBalance.findFirst({ where: { wallet: { userId: withdrawal.userId }, assetSymbol: withdrawal.assetSymbol } });
      if (!balance) throw new Error(`Withdrawal ${withdrawal.id} has no customer asset balance.`);
      await tx.assetBalance.update({ where: { id: balance.id }, data: { available: { increment: totalRefund } } });
    }

    await tx.withdrawal.update({
      where: { id: withdrawal.id },
      data: { status: "REJECTED", rejectionReason: rejectionReason?.trim() || "Rejected during withdrawal review", reversalLedgerGroupId: groupId },
    });
    await tx.transaction.updateMany({
      where: { userId: withdrawal.userId, referenceType: "Withdrawal", referenceId: withdrawal.id },
      data: { status: "REVERSED", narration: "Withdrawal rejected; funds and fee returned" },
    });
    await tx.notification.create({
      data: { userId: withdrawal.userId, type: "TRANSACTION", title: "Withdrawal rejected", body: `Your withdrawal of ${amount} ${withdrawal.assetSymbol} was rejected and the full debit, including fee, was returned.` },
    });
    return { withdrawal, decision, reversalLedgerGroupId: groupId };
  });

  await writeAuditLog({
    actorUserId: adminId,
    actorRole: "ADMIN",
    action: decision === "APPROVE" ? "admin.approve_withdrawal" : "admin.reject_withdrawal",
    targetType: "Withdrawal",
    targetId: withdrawalId,
    metadata: { reversalLedgerGroupId: result.reversalLedgerGroupId, reasonProvided: Boolean(rejectionReason?.trim()) },
  });
  return result;
}
