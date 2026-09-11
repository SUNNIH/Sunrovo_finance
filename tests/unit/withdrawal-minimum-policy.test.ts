import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createWithdrawal } from "@/features/treasury/withdrawals";
import * as transactionPin from "@/lib/auth/transaction-pin";
import * as bybitClient from "@/lib/bybit/client";
import Decimal from "decimal.js";

/**
 * Withdrawal Minimum Policy Tests
 *
 * Verify that all withdrawals must meet the $100 USD equivalent minimum.
 */

// Mock transaction PIN verification to always succeed
vi.mock("@/lib/auth/transaction-pin", () => ({
  verifyTransactionPin: vi.fn().mockResolvedValue(true),
}));

describe("withdrawal minimum policy - $100 USD equivalent", () => {
  let userId: string;
  let accountId: string;

  beforeEach(async () => {
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
    await prisma.withdrawal.deleteMany({ where: { userId } });
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.ledgerEntry.deleteMany({});
    await prisma.ledgerAccount.deleteMany({ where: { bankAccountId: accountId } });
    await prisma.bankAccount.deleteMany({ where: { userId } });
    await prisma.securitySetting.deleteMany({ where: { userId } });
    await prisma.profile.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    vi.clearAllMocks();
  });

  describe("USD withdrawals", () => {
    it("rejects withdrawal below $100 minimum ($99.99)", async () => {
      await expect(
        createWithdrawal(
          userId,
          {
            assetSymbol: "USD",
            amount: "99.99",
            destination: "External Bank Account",
            transactionPin: "123456",
          },
          `test-min-${Date.now()}`
        )
      ).rejects.toThrow("Minimum withdrawal is $100 USD equivalent");

      // Verify no financial posting occurred
      const withdrawals = await prisma.withdrawal.findMany({ where: { userId } });
      expect(withdrawals.length).toBe(0);

      const ledgerEntries = await prisma.ledgerEntry.findMany({});
      expect(ledgerEntries.length).toBe(0);

      // Balance should be unchanged
      const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
      expect(new Decimal(account!.balanceCache.toString()).toString()).toBe("50000");
    });

    it("allows withdrawal of exactly $100", async () => {
      const withdrawal = await createWithdrawal(
        userId,
        {
          assetSymbol: "USD",
          amount: "100.00",
          destination: "External Bank Account",
          transactionPin: "123456",
        },
        `test-min-${Date.now()}`
      );

      expect(withdrawal.status).toBe("PENDING");
      expect(new Decimal(withdrawal.amount.toString()).toString()).toBe("100");

      // Verify financial posting occurred
      const ledgerEntries = await prisma.ledgerEntry.findMany({});
      expect(ledgerEntries.length).toBeGreaterThan(0);
    });

    it("allows withdrawal above $100 minimum ($500)", async () => {
      const withdrawal = await createWithdrawal(
        userId,
        {
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

      await prisma.ledgerAccount.create({
        data: {
          assetSymbol: "GBP",
          type: "ASSET",
          name: `Customer GBP ${userId}`,
          bankAccountId: gbpAccount.id,
        },
      });
    });

    it("rejects GBP withdrawal below $100 equivalent (£78.74 @ 1.27 rate)", async () => {
      // £78.74 * 1.27 = $99.99
      await expect(
        createWithdrawal(
          userId,
          {
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

  describe("Crypto withdrawals (market pricing)", () => {
    let walletId: string;

    beforeEach(async () => {
      // Create crypto wallet with BTC and ETH
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

      // ETH balance
      await prisma.assetBalance.create({
        data: {
          walletId,
          assetSymbol: "ETH",
          available: "100.0",
          locked: "0.0",
        },
      });

      await prisma.ledgerAccount.create({
        data: {
          assetSymbol: "ETH",
          type: "ASSET",
          name: `Customer ETH ${userId}`,
          cryptoWalletId: walletId,
        },
      });
    });

    it("rejects BTC withdrawal below $100 equivalent (mocked price)", async () => {
      // Mock BTC price at $50,000
      vi.spyOn(bybitClient, "getTicker").mockResolvedValue({
        symbol: "BTCUSDT",
        baseAsset: "BTC",
        quoteAsset: "USDT",
        lastPrice: "50000",
        bestBid: "49999",
        bestAsk: "50001",
        change24hPercent: "2.04",
        high24h: "51000",
        low24h: "49000",
        volume24h: "1000",
        updatedAt: new Date().toISOString(),
        isStale: false,
      });

      // 0.001 BTC * $50,000 = $50 (below minimum)
      await expect(
        createWithdrawal(
          userId,
          {
            assetSymbol: "BTC",
            amount: "0.001",
            destination: "bc1qexternaladdress",
            transactionPin: "123456",
          },
          `test-min-btc-${Date.now()}`
        )
      ).rejects.toThrow("Minimum withdrawal is $100 USD equivalent");
    });

    it("allows BTC withdrawal at $100 equivalent (mocked price)", async () => {
      // Mock BTC price at $50,000
      vi.spyOn(bybitClient, "getTicker").mockResolvedValue({
        symbol: "BTCUSDT",
        baseAsset: "BTC",
        quoteAsset: "USDT",
        lastPrice: "50000",
        bestBid: "49999",
        bestAsk: "50001",
        change24hPercent: "2.04",
        high24h: "51000",
        low24h: "49000",
        volume24h: "1000",
        updatedAt: new Date().toISOString(),
        isStale: false,
      });

      // 0.002 BTC * $50,000 = $100
      const withdrawal = await createWithdrawal(
        userId,
        {
          assetSymbol: "BTC",
          amount: "0.002",
          destination: "bc1qexternaladdress",
          transactionPin: "123456",
        },
        `test-min-btc-${Date.now()}`
      );

      expect(withdrawal.status).toBe("PENDING");
    });

    it("allows BTC withdrawal above $100 equivalent (mocked price)", async () => {
      // Mock BTC price at $50,000
      vi.spyOn(bybitClient, "getTicker").mockResolvedValue({
        symbol: "BTCUSDT",
        baseAsset: "BTC",
        quoteAsset: "USDT",
        lastPrice: "50000",
        bestBid: "49999",
        bestAsk: "50001",
        change24hPercent: "2.04",
        high24h: "51000",
        low24h: "49000",
        volume24h: "1000",
        updatedAt: new Date().toISOString(),
        isStale: false,
      });

      // 0.01 BTC * $50,000 = $500
      const withdrawal = await createWithdrawal(
        userId,
        {
          assetSymbol: "BTC",
          amount: "0.01",
          destination: "bc1qexternaladdress",
          transactionPin: "123456",
        },
        `test-min-btc-${Date.now()}`
      );

      expect(withdrawal.status).toBe("PENDING");
    });

    it("fails safely when crypto pricing is unavailable", async () => {
      // Mock getTicker to fail
      vi.spyOn(bybitClient, "getTicker").mockRejectedValue(new Error("API unavailable"));

      await expect(
        createWithdrawal(
          userId,
          {
            assetSymbol: "BTC",
            amount: "1.0",
            destination: "bc1qexternaladdress",
            transactionPin: "123456",
          },
          `test-min-btc-fail-${Date.now()}`
        )
      ).rejects.toThrow("Unable to verify minimum withdrawal amount");

      // Verify no financial posting occurred
      const withdrawals = await prisma.withdrawal.findMany({ where: { userId } });
      expect(withdrawals.length).toBe(0);
    });
  });

  describe("USDT withdrawals (1:1 with USD)", () => {
    let walletId: string;

    beforeEach(async () => {
      const wallet = await prisma.cryptoWallet.create({
        data: { userId },
      });
      walletId = wallet.id;

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

    it("rejects USDT withdrawal below $100 (99.99 USDT)", async () => {
      await expect(
        createWithdrawal(
          userId,
          {
            assetSymbol: "USDT",
            amount: "99.99",
            destination: "0xexternaladdress",
            transactionPin: "123456",
          },
          `test-min-usdt-${Date.now()}`
        )
      ).rejects.toThrow("Minimum withdrawal is $100 USD equivalent");
    });

    it("allows USDT withdrawal of exactly $100", async () => {
      const withdrawal = await createWithdrawal(
        userId,
        {
          assetSymbol: "USDT",
          amount: "100.00",
          destination: "0xexternaladdress",
          transactionPin: "123456",
        },
        `test-min-usdt-${Date.now()}`
      );

      expect(withdrawal.status).toBe("PENDING");
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
