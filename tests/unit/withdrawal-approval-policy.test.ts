import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createWithdrawal } from "@/features/treasury/withdrawals";
import { reviewWithdrawal } from "@/features/admin/withdrawals";
import * as transactionPin from "@/lib/auth/transaction-pin";
import Decimal from "decimal.js";

/**
 * Withdrawal Approval Policy Tests
 *
 * Verify that ALL new withdrawals require administrator approval,
 * regardless of amount, and that the approval/rejection flow works correctly.
 */

// Mock transaction PIN verification to always succeed
vi.mock("@/lib/auth/transaction-pin", () => ({
  verifyTransactionPin: vi.fn().mockResolvedValue(true),
}));

describe("withdrawal approval policy - all withdrawals require admin review", () => {
  let userId: string;
  let adminId: string;
  let accountId: string;
  let ledgerAccountId: string;

  beforeEach(async () => {
    // Create test user with security settings
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        passwordHash: "hashed",
        status: "ACTIVE",
        profile: { create: { fullName: "Test User", country: "US", accountType: "individual", preferredFiatCurrency: "USD" } },
      },
    });
    userId = user.id;

    await prisma.securitySetting.create({
      data: {
        userId,
        transactionPinHash: "test-pin-hash",
        withdrawalAllowlistEnabled: false,
      },
    });

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: `admin-${Date.now()}@example.com`,
        passwordHash: "hashed",
        role: "ADMIN",
        status: "ACTIVE",
        profile: { create: { fullName: "Admin User", country: "US", accountType: "individual", preferredFiatCurrency: "USD" } },
      },
    });
    adminId = admin.id;

    // Create test bank account with balance
    const account = await prisma.bankAccount.create({
      data: {
        userId,
        currencySymbol: "USD",
        type: "CURRENT",
        accountNumber: `APPTEST${Date.now()}`,
        isPrimary: true,
        balanceCache: "10000.00",
      },
    });
    accountId = account.id;

    // Create ledger account for the bank account
    const ledgerAccount = await prisma.ledgerAccount.create({
      data: {
        assetSymbol: "USD",
        type: "ASSET",
        name: `Customer USD ${userId}`,
        bankAccountId: accountId,
      },
    });
    ledgerAccountId = ledgerAccount.id;
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.withdrawal.deleteMany({ where: { userId } });
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.ledgerEntry.deleteMany({});
    await prisma.ledgerAccount.deleteMany({ where: { bankAccountId: accountId } });
    await prisma.bankAccount.deleteMany({ where: { userId } });
    await prisma.securitySetting.deleteMany({ where: { userId } });
    await prisma.profile.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, adminId] } } });
  });

  it("creates small withdrawal ($100) as PENDING requiring admin review", async () => {
    const withdrawal = await createWithdrawal(
      userId,
      {
        assetSymbol: "USD",
        amount: "100.00",
        destination: "External Bank Account",
        transactionPin: "123456",
      },
      `test-withdrawal-${Date.now()}`
    );

    expect(withdrawal.status).toBe("PENDING");
    expect(new Decimal(withdrawal.amount.toString()).toString()).toBe("100");
    expect(new Decimal(withdrawal.feeAmount.toString()).toString()).toBe("0.5"); // 0.5% fee

    // Verify transaction record is also PENDING
    const txn = await prisma.transaction.findFirst({
      where: { userId, referenceType: "Withdrawal", referenceId: withdrawal.id },
    });
    expect(txn?.status).toBe("PENDING");
    expect(txn?.narration).toContain("administrator review");

    // Verify notification was created
    const notification = await prisma.notification.findFirst({
      where: { userId, title: { contains: "pending" } },
    });
    expect(notification).toBeTruthy();
    expect(notification?.body).toContain("administrator review");
  });

  it("creates medium withdrawal ($1,000) as PENDING requiring admin review", async () => {
    const withdrawal = await createWithdrawal(
      userId,
      {
        assetSymbol: "USD",
        amount: "1000.00",
        destination: "External Bank Account",
        transactionPin: "123456",
      },
      `test-withdrawal-${Date.now()}`
    );

    expect(withdrawal.status).toBe("PENDING");
    expect(new Decimal(withdrawal.amount.toString()).toString()).toBe("1000");

    const txn = await prisma.transaction.findFirst({
      where: { userId, referenceType: "Withdrawal", referenceId: withdrawal.id },
    });
    expect(txn?.status).toBe("PENDING");
  });

  it("creates large withdrawal ($10,000) as PENDING requiring admin review", async () => {
    const withdrawal = await createWithdrawal(
      userId,
      {
        assetSymbol: "USD",
        amount: "5000.00",
        destination: "External Bank Account",
        transactionPin: "123456",
      },
      `test-withdrawal-${Date.now()}`
    );

    expect(withdrawal.status).toBe("PENDING");
    expect(new Decimal(withdrawal.amount.toString()).toString()).toBe("5000");

    const txn = await prisma.transaction.findFirst({
      where: { userId, referenceType: "Withdrawal", referenceId: withdrawal.id },
    });
    expect(txn?.status).toBe("PENDING");
  });

  it("admin approval completes withdrawal correctly", async () => {
    // Create pending withdrawal
    const withdrawal = await createWithdrawal(
      userId,
      {
        assetSymbol: "USD",
        amount: "100.00",
        destination: "External Bank Account",
        transactionPin: "123456",
      },
      `test-withdrawal-${Date.now()}`
    );

    expect(withdrawal.status).toBe("PENDING");

    // Admin approves
    const result = await reviewWithdrawal(adminId, withdrawal.id, "APPROVE");

    expect(result.withdrawal.status).toBe("COMPLETED");
    expect(result.decision).toBe("APPROVE");
    expect(result.reversalLedgerGroupId).toBeNull();

    // Verify transaction updated
    const txn = await prisma.transaction.findFirst({
      where: { userId, referenceType: "Withdrawal", referenceId: withdrawal.id },
    });
    expect(txn?.status).toBe("COMPLETED");
    expect(txn?.narration).toContain("approved");

    // Verify approval notification
    const notification = await prisma.notification.findFirst({
      where: { userId, title: { contains: "approved" } },
    });
    expect(notification).toBeTruthy();
  });

  it("admin rejection refunds withdrawal correctly with balanced ledger", async () => {
    // Get initial balance
    const initialAccount = await prisma.bankAccount.findUnique({ where: { id: accountId } });
    const initialBalance = new Decimal(initialAccount!.balanceCache.toString());

    // Create pending withdrawal
    const withdrawal = await createWithdrawal(
      userId,
      {
        assetSymbol: "USD",
        amount: "100.00",
        destination: "External Bank Account",
        transactionPin: "123456",
      },
      `test-withdrawal-${Date.now()}`
    );

    // Balance should be decremented by amount + fee
    const afterWithdrawalAccount = await prisma.bankAccount.findUnique({ where: { id: accountId } });
    const afterWithdrawalBalance = new Decimal(afterWithdrawalAccount!.balanceCache.toString());
    const expectedDebit = new Decimal("100.00").add("0.50"); // amount + 0.5% fee
    expect(afterWithdrawalBalance.toString()).toBe(initialBalance.minus(expectedDebit).toString());

    // Admin rejects
    const result = await reviewWithdrawal(adminId, withdrawal.id, "REJECT", "Test rejection");

    expect(result.withdrawal.status).toBe("REJECTED");
    expect(result.decision).toBe("REJECT");
    expect(result.reversalLedgerGroupId).toBeTruthy();

    // Fetch the withdrawal again to get the ledgerGroupId
    const withdrawalWithGroupId = await prisma.withdrawal.findUnique({ where: { id: withdrawal.id } });
    expect(withdrawalWithGroupId?.ledgerGroupId).toBeTruthy();

    // Verify full refund (principal + fee)
    const afterRejectionAccount = await prisma.bankAccount.findUnique({ where: { id: accountId } });
    const afterRejectionBalance = new Decimal(afterRejectionAccount!.balanceCache.toString());
    expect(afterRejectionBalance.toString()).toBe(initialBalance.toString());

    // Verify transaction reversed
    const txn = await prisma.transaction.findFirst({
      where: { userId, referenceType: "Withdrawal", referenceId: withdrawal.id },
    });
    expect(txn?.status).toBe("REVERSED");
    expect(txn?.narration).toContain("rejected");

    // Verify rejection notification
    const notification = await prisma.notification.findFirst({
      where: { userId, title: { contains: "rejected" } },
    });
    expect(notification).toBeTruthy();
    expect(notification?.body).toContain("returned");

    // Verify ledger is balanced
    expect(withdrawalWithGroupId!.ledgerGroupId).toBeTruthy();
    expect(result.reversalLedgerGroupId).toBeTruthy();
    
    const originalLedgerEntries = await prisma.ledgerEntry.findMany({
      where: { groupId: withdrawalWithGroupId!.ledgerGroupId! },
    });
    const reversalLedgerEntries = await prisma.ledgerEntry.findMany({
      where: { groupId: result.reversalLedgerGroupId! },
    });

    expect(originalLedgerEntries.length).toBe(4); // 2 debits, 2 credits for original
    expect(reversalLedgerEntries.length).toBe(4); // 2 debits, 2 credits for reversal

    // Sum should be zero for balanced ledger
    const originalDebits = originalLedgerEntries.filter((e) => e.direction === "DEBIT").reduce((sum, e) => sum.add(e.amount.toString()), new Decimal(0));
    const originalCredits = originalLedgerEntries.filter((e) => e.direction === "CREDIT").reduce((sum, e) => sum.add(e.amount.toString()), new Decimal(0));
    expect(originalDebits.toString()).toBe(originalCredits.toString());

    const reversalDebits = reversalLedgerEntries.filter((e) => e.direction === "DEBIT").reduce((sum, e) => sum.add(e.amount.toString()), new Decimal(0));
    const reversalCredits = reversalLedgerEntries.filter((e) => e.direction === "CREDIT").reduce((sum, e) => sum.add(e.amount.toString()), new Decimal(0));
    expect(reversalDebits.toString()).toBe(reversalCredits.toString());
  });

  it("prevents duplicate withdrawal submission via idempotency", async () => {
    const idempotencyKey = `test-withdrawal-${Date.now()}`;

    const first = await createWithdrawal(
      userId,
      {
        assetSymbol: "USD",
        amount: "100.00",
        destination: "External Bank Account",
        transactionPin: "123456",
      },
      idempotencyKey
    );

    const second = await createWithdrawal(
      userId,
      {
        assetSymbol: "USD",
        amount: "100.00",
        destination: "External Bank Account",
        transactionPin: "123456",
      },
      idempotencyKey
    );

    expect(first.id).toBe(second.id);
    expect(first.status).toBe("PENDING");
    expect(second.status).toBe("PENDING");

    // Verify only one transaction was created
    const transactions = await prisma.transaction.findMany({
      where: { userId, referenceType: "Withdrawal", referenceId: first.id },
    });
    expect(transactions.length).toBe(1);
  });

  it("prevents concurrent admin reviews with optimistic lock", async () => {
    const withdrawal = await createWithdrawal(
      userId,
      {
        assetSymbol: "USD",
        amount: "200.00",
        destination: "External Bank Account",
        transactionPin: "123456",
      },
      `test-withdrawal-${Date.now()}`
    );

    // Create second admin
    const admin2 = await prisma.user.create({
      data: {
        email: `admin2-${Date.now()}@example.com`,
        passwordHash: "hashed",
        role: "ADMIN",
        status: "ACTIVE",
        profile: { create: { fullName: "Admin 2", country: "US", accountType: "individual", preferredFiatCurrency: "USD" } },
      },
    });

    // First admin reviews
    const result1 = await reviewWithdrawal(adminId, withdrawal.id, "APPROVE");
    expect(result1.withdrawal.status).toBe("COMPLETED");

    // Second admin tries to review same withdrawal - should fail
    await expect(reviewWithdrawal(admin2.id, withdrawal.id, "REJECT")).rejects.toThrow("Only pending withdrawals can be reviewed");

    // Cleanup
    await prisma.user.delete({ where: { id: admin2.id } });
  });

  it("ensures no withdrawal bypasses admin review", async () => {
    const testAmounts = ["100.00", "200.00", "500.00", "1000.00", "5000.00"];

    for (const amount of testAmounts) {
      const withdrawal = await createWithdrawal(
        userId,
        {
          assetSymbol: "USD",
          amount,
          destination: "External Bank Account",
          transactionPin: "123456",
        },
        `test-withdrawal-${Date.now()}-${amount}`
      );

      expect(withdrawal.status).toBe("PENDING");

      const txn = await prisma.transaction.findFirst({
        where: { userId, referenceType: "Withdrawal", referenceId: withdrawal.id },
      });
      expect(txn?.status).toBe("PENDING");
    }
  });
});
