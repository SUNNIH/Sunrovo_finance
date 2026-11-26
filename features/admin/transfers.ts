import "server-only";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { postLedgerEntries } from "@/lib/ledger/postLedgerEntries";
import { externalSettlementPoolName, feeRevenuePoolName, getOrCreatePlatformLedgerAccount } from "@/lib/ledger/platform-accounts";
import { AuthError } from "@/features/authentication/errors";

export async function listPendingTransfers(limit = 100) {
  return prisma.transfer.findMany({
    where: { status: "PENDING" },
    include: {
      user: { select: { email: true, profile: { select: { fullName: true } } } },
      sourceAccount: { select: { accountNumber: true, nickname: true, currencySymbol: true } },
      beneficiary: { select: { nickname: true, bankName: true, accountNumber: true } },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function reviewTransfer(
  adminId: string,
  transferId: string,
  decision: "APPROVE" | "REJECT",
  rejectionReason?: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const transfer = await tx.transfer.findUnique({
      where: { id: transferId },
      include: { beneficiary: true },
    });
    if (!transfer) throw new AuthError("TRANSFER_NOT_FOUND", "Transfer not found.", 404);
    if (transfer.status !== "PENDING") {
      throw new AuthError("TRANSFER_NOT_REVIEWABLE", "Only pending transfers can be reviewed.", 409);
    }

    // Verify this is an external transfer (only external transfers require approval)
    if (!transfer.beneficiary || transfer.beneficiary.type !== "EXTERNAL_BANK") {
      throw new AuthError(
        "INVALID_TRANSFER_TYPE",
        "Only external bank transfers require admin approval.",
        422
      );
    }

    // Conditional update serializes competing administrators
    const claimed = await tx.transfer.updateMany({
      where: { id: transfer.id, status: "PENDING" },
      data: { reviewedByAdminId: adminId, reviewedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new AuthError(
        "TRANSFER_ALREADY_REVIEWED",
        "This transfer was just reviewed by another administrator.",
        409
      );
    }

    if (decision === "APPROVE") {
      // Approval: just change status - funds already moved on submission
      const updatedTransfer = await tx.transfer.update({
        where: { id: transfer.id },
        data: { status: "COMPLETED" },
      });

      // Update associated transaction status
      await tx.transaction.updateMany({
        where: { userId: transfer.userId, referenceType: "Transfer", referenceId: transfer.id },
        data: { status: "COMPLETED", narration: transfer.narration || "External transfer approved" },
      });

      // Notify customer
      await tx.notification.create({
        data: {
          userId: transfer.userId,
          type: "TRANSACTION",
          title: "Transfer approved",
          body: `Your transfer of ${transfer.amount.toString()} ${transfer.currencySymbol} to ${transfer.beneficiary.nickname} was approved.`,
        },
      });

      // Atomic audit log
      await tx.auditLog.create({
        data: {
          actorUserId: adminId,
          actorRole: "ADMIN",
          action: "admin.approve_transfer",
          targetType: "Transfer",
          targetId: transferId,
          metadata: { reversalLedgerGroupId: null },
        },
      });

      return { transfer: updatedTransfer, decision, reversalLedgerGroupId: null };
    }

    // REJECTION: reverse the original ledger posting
    // Get exact source account
    const sourceLedgerAccount = await tx.ledgerAccount.findUnique({
      where: { bankAccountId: transfer.sourceAccountId },
      select: { id: true },
    });
    if (!sourceLedgerAccount) {
      throw new Error(`Transfer ${transfer.id} has no traceable source ledger account.`);
    }

    const settlementPool = await getOrCreatePlatformLedgerAccount(tx, {
      type: "EQUITY",
      assetSymbol: transfer.currencySymbol,
      name: externalSettlementPoolName(transfer.currencySymbol),
    });
    const feePool = await getOrCreatePlatformLedgerAccount(tx, {
      type: "REVENUE",
      assetSymbol: transfer.currencySymbol,
      name: feeRevenuePoolName(transfer.currencySymbol),
    });

    const amount = transfer.amount.toString();
    const fee = transfer.feeAmount.toString();

    // Create balanced reversal ledger group
    const { groupId } = await postLedgerEntries(tx, [
      // Reverse the transfer amount
      {
        ledgerAccountId: settlementPool.id,
        direction: "DEBIT",
        assetSymbol: transfer.currencySymbol,
        amount,
        referenceType: "TransferReversal",
        referenceId: transfer.id,
      },
      {
        ledgerAccountId: sourceLedgerAccount.id,
        direction: "CREDIT",
        assetSymbol: transfer.currencySymbol,
        amount,
        referenceType: "TransferReversal",
        referenceId: transfer.id,
      },
      // Reverse the fee
      {
        ledgerAccountId: feePool.id,
        direction: "DEBIT",
        assetSymbol: transfer.currencySymbol,
        amount: fee,
        referenceType: "TransferReversal",
        referenceId: transfer.id,
      },
      {
        ledgerAccountId: sourceLedgerAccount.id,
        direction: "CREDIT",
        assetSymbol: transfer.currencySymbol,
        amount: fee,
        referenceType: "TransferReversal",
        referenceId: transfer.id,
      },
    ]);

    // Refund the exact source account balance cache
    const totalRefund = new Decimal(amount).add(fee).toFixed();
    await tx.bankAccount.update({
      where: { id: transfer.sourceAccountId },
      data: { balanceCache: { increment: totalRefund } },
    });

    // Update transfer record
    const updatedTransfer = await tx.transfer.update({
      where: { id: transfer.id },
      data: {
        status: "REVERSED",
        rejectionReason: rejectionReason?.trim() || "Rejected during transfer review",
        reversalLedgerGroupId: groupId,
      },
    });

    // Update associated transaction status
    await tx.transaction.updateMany({
      where: { userId: transfer.userId, referenceType: "Transfer", referenceId: transfer.id },
      data: { status: "REVERSED", narration: "Transfer rejected; funds and fee returned" },
    });

    // Notify customer
    await tx.notification.create({
      data: {
        userId: transfer.userId,
        type: "TRANSACTION",
        title: "Transfer rejected",
        body: `Your transfer of ${amount} ${transfer.currencySymbol} was rejected and the full debit, including fee, was returned.`,
      },
    });

    // Atomic audit log
    await tx.auditLog.create({
      data: {
        actorUserId: adminId,
        actorRole: "ADMIN",
        action: "admin.reject_transfer",
        targetType: "Transfer",
        targetId: transferId,
        metadata: {
          reversalLedgerGroupId: groupId,
          reasonProvided: Boolean(rejectionReason?.trim()),
        },
      },
    });

    return { transfer: updatedTransfer, decision, reversalLedgerGroupId: groupId };
  });

  return result;
}
