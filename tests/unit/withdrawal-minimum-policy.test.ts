import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createWithdrawal } from "@/features/treasury/withdrawals";
import Decimal from "decimal.js";

/**
 * Withdrawal Minimum Policy Tests
 *
 * Verify that all withdrawals must meet the $100 USD equivalent minimum.
 * 
 * Phase 8: Crypto withdrawals removed. Only fiat withdrawal tests remain.
 */

// Mock transaction PIN verification to always succeed
vi.mock("@/lib/auth/transaction-pin", () => ({
  verifyTransactionPin: vi.fn().mockResolvedValue(true),
}));

describe("withdrawal minimum policy - $100 USD equivalent", () => {
  let userId = "";
  let accountId = "";

  beforeEach(async () => {
    userId = "";
    accountId = "";
    // Financial integration tests must never write to development or production data.
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl || process.env.SUNROVO_TEST_DB_CONFIRM !== "codex.phase6_test") {
      throw new Error("SAFETY STOP: Isolated local test connection required.");
    }
    const url = new URL(databaseUrl);
    if (
      !["postgresql:", "postgres:"].includes(url.protocol) ||
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      url.pathname !== "/codex" ||
      url.searchParams.getAll("schema").length !== 1 ||
      url.searchParams.get("schema") !== "phase6_test"
    ) {
      throw new Error("SAFETY STOP: Refusing tests outside codex.phase6_test.");
    }
    const identity = await prisma.$queryRaw<
      Array<{ databaseName: string; schemaName: string }>
    >`
      SELECT current_database() AS "databaseName", current_schema() AS "schemaName"
    `;
    if (
      identity.length !== 1 ||
      identity[0]?.databaseName !== "codex" ||
      identity[0]?.schemaName !== "phase6_test"
    ) {
      throw new Error("SAFETY STOP: PostgreSQL identity mismatch.");
    }

    // Create test user with security settings
    const user = await prisma.user.create({
      data: {
        email: `test-min-${Date.now()}@example.com`,
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

    // Create test bank account with large balance
    const account = await prisma.bankAccount.create({
      data: {
        userId,
        currencySymbol: "USD",
        type: "CURRENT",
        accountNumber: `MINTEST${Date.now()}`,
        isPrimary: true,
        balanceCache: "50000.00",
      },
    });
    accountId = account.id;

    // Create ledger account
    await prisma.ledgerAccount.create({
      data: {
        assetSymbol: "USD",
        type: "ASSET",
        name: `Customer USD ${userId}`,
        bankAccountId: accountId,
      },
    });
  });

  afterEach(async () => {
    // Empty IDs mean setup did not create any fixture. Never issue an unscoped delete.
    if (!userId) return;

    await prisma.$transaction(async (tx) => {
      const entries = await tx.ledgerEntry.findMany({
        where: {
          OR: [
            { ledgerAccount: { bankAccount: { userId } } },
            { ledgerAccount: { cryptoWallet: { userId } } },
          ],
        },
        select: { groupId: true },
      });
      const groupIds = [...new Set(entries.map((entry) => entry.groupId))];

      await tx.withdrawal.deleteMany({ where: { userId } });
      await tx.transaction.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      // Delete the full posting groups of this fixture, including platform legs.
      if (groupIds.length > 0) {
        await tx.ledgerEntry.deleteMany({ where: { groupId: { in: groupIds } } });
      }
      await tx.ledgerAccount.deleteMany({ where: { bankAccount: { userId } } });
      await tx.ledgerAccount.deleteMany({ where: { cryptoWallet: { userId } } });
      await tx.assetBalance.deleteMany({ where: { wallet: { userId } } });
      await tx.cryptoWallet.deleteMany({ where: { userId } });
      await tx.bankAccount.deleteMany({ where: { userId } });
      await tx.securitySetting.deleteMany({ where: { userId } });
      await tx.auditLog.deleteMany({ where: { actorUserId: userId } });
      await tx.profile.deleteMany({ where: { userId } });
      await tx.user.deleteMany({ where: { id: userId } });
    });
    vi.clearAllMocks();
  });

  describe("USD withdrawals", () => {
    it("rejects withdrawal below $100 minimum ($99.99)", async () => {
      await expect(
        createWithdrawal(
          userId,
          {
            sourceAccountId: accountId,
            assetSymbol: "USD",
            amount: "99.99",
            destination: "External Bank Account",
            transactionPin: "123456",
          },
          `test-min-${Date.now()}`
        )
      ).rejects.toThrow("Minimum withdrawal is $100 USD equivalent");

      // Verify no financial posting occurred for this user
      const withdrawals = await prisma.withdrawal.findMany({ where: { userId } });
      expect(withdrawals.length).toBe(0);

      // Verify no ledger entries were created for this user's accounts
      const userLedgerAccounts = await prisma.ledgerAccount.findMany({
        where: { bankAccountId: accountId },
        select: { id: true },
      });
      const userLedgerAccountIds = userLedgerAccounts.map((la) => la.id);
      
      const ledgerEntries = await prisma.ledgerEntry.findMany({
        where: {
          ledgerAccountId: { in: userLedgerAccountIds },
        },
      });
      expect(ledgerEntries.length).toBe(0);

      // Balance should be unchanged
      const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
      expect(new Decimal(account!.balanceCache.toString()).toString()).toBe("50000");
    });

    it("allows withdrawal of exactly $100", async () => {
      const withdrawal = await createWithdrawal(
        userId,
        {
          sourceAccountId: accountId,
          assetSymbol: "USD",
          amount: "100.00",
          destination: "External Bank Account",
          transactionPin: "123456",
        },
        `test-min-${Date.now()}`
      );

      expect(withdrawal.status).toBe("PENDING");
      expect(new Decimal(withdrawal.amount.toString()).toString()).toBe("100");

      // Verify persisted withdrawal and its financial posting
      const persistedWithdrawal = await prisma.withdrawal.findUniqueOrThrow({
        where: { id: withdrawal.id },
      });

      expect(persistedWithdrawal.status).toBe("PENDING");
      expect(persistedWithdrawal.ledgerGroupId).toBeTruthy();
      expect(withdrawal.ledgerGroupId).toBe(persistedWithdrawal.ledgerGroupId);

      const ledgerEntries = await prisma.ledgerEntry.findMany({
        where: { groupId: persistedWithdrawal.ledgerGroupId! },
      });

      expect(ledgerEntries.length).toBeGreaterThan(0);
    });

    it("allows withdrawal above $100 minimum ($500)", async () => {
      const withdrawal = await createWithdrawal(
        userId,
        {
          sourceAccountId: accountId,
          assetSymbol: "USD",
          amount: "500.00",
          destination: "External Bank Account",
          transactionPin: "123456",
        },
        `test-min-${Date.now()}`
      );

      expect(withdrawal.status).toBe("PENDING");
      expect(new Decimal(withdrawal.amount.toString()).toString()).toBe("500");
    });
  });

  describe("GBP withdrawals (FX conversion)", () => {
    let gbpAccountId: string;

    beforeEach(async () => {
      // Create GBP account
      const gbpAccount = await prisma.bankAccount.create({
        data: {
          userId,
          currencySymbol: "GBP",
          type: "CURRENT",
          accountNumber: "9876543210",
          isPrimary: false,
          balanceCache: "50000.00",
        },
      });
      gbpAccountId = gbpAccount.id;

      await prisma.ledgerAccount.create({
        data: {
          assetSymbol: "GBP",
          type: "ASSET",
          name: `Customer GBP ${userId}`,
          bankAccountId: gbpAccountId,
        },
      });
    });

    it("rejects GBP withdrawal below $100 equivalent (£78.74 @ 1.27 rate)", async () => {
      // £78.74 * 1.27 = $99.99
      await expect(
        createWithdrawal(
          userId,
          {
            sourceAccountId: gbpAccountId,
            assetSymbol: "GBP",
            amount: "78.74",
            destination: "UK Bank Account",
            transactionPin: "123456",
          },
          `test-min-gbp-${Date.now()}`
        )
      ).rejects.toThrow("Minimum withdrawal is $100 USD equivalent");
    });

    it("allows GBP withdrawal at $100 equivalent (£78.75 @ 1.27 rate)", async () => {
      // £78.75 * 1.27 = $100.01
      const withdrawal = await createWithdrawal(
        userId,
        {
          sourceAccountId: gbpAccountId,
          assetSymbol: "GBP",
          amount: "78.75",
          destination: "UK Bank Account",
          transactionPin: "123456",
        },
        `test-min-gbp-${Date.now()}`
      );

      expect(withdrawal.status).toBe("PENDING");
    });
  });

  describe("Crypto withdrawal rejection (Phase 8)", () => {
    let walletId: string;

    beforeEach(async () => {
      // Create crypto wallet with BTC and USDT for testing rejection
      const wallet = await prisma.cryptoWallet.create({
        data: { userId },
      });
      walletId = wallet.id;

      // BTC balance
      await prisma.assetBalance.create({
        data: {
          walletId,
          assetSymbol: "BTC",
          available: "10.0",
          locked: "0.0",
        },
      });

      await prisma.ledgerAccount.create({
        data: {
          assetSymbol: "BTC",
          type: "ASSET",
          name: `Customer BTC ${userId}`,
          cryptoWalletId: walletId,
        },
      });

      // USDT balance
      await prisma.assetBalance.create({
        data: {
          walletId,
          assetSymbol: "USDT",
          available: "10000.0",
          locked: "0.0",
        },
      });

      await prisma.ledgerAccount.create({
        data: {
          assetSymbol: "USDT",
          type: "ASSET",
          name: `Customer USDT ${userId}`,
          cryptoWalletId: walletId,
        },
      });
    });

    it("rejects BTC withdrawal - crypto withdrawals no longer supported", async () => {
      // Phase 8: All crypto withdrawals rejected at service level
      await expect(
        createWithdrawal(
          userId,
          {
            sourceAccountId: "placeholder-crypto-will-be-rejected",
            assetSymbol: "BTC",
            amount: "0.001",
            destination: "bc1qexternaladdress",
            transactionPin: "123456",
          },
          `test-crypto-btc-${Date.now()}`
        )
      ).rejects.toThrow("Crypto withdrawals are no longer supported");
    });

    it("rejects USDT withdrawal - crypto withdrawals no longer supported", async () => {
      // Phase 8: Even stablecoins rejected (crypto withdrawal feature removed)
      await expect(
        createWithdrawal(
          userId,
          {
            sourceAccountId: "placeholder-crypto-will-be-rejected",
            assetSymbol: "USDT",
            amount: "100.00",
            destination: "0xexternaladdress",
            transactionPin: "123456",
          },
          `test-crypto-usdt-${Date.now()}`
        )
      ).rejects.toThrow("Crypto withdrawals are no longer supported");
    });
  });

  it("all valid withdrawals still require admin approval (PENDING status)", async () => {
    // Test multiple valid amounts across different sizes
    const testCases = [
      { amount: "100.00", desc: "exact minimum" },
      { amount: "250.00", desc: "moderate amount" },
      { amount: "1000.00", desc: "large amount" },
    ];

    for (const testCase of testCases) {
      const withdrawal = await createWithdrawal(
        userId,
        {
          sourceAccountId: accountId,
          assetSymbol: "USD",
          amount: testCase.amount,
          destination: "External Bank Account",
          transactionPin: "123456",
        },
        `test-approval-${Date.now()}-${testCase.amount}`
      );

      expect(withdrawal.status).toBe("PENDING");

      const txn = await prisma.transaction.findFirst({
        where: { userId, referenceType: "Withdrawal", referenceId: withdrawal.id },
      });
      expect(txn?.status).toBe("PENDING");
    }
  });
});
