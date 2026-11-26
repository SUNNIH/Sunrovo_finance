import { describe, it, expect, beforeEach, vi } from "vitest";
import Decimal from "decimal.js";

// Mock dependencies before imports
vi.mock("@/lib/market/service", () => ({
  getMarketTicker: vi.fn(),
  getTradingInstruments: vi.fn(),
}));

vi.mock("@/lib/ledger/postLedgerEntries", () => ({
  postLedgerEntries: vi.fn(),
}));

vi.mock("@/lib/feature-flags", () => ({
  CRYPTO_TRADING_ENABLED: true,
}));

import { prisma } from "@/lib/db/prisma";
import { placeOrder, cancelOrder } from "@/features/crypto/trading";
import { getMarketTicker, getTradingInstruments } from "@/lib/market/service";
import { postLedgerEntries } from "@/lib/ledger/postLedgerEntries";

describe("Phase 4 Trading — Corrected Financial Implementation", () => {
  const testUserId = "user-123";
  const testWalletId = "wallet-123";

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    vi.mocked(getMarketTicker).mockResolvedValue({
      symbol: "BTCUSDT",
      lastPrice: new Decimal(60000),
      high24h: new Decimal(62000),
      low24h: new Decimal(58000),
      volume24h: new Decimal(1000),
      quoteVolume24h: new Decimal(60000000),
      priceChange24h: new Decimal(1000),
      priceChangePercent24h: new Decimal(1.69),
      status: "live",
      timestamp: new Date(),
    });

    vi.mocked(getTradingInstruments).mockResolvedValue([
      {
        symbol: "BTCUSDT",
        baseAsset: "BTC",
        quoteAsset: "USDT",
        status: "active",
        pricePrecision: 2,
        quantityPrecision: 6,
        minOrderQuantity: new Decimal(0.0001),
        maxOrderQuantity: new Decimal(100),
        minOrderValue: new Decimal(10),
        maxOrderValue: new Decimal(1000000),
        tickSize: new Decimal(0.01),
      },
    ]);

    vi.mocked(postLedgerEntries).mockResolvedValue({ groupId: "ledger-group-123" });
  });

  describe("Defect 1: Balanced Ledger Entries Per Asset", () => {
    it("should create balanced BTC and USDT ledger entries for BUY market order", async () => {
      const mockWallet = {
        id: testWalletId,
        userId: testUserId,
        label: "Spot Wallet",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockBalance = {
        id: "bal-usdt",
        walletId: testWalletId,
        assetSymbol: "USDT",
        available: new Decimal(10000),
        locked: new Decimal(0),
        updatedAt: new Date(),
      };

      const mockLedgerAccount = {
        id: "ledger-usdt",
        type: "ASSET" as const,
        assetSymbol: "USDT",
        name: "Spot Wallet — USDT",
        bankAccountId: null,
        cryptoWalletId: testWalletId,
        createdAt: new Date(),
      };

      vi.spyOn(prisma.cryptoOrder, "findUnique").mockResolvedValue(null);
      vi.spyOn(prisma.cryptoWallet, "findFirst").mockResolvedValue(mockWallet);

      const mockTransaction = vi.fn(async (callback) => {
        return callback({
          cryptoWallet: {
            findFirst: vi.fn().mockResolvedValue(mockWallet),
          },
          assetBalance: {
            findUnique: vi.fn().mockResolvedValue(mockBalance),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn().mockResolvedValue(mockBalance),
            create: vi.fn().mockResolvedValue(mockBalance),
          },
          ledgerAccount: {
            findFirst: vi.fn().mockResolvedValue(mockLedgerAccount),
            create: vi.fn().mockResolvedValue(mockLedgerAccount),
          },
          cryptoOrder: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: "order-123",
              userId: testUserId,
              symbol: "BTCUSDT",
              side: "BUY",
              type: "MARKET",
              quantity: new Decimal(0.1),
              limitPrice: null,
              filledPrice: new Decimal(60000),
              feeAmount: new Decimal(0.0001),
              status: "FILLED",
              idempotencyKey: "test-key",
              ledgerGroupId: "ledger-group-123",
              createdAt: new Date(),
              filledAt: new Date(),
              cancelledAt: null,
            }),
          },
          auditLog: {
            create: vi.fn(),
          },
        });
      });

      vi.spyOn(prisma, "$transaction").mockImplementation(mockTransaction as any);

      const result = await placeOrder({
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: "0.1",
        idempotencyKey: "test-key",
      });

      expect(result.success).toBe(true);
      expect(postLedgerEntries).toHaveBeenCalledWith(expect.anything(), expect.any(Array));

      // Verify balanced legs were passed
      const calls = vi.mocked(postLedgerEntries).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const legs = calls[0]![1];
      
      // Group by asset
      const btcLegs = legs.filter((l: any) => l.assetSymbol === "BTC");
      const usdtLegs = legs.filter((l: any) => l.assetSymbol === "USDT");

      // BTC must be balanced
      const btcDebits = btcLegs
        .filter((l: any) => l.direction === "DEBIT")
        .reduce((sum: Decimal, l: any) => sum.plus(l.amount), new Decimal(0));
      const btcCredits = btcLegs
        .filter((l: any) => l.direction === "CREDIT")
        .reduce((sum: Decimal, l: any) => sum.plus(l.amount), new Decimal(0));

      expect(btcDebits.toString()).toBe(btcCredits.toString());

      // USDT must be balanced
      const usdtDebits = usdtLegs
        .filter((l: any) => l.direction === "DEBIT")
        .reduce((sum: Decimal, l: any) => sum.plus(l.amount), new Decimal(0));
      const usdtCredits = usdtLegs
        .filter((l: any) => l.direction === "CREDIT")
        .reduce((sum: Decimal, l: any) => sum.plus(l.amount), new Decimal(0));

      expect(usdtDebits.toString()).toBe(usdtCredits.toString());
    });
  });

  describe("Defect 2: Platform Counterparty Accounts", () => {
    it("should use cryptoInventoryPoolName and tradingSettlementPoolName", async () => {
      const mockWallet = {
        id: testWalletId,
        userId: testUserId,
        label: "Spot Wallet",
        createdAt: new Date(),
      };

      vi.spyOn(prisma.cryptoOrder, "findUnique").mockResolvedValue(null);

      const mockTransaction = vi.fn(async (callback) => {
        return callback({
          cryptoWallet: {
            findFirst: vi.fn().mockResolvedValue(mockWallet),
          },
          assetBalance: {
            findUnique: vi.fn().mockResolvedValue({
              id: "bal-1",
              available: new Decimal(10000),
              locked: new Decimal(0),
            }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn(),
            create: vi.fn().mockResolvedValue({
              id: "bal-1",
              available: new Decimal(0),
              locked: new Decimal(0),
            }),
          },
          ledgerAccount: {
            findFirst: vi.fn((params: any) => {
              // Return platform accounts for inventory and settlement
              if (params.where?.name?.includes("Crypto Inventory")) {
                return Promise.resolve({ id: "inventory-pool", type: "ASSET" });
              }
              if (params.where?.name?.includes("Trading Settlement")) {
                return Promise.resolve({ id: "settlement-pool", type: "ASSET" });
              }
              if (params.where?.name?.includes("Fee Revenue")) {
                return Promise.resolve({ id: "fee-pool", type: "REVENUE" });
              }
              return Promise.resolve({ id: "user-ledger", type: "ASSET" });
            }),
            create: vi.fn((data: any) => {
              return Promise.resolve({ id: "created-account", ...data });
            }),
          },
          cryptoOrder: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: "order-123",
              status: "FILLED",
            }),
          },
          auditLog: {
            create: vi.fn(),
          },
        });
      });

      vi.spyOn(prisma, "$transaction").mockImplementation(mockTransaction as any);

      await placeOrder({
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: "0.1",
        idempotencyKey: "test-platform-accounts",
      });

      // Verify ledger entries reference platform accounts
      const calls = vi.mocked(postLedgerEntries).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const legs = calls[0]![1];
      const accountIds = legs.map((l: any) => l.ledgerAccountId);

      // Should include platform inventory/settlement pools
      expect(accountIds).toContain("inventory-pool");
      expect(accountIds).toContain("settlement-pool");
      expect(accountIds).toContain("fee-pool");
    });
  });

  describe("Defect 3: Concurrency-Safe Balance Updates", () => {
    it("should reject concurrent orders exceeding available balance", async () => {
      const mockWallet = { id: testWalletId, userId: testUserId, label: "Spot", createdAt: new Date(), updatedAt: new Date() };

      vi.spyOn(prisma.cryptoOrder, "findUnique").mockResolvedValue(null);

      const mockTransaction = vi.fn(async (callback) => {
        return callback({
          cryptoWallet: {
            findFirst: vi.fn().mockResolvedValue(mockWallet),
          },
          assetBalance: {
            findUnique: vi.fn().mockResolvedValue({
              id: "bal-1",
              available: new Decimal(5000), // Enough for first check
              locked: new Decimal(0),
            }),
            updateMany: vi.fn().mockResolvedValue({ count: 0 }), // Simulate concurrent depletion
            update: vi.fn(),
            create: vi.fn(),
          },
          ledgerAccount: {
            findFirst: vi.fn().mockResolvedValue({ id: "ledger-1", type: "ASSET" }),
            create: vi.fn(),
          },
          cryptoOrder: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn(),
          },
          auditLog: {
            create: vi.fn(),
          },
        });
      });

      vi.spyOn(prisma, "$transaction").mockImplementation(mockTransaction as any);

      const result = await placeOrder({
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: "0.1",
        idempotencyKey: "test-concurrent",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Insufficient");
    });
  });

  describe("Defect 4: Atomic Order Cancellation", () => {
    it("should prevent double-cancellation with updateMany status guard", async () => {
      const mockOrder = {
        id: "order-cancel",
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY" as const,
        type: "LIMIT" as const,
        quantity: new Decimal(0.1),
        limitPrice: new Decimal(59000),
        stopPrice: null,
        filledPrice: null,
        feeAmount: new Decimal(0),
        status: "OPEN" as const,
        idempotencyKey: "key-cancel",
        ledgerGroupId: null,
        createdAt: new Date(),
        filledAt: null,
        cancelledAt: null,
        takeProfitPrice: null,
        exitTrigger: null,
        parentOrderId: null,
      };

      vi.spyOn(prisma.cryptoOrder, "findUnique").mockResolvedValue(mockOrder);

      const mockTransaction = vi.fn(async (callback) => {
        return callback({
          cryptoOrder: {
            findUnique: vi.fn().mockResolvedValue(mockOrder),
            updateMany: vi.fn().mockResolvedValue({ count: 0 }), // Already cancelled
          },
          cryptoWallet: {
            findFirst: vi.fn().mockResolvedValue({ id: testWalletId, userId: testUserId }),
          },
          assetBalance: {
            findUnique: vi.fn().mockResolvedValue({
              id: "bal-1",
              locked: new Decimal(5900),
            }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          auditLog: {
            create: vi.fn(),
          },
        });
      });

      vi.spyOn(prisma, "$transaction").mockImplementation(mockTransaction as any);

      const result = await cancelOrder({
        userId: testUserId,
        orderId: "order-cancel",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("already cancelled or filled");
    });
  });

  describe("Defect 5: Idempotency with Ownership Validation", () => {
    it("should reject idempotency key reuse by different user", async () => {
      const existingOrder = {
        id: "existing-order",
        userId: "other-user-456",
        symbol: "BTCUSDT",
        side: "BUY" as const,
        type: "MARKET" as const,
        quantity: new Decimal(0.1),
        limitPrice: null,
        stopPrice: null,
        filledPrice: new Decimal(60000),
        feeAmount: new Decimal(0.0001),
        status: "FILLED" as const,
        idempotencyKey: "duplicate-key",
        ledgerGroupId: "ledger-123",
        createdAt: new Date(),
        filledAt: new Date(),
        cancelledAt: null,
        takeProfitPrice: null,
        exitTrigger: null,
        parentOrderId: null,
      };

      vi.spyOn(prisma.cryptoOrder, "findUnique").mockResolvedValue(existingOrder);

      const result = await placeOrder({
        userId: testUserId, // Different user
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: "0.1",
        idempotencyKey: "duplicate-key",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("already used by another user");
    });

    it("should return existing order for same user with same idempotency key", async () => {
      const existingOrder = {
        id: "existing-order",
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY" as const,
        type: "MARKET" as const,
        quantity: new Decimal(0.1),
        limitPrice: null,
        stopPrice: null,
        filledPrice: new Decimal(60000),
        feeAmount: new Decimal(0.0001),
        status: "FILLED" as const,
        idempotencyKey: "same-key",
        ledgerGroupId: "ledger-123",
        createdAt: new Date(),
        filledAt: new Date(),
        cancelledAt: null,
        takeProfitPrice: null,
        exitTrigger: null,
        parentOrderId: null,
      };

      vi.spyOn(prisma.cryptoOrder, "findUnique").mockResolvedValue(existingOrder);

      const result = await placeOrder({
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: "0.1",
        idempotencyKey: "same-key",
      });

      expect(result.success).toBe(true);
      expect(result.orderId).toBe("existing-order");
    });
  });

  describe("Defect 6: Instrument and Precision Validation", () => {
    it("should reject unsupported trading pair", async () => {
      vi.mocked(getTradingInstruments).mockResolvedValue([]);

      const result = await placeOrder({
        userId: testUserId,
        symbol: "FAKECOIN",
        side: "BUY",
        type: "MARKET",
        quantity: "1.0",
        idempotencyKey: "test-unsupported",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid trading pair");
    });

    it("should reject quantity exceeding precision", async () => {
      const result = await placeOrder({
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: "0.1234567", // 7 decimals, max is 6
        idempotencyKey: "test-precision",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("precision exceeds maximum");
    });

    it("should reject quantity below minimum", async () => {
      const result = await placeOrder({
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: "0.00001", // Below 0.0001 minimum
        idempotencyKey: "test-min",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("below minimum");
    });

    it("should reject non-finite quantity", async () => {
      const result = await placeOrder({
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: "Infinity",
        idempotencyKey: "test-infinity",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("positive finite number");
    });
  });
});
