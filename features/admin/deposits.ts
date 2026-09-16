import "server-only";
import { prisma } from "@/lib/db/prisma";
import { postLedgerEntries } from "@/lib/ledger/postLedgerEntries";
import { externalSettlementPoolName, getOrCreatePlatformLedgerAccount } from "@/lib/ledger/platform-accounts";
import { AuthError } from "@/features/authentication/errors";

export async function listPendingFiatDeposits(limit = 100) {
  return prisma.deposit.findMany({
    where: {
      status: "PENDING",
      bankAccountId: { not: null },
    },
    include: {
      user: { select: { email: true, profile: { select: { fullName: true } } } },
      bankAccount: { select: { accountNumber: true, nickname: true, currencySymbol: true } },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

/**
 * Approve a pending incoming fiat deposit.
 *
 * Requirements:
 * 1. Require Deposit status PENDING.
 * 2. Use exact Deposit.bankAccountId.
 * 3. Revalidate: account exists, belongs to Deposit.userId, currency matches Deposit.assetSymbol.
 * 4. Find exact LedgerAccount by bankAccountId.
 * 5. Use existing externalSettlementPoolName(assetSymbol).
 * 6. Run inside ONE Prisma transaction.
 * 7. Use atomic updateMany claim: where id = depositId AND status = PENDING. If count != 1, return conflict.
 * 8. Post balanced ledger entries:
 *    - DEBIT exact customer ledger account
 *    - CREDIT External Settlement platform account
 * 9. Increment exact BankAccount.balanceCache ONCE.
 * 10. Set Deposit: COMPLETED, completedAt, ledgerGroupId, reviewedByAdminId, reviewedAt.
 * 11. Update existing Transaction: COMPLETED, same ledgerGroupId (do not create another Transaction).
 * 12. Create audit event.
 * 13. Create customer notification.
 */
export async function approveFiatDeposit(adminId: string, depositId: string) {
  const result = await prisma.$transaction(async (tx) => {
    // 1. Require Deposit status PENDING
    const deposit = await tx.deposit.findUnique({
      where: { id: depositId },
    });
    if (!deposit) {
      throw new AuthError("DEPOSIT_NOT_FOUND", "Deposit not found.", 404);
    }
    if (deposit.status !== "PENDING") {
      throw new AuthError("DEPOSIT_NOT_REVIEWABLE", "Only pending deposits can be reviewed.", 409);
    }

    // 2. Use exact Deposit.bankAccountId
    if (!deposit.bankAccountId) {
      throw new AuthError(
        "INVALID_DEPOSIT_TYPE",
        "Only incoming fiat deposits with an associated bank account can be reviewed.",
        422
      );
    }

    // 3. Revalidate: account exists, belongs to Deposit.userId, currency matches Deposit.assetSymbol
    const account = await tx.bankAccount.findUnique({
      where: { id: deposit.bankAccountId },
    });
    if (!account) {
      throw new AuthError("ACCOUNT_NOT_FOUND", "Target bank account not found.", 404);
    }
    if (account.userId !== deposit.userId) {
      throw new AuthError("FORBIDDEN", "Target bank account does not belong to deposit user.", 403);
    }
    if (account.currencySymbol !== deposit.assetSymbol) {
      throw new AuthError(
        "INVALID_CURRENCY",
        `Account currency ${account.currencySymbol} does not match deposit asset ${deposit.assetSymbol}.`,
        422
      );
    }

    // 4. Find exact LedgerAccount by bankAccountId
    const customerLedgerAccount = await tx.ledgerAccount.findUnique({
      where: { bankAccountId: account.id },
      select: { id: true },
    });
    if (!customerLedgerAccount) {
      throw new Error(`Bank account ${account.id} has no ledger account`);
    }

    // 5. Use existing externalSettlementPoolName(assetSymbol)
    const settlementPool = await getOrCreatePlatformLedgerAccount(tx, {
      type: "EQUITY",
      assetSymbol: deposit.assetSymbol,
      name: externalSettlementPoolName(deposit.assetSymbol),
    });

    // 7. Atomic updateMany claim: where id = depositId AND status = PENDING
    // Atomically transition PENDING -> COMPLETED in the claim
    const reviewDate = new Date();
    const claimed = await tx.deposit.updateMany({
      where: { id: deposit.id, status: "PENDING" },
      data: {
        status: "COMPLETED",
        reviewedByAdminId: adminId,
        reviewedAt: reviewDate,
      },
    });
    if (claimed.count !== 1) {
      throw new AuthError(
        "DEPOSIT_ALREADY_REVIEWED",
        "This deposit was just reviewed by another administrator.",
        409
      );
    }

    const amountStr = deposit.amount.toString();

    // 8. Post balanced ledger entries:
    // - DEBIT exact customer ledger account
    // - CREDIT External Settlement platform account
    const { groupId } = await postLedgerEntries(tx, [
      {
        ledgerAccountId: customerLedgerAccount.id,
        direction: "DEBIT",
        assetSymbol: deposit.assetSymbol,
        amount: amountStr,
        referenceType: "Deposit",
        referenceId: deposit.id,
      },
      {
        ledgerAccountId: settlementPool.id,
        direction: "CREDIT",
        assetSymbol: deposit.assetSymbol,
        amount: amountStr,
        referenceType: "Deposit",
        referenceId: deposit.id,
      },
    ]);

    // 9. Increment exact BankAccount.balanceCache ONCE
    await tx.bankAccount.update({
      where: { id: account.id },
      data: {
        balanceCache: {
          increment: amountStr,
        },
      },
    });

    // 10. Finalize Deposit: set completedAt and ledgerGroupId
    const completedAt = new Date();
    const updatedDeposit = await tx.deposit.update({
      where: { id: deposit.id },
      data: {
        completedAt,
        ledgerGroupId: groupId,
      },
    });

    // 11. Update existing Transaction: COMPLETED, same ledgerGroupId (do not create another Transaction)
    await tx.transaction.updateMany({
      where: {
        userId: deposit.userId,
        referenceType: "Deposit",
        referenceId: deposit.id,
        status: "PENDING",
      },
      data: {
        status: "COMPLETED",
        ledgerGroupId: groupId,
      },
    });

    // 12. Create audit event
    await tx.auditLog.create({
      data: {
        actorUserId: adminId,
        actorRole: "ADMIN",
        action: "admin.approve_deposit",
        targetType: "Deposit",
        targetId: deposit.id,
        metadata: {
          bankAccountId: account.id,
          assetSymbol: deposit.assetSymbol,
          amount: amountStr,
          ledgerGroupId: groupId,
        },
      },
    });

    // 13. Create customer notification
    await tx.notification.create({
      data: {
        userId: deposit.userId,
        type: "TRANSACTION",
        title: "Deposit approved",
        body: `Your incoming transfer of ${amountStr} ${deposit.assetSymbol} has been approved and credited to your account.`,
      },
    });

    return { deposit: updatedDeposit, ledgerGroupId: groupId };
  });

  return result;
}

/**
 * Reject a pending incoming fiat deposit.
 *
 * Requirements:
 * 1. Require Deposit status PENDING.
 * 2. Require a non-empty rejection reason.
 * 3. Run inside one Prisma transaction.
 * 4. Atomically claim the Deposit using updateMany:
 *    where: id = depositId, status = PENDING
 *    data: status = FAILED, reviewedByAdminId = adminId, reviewedAt = now, rejectionReason = reason
 *    Require count === 1.
 * 5. Update existing associated Transaction:
 *    where: userId = deposit.userId, referenceType = "Deposit", referenceId = deposit.id, status = PENDING
 *    data: status = FAILED (ledgerGroupId stays null, do not create another Transaction).
 * 6. Create audit event inside the same transaction.
 * 7. Create customer notification.
 *
 * Financial rule: Zero ledger postings, zero balance changes. Rejection is status-only.
 */
export async function rejectFiatDeposit(
  adminId: string,
  depositId: string,
  rejectionReason: string
) {
  const trimmedReason = rejectionReason?.trim();
  if (!trimmedReason) {
    throw new AuthError("VALIDATION_ERROR", "Rejection reason is required.", 422);
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Require Deposit status PENDING
    const deposit = await tx.deposit.findUnique({
      where: { id: depositId },
    });
    if (!deposit) {
      throw new AuthError("DEPOSIT_NOT_FOUND", "Deposit not found.", 404);
    }
    if (deposit.status !== "PENDING") {
      throw new AuthError("DEPOSIT_NOT_REVIEWABLE", "Only pending deposits can be reviewed.", 409);
    }

    // 4. Atomically claim Deposit using updateMany: PENDING -> FAILED
    const reviewDate = new Date();
    const claimed = await tx.deposit.updateMany({
      where: { id: deposit.id, status: "PENDING" },
      data: {
        status: "FAILED",
        reviewedByAdminId: adminId,
        reviewedAt: reviewDate,
        rejectionReason: trimmedReason,
      },
    });

    if (claimed.count !== 1) {
      throw new AuthError(
        "DEPOSIT_ALREADY_REVIEWED",
        "This deposit was just reviewed by another administrator.",
        409
      );
    }

    // 5. Update existing associated Transaction to FAILED (ledgerGroupId stays null)
    await tx.transaction.updateMany({
      where: {
        userId: deposit.userId,
        referenceType: "Deposit",
        referenceId: deposit.id,
        status: "PENDING",
      },
      data: {
        status: "FAILED",
      },
    });

    // 6. Create audit event
    await tx.auditLog.create({
      data: {
        actorUserId: adminId,
        actorRole: "ADMIN",
        action: "admin.reject_deposit",
        targetType: "Deposit",
        targetId: deposit.id,
        metadata: {
          bankAccountId: deposit.bankAccountId,
          assetSymbol: deposit.assetSymbol,
          amount: deposit.amount.toString(),
          rejectionReason: trimmedReason,
        },
      },
    });

    // 7. Create customer notification
    const amountStr = deposit.amount.toString();
    await tx.notification.create({
      data: {
        userId: deposit.userId,
        type: "TRANSACTION",
        title: "Deposit rejected",
        body: `Your incoming transfer of ${amountStr} ${deposit.assetSymbol} was rejected: ${trimmedReason}`,
      },
    });

    const updatedDeposit = await tx.deposit.findUnique({
      where: { id: deposit.id },
    });

    return { deposit: updatedDeposit };
  });

  return result;
}

