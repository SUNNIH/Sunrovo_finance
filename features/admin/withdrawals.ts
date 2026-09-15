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
      const updatedWithdrawal = await tx.withdrawal.update({ where: { id: withdrawal.id }, data: { status: "COMPLETED" } });
      await tx.transaction.updateMany({
        where: { userId: withdrawal.userId, referenceType: "Withdrawal", referenceId: withdrawal.id },
        data: { status: "COMPLETED", narration: "Simulated withdrawal approved by review" },
      });
      await tx.notification.create({
        data: { userId: withdrawal.userId, type: "TRANSACTION", title: "Withdrawal approved", body: `Your withdrawal of ${withdrawal.amount.toString()} ${withdrawal.assetSymbol} was approved.` },
      });

      // Atomic audit log for approval
      await tx.auditLog.create({
        data: {
          actorUserId: adminId,
          actorRole: "ADMIN",
          action: "admin.approve_withdrawal",
          targetType: "Withdrawal",
          targetId: withdrawalId,
          metadata: { reversalLedgerGroupId: null },
        },
      });

      return { withdrawal: updatedWithdrawal, decision, reversalLedgerGroupId: null };
    }

    // Get exact source account from withdrawal record (fiat only now)
    let ledgerAccount: { id: string } | null = null;
    if (withdrawal.sourceAccountId) {
      ledgerAccount = await tx.ledgerAccount.findUnique({
        where: { bankAccountId: withdrawal.sourceAccountId },
        select: { id: true },
      });
    } else if (withdrawal.sourceWalletId) {
      // Historical crypto withdrawal - still need to handle refunds for old records
      ledgerAccount = await tx.ledgerAccount.findFirst({
        where: { 
          cryptoWalletId: withdrawal.sourceWalletId,
          assetSymbol: withdrawal.assetSymbol
        },
        select: { id: true },
      });
    }

    if (!ledgerAccount) {
      throw new Error(`Withdrawal ${withdrawal.id} has no traceable customer ledger account.`);
    }

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
    if (withdrawal.sourceAccountId) {
      await tx.bankAccount.update({ 
        where: { id: withdrawal.sourceAccountId }, 
        data: { balanceCache: { increment: totalRefund } } 
      });
    } else if (withdrawal.sourceWalletId) {
      const balance = await tx.assetBalance.findFirst({ 
        where: { 
          walletId: withdrawal.sourceWalletId,
          assetSymbol: withdrawal.assetSymbol
        } 
      });
      if (!balance) throw new Error(`Withdrawal ${withdrawal.id} has no asset balance for refund.`);
      await tx.assetBalance.update({ 
        where: { id: balance.id }, 
        data: { available: { increment: totalRefund } } 
      });
    } else {
      throw new Error(`Withdrawal ${withdrawal.id} has no source tracking for refund.`);
    }

    const updatedWithdrawal = await tx.withdrawal.update({
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

    // Atomic audit log for critical financial operation
    await tx.auditLog.create({
      data: {
        actorUserId: adminId,
        actorRole: "ADMIN",
         action: "admin.reject_withdrawal",
        targetType: "Withdrawal",
        targetId: withdrawalId,
        metadata: { reversalLedgerGroupId: groupId, reasonProvided: Boolean(rejectionReason?.trim()) },
      },
    });

    return { withdrawal: updatedWithdrawal, decision, reversalLedgerGroupId: groupId };
  });

  return result;
}
