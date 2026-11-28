import { describe, it, expect, beforeEach, vi } from "vitest";
import Decimal from "decimal.js";
import type { Prisma } from "@prisma/client";

// Mock dependencies (must be hoisted before imports)
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

// Fail closed: these unit tests must never fall through to a real database.
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    cryptoOrder: { findUnique: vi.fn(), findFirst: vi.fn() },
    cryptoWallet: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db/prisma";
import { placeOrder, cancelOrder } from "@/features/crypto/trading";
import { getMarketTicker, getTradingInstruments } from "@/lib/market/service";
import { postLedgerEntries } from "@/lib/ledger/postLedgerEntries";

type TransactionCallback = Parameters<typeof prisma.$transaction>[0];

describe("Simulated Cryptocurrency Trading", () => {
  const testUserId = "test-user-123";
  const testWalletId = "test-wallet-123";

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.cryptoOrder.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.cryptoOrder.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.cryptoWallet.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Error("Unexpected database transaction in unit test")
    );
    
    // Set up default market ticker mock
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

    // Set up trading instruments mock
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

    // Set up ledger posting mock
    vi.mocked(postLedgerEntries).mockResolvedValue({ groupId: "ledger-group-123" });
  });

  describe("placeOrder - Market Orders", () => {
    it("should place a BUY market order and debit USDT, credit BTC", async () => {
      // Mock wallet with USDT balance
      const mockWallet = {
        id: testWalletId,
        userId: testUserId,
        label: "Spot Wallet",
        createdAt: new Date(),
        updatedAt: new Date(),
        balances: [
          {
            id: "bal-1",
            walletId: testWalletId,
            assetSymbol: "USDT",
            available: new Decimal(10000),
            locked: new Decimal(0),
          },
        ],
      };

      vi.mocked(prisma.cryptoOrder.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.cryptoWallet.findFirst).mockResolvedValue(mockWallet);
      
      const mockTransaction = vi.fn(async (callback: TransactionCallback) => {
        return callback({
          cryptoWallet: {
            findFirst: vi.fn().mockResolvedValue(mockWallet),
          },
          ledgerAccount: {
            findFirst: vi.fn().mockResolvedValue({ id: "ledger-123", type: "ASSET" }),
            create: vi.fn().mockResolvedValue({ id: "ledger-123", type: "ASSET" }),
          },
          assetBalance: {
            findFirst: vi.fn().mockResolvedValue({
              id: "bal-1",
              available: new Decimal(10000),
              locked: new Decimal(0),
            }),
            findUnique: vi.fn().mockResolvedValue({
              id: "bal-1",
              available: new Decimal(10000),
              locked: new Decimal(0),
            }),
            create: vi.fn().mockResolvedValue({
              id: "bal-1",
              available: new Decimal(0),
              locked: new Decimal(0),
            }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn(),
          },
          ledgerEntry: {
            create: vi.fn(),
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
        } as unknown as Prisma.TransactionClient);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      const result = await placeOrder({
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: "0.1",
        idempotencyKey: "test-key-1",
      });

      expect(result.success).toBe(true);
      expect(result.orderId).toBe("order-123");
    });

    it("should place a SELL market order and debit BTC, credit USDT", async () => {
      const mockWallet = {
        id: testWalletId,
        userId: testUserId,
        label: "Spot Wallet",
        createdAt: new Date(),
        updatedAt: new Date(),
        balances: [
          {
            id: "bal-1",
            walletId: testWalletId,
            assetSymbol: "BTC",
            available: new Decimal(1),
            locked: new Decimal(0),
          },
        ],
      };

      vi.mocked(prisma.cryptoOrder.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.cryptoWallet.findFirst).mockResolvedValue(mockWallet);
      
      const mockTransaction = vi.fn(async (callback: TransactionCallback) => {
        return callback({
          cryptoWallet: {
            findFirst: vi.fn().mockResolvedValue(mockWallet),
          },
          ledgerAccount: {
            findFirst: vi.fn().mockResolvedValue({ id: "ledger-123", type: "ASSET" }),
            create: vi.fn().mockResolvedValue({ id: "ledger-123", type: "ASSET" }),
          },
          assetBalance: {
            findFirst: vi.fn().mockResolvedValue({
              id: "bal-1",
              available: new Decimal(1),
              locked: new Decimal(0),
            }),
            findUnique: vi.fn().mockResolvedValue({
              id: "bal-1",
              available: new Decimal(1),
              locked: new Decimal(0),
            }),
            create: vi.fn().mockResolvedValue({
              id: "bal-1",
              available: new Decimal(0),
              locked: new Decimal(0),
            }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn(),
          },
          ledgerEntry: {
            create: vi.fn(),
          },
          cryptoOrder: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: "order-456",
              status: "FILLED",
            }),
          },
          auditLog: {
            create: vi.fn(),
          },
        } as unknown as Prisma.TransactionClient);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      const result = await placeOrder({
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "SELL",
        type: "MARKET",
        quantity: "0.1",
        idempotencyKey: "test-key-2",
      });

      expect(result.success).toBe(true);
      expect(result.orderId).toBe("order-456");
    });

    it("should reject market order with insufficient balance", async () => {
      const mockWallet = {
        id: testWalletId,
        userId: testUserId,
        label: "Spot Wallet",
        createdAt: new Date(),
        updatedAt: new Date(),
        balances: [
          {
            id: "bal-1",
            walletId: testWalletId,
            assetSymbol: "USDT",
            available: new Decimal(100), // Not enough for 1 BTC at 60000
            locked: new Decimal(0),
          },
        ],
      };

      vi.mocked(prisma.cryptoOrder.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.cryptoWallet.findFirst).mockResolvedValue(mockWallet);

      const mockTransaction = vi.fn(async (callback: TransactionCallback) => {
        return callback({
          cryptoWallet: {
            findFirst: vi.fn().mockResolvedValue(mockWallet),
          },
          ledgerAccount: {
            findFirst: vi.fn().mockResolvedValue({ id: "ledger-123", type: "ASSET" }),
            create: vi.fn().mockResolvedValue({ id: "ledger-123", type: "ASSET" }),
          },
          assetBalance: {
            findFirst: vi.fn().mockResolvedValue({
              id: "bal-1",
              available: new Decimal(100),
              locked: new Decimal(0),
            }),
            findUnique: vi.fn().mockResolvedValue({
              id: "bal-1",
              available: new Decimal(100),
              locked: new Decimal(0),
            }),
            create: vi.fn().mockResolvedValue({
              id: "bal-1",
              available: new Decimal(0),
              locked: new Decimal(0),
            }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn(),
          },
          ledgerEntry: {
            create: vi.fn(),
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
        } as unknown as Prisma.TransactionClient);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      const result = await placeOrder({
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: "1.0",
        idempotencyKey: "test-key-3",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Insufficient");
      expect(result.error).toContain("Available: 100");
      expect(postLedgerEntries).not.toHaveBeenCalled();
    });
  });

  describe("placeOrder - Limit Orders", () => {
    it("should place a BUY limit order and lock USDT", async () => {
      const mockWallet = {
        id: testWalletId,
        userId: testUserId,
        label: "Spot Wallet",
        createdAt: new Date(),
        updatedAt: new Date(),
        balances: [
          {
            id: "bal-1",
            walletId: testWalletId,
            assetSymbol: "USDT",
            available: new Decimal(10000),
            locked: new Decimal(0),
          },
        ],
      };

      vi.mocked(prisma.cryptoOrder.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.cryptoWallet.findFirst).mockResolvedValue(mockWallet);
      
      const mockTransaction = vi.fn(async (callback: TransactionCallback) => {
        return callback({
          cryptoWallet: {
            findFirst: vi.fn().mockResolvedValue(mockWallet),
          },
          ledgerAccount: {
            findFirst: vi.fn().mockResolvedValue({ id: "ledger-123", type: "ASSET" }),
            create: vi.fn().mockResolvedValue({ id: "ledger-123", type: "ASSET" }),
          },
          assetBalance: {
            findFirst: vi.fn().mockResolvedValue({
              id: "bal-1",
              available: new Decimal(10000),
              locked: new Decimal(0),
            }),
            findUnique: vi.fn().mockResolvedValue({
              id: "bal-1",
              available: new Decimal(10000),
              locked: new Decimal(0),
            }),
            create: vi.fn().mockResolvedValue({
              id: "bal-1",
              available: new Decimal(0),
              locked: new Decimal(0),
            }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            update: vi.fn(),
          },
          cryptoOrder: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: "order-789",
              status: "OPEN",
            }),
          },
          auditLog: {
            create: vi.fn(),
          },
        } as unknown as Prisma.TransactionClient);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      const result = await placeOrder({
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "LIMIT",
        quantity: "0.1",
        limitPrice: "59000",
        idempotencyKey: "test-key-4",
      });

      expect(result.success).toBe(true);
      expect(result.orderId).toBe("order-789");
    });

    it("should reject limit order without limit price", async () => {
      const result = await placeOrder({
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "LIMIT",
        quantity: "0.1",
        idempotencyKey: "test-key-5",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Limit price required");
    });
  });

  describe("placeOrder - Idempotency", () => {
    it("should return existing order on duplicate idempotency key", async () => {
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
        feeAmount: new Decimal(0.006),
        status: "FILLED" as const,
        idempotencyKey: "duplicate-key",
        ledgerGroupId: "ledger-group-123",
        createdAt: new Date(),
        filledAt: new Date(),
        cancelledAt: null,
        takeProfitPrice: null,
        exitTrigger: null,
        parentOrderId: null,
      };

      vi.mocked(prisma.cryptoOrder.findUnique).mockResolvedValue(existingOrder);

      const result = await placeOrder({
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: "0.1",
        idempotencyKey: "duplicate-key",
      });

      expect(result.success).toBe(true);
      expect(result.orderId).toBe("existing-order");
      expect(result.filledPrice).toBe("60000");
    });
  });

  describe("cancelOrder", () => {
    it("should cancel an OPEN order and release locked funds", async () => {
      const mockOrder = {
        id: "order-cancel-1",
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
        idempotencyKey: "key-cancel-1",
        ledgerGroupId: null,
        createdAt: new Date(),
        filledAt: null,
        cancelledAt: null,
        takeProfitPrice: null,
        exitTrigger: null,
        parentOrderId: null,
      };

      const mockWallet = {
        id: testWalletId,
        userId: testUserId,
        label: "Spot Wallet",
        createdAt: new Date(),
        updatedAt: new Date(),
        balances: [
          {
            id: "bal-1",
            assetSymbol: "USDT",
            available: new Decimal(0),
            locked: new Decimal(5900), // 0.1 BTC * 59000 USDT
          },
        ],
      };

      vi.mocked(prisma.cryptoOrder.findUnique).mockResolvedValue(mockOrder);
      vi.mocked(prisma.cryptoWallet.findFirst).mockResolvedValue(mockWallet);
      
      const mockTransaction = vi.fn(async (callback: TransactionCallback) => {
        return callback({
          cryptoOrder: {
            findUnique: vi.fn().mockResolvedValue(mockOrder),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
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
        } as unknown as Prisma.TransactionClient);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      const result = await cancelOrder({
        userId: testUserId,
        orderId: "order-cancel-1",
      });

      expect(result.success).toBe(true);
    });

    it("should reject cancellation of non-OPEN orders", async () => {
      const mockFilledOrder = {
        id: "order-filled",
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY" as const,
        type: "LIMIT" as const,
        quantity: new Decimal(0.1),
        limitPrice: new Decimal(59000),
        stopPrice: null,
        filledPrice: new Decimal(59000),
        feeAmount: new Decimal(0.0001),
        status: "FILLED" as const,
        idempotencyKey: "key-filled",
        ledgerGroupId: "group-123",
        createdAt: new Date(),
        filledAt: new Date(),
        cancelledAt: null,
        takeProfitPrice: null,
        exitTrigger: null,
        parentOrderId: null,
      };

      const mockTransaction = vi.fn(async (callback: TransactionCallback) => {
        return callback({
          cryptoOrder: {
            findUnique: vi.fn().mockResolvedValue(mockFilledOrder),
          },
        } as unknown as Prisma.TransactionClient);
      });

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      const result = await cancelOrder({
        userId: testUserId,
        orderId: "order-filled",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot cancel");
    });

    it("should reject cancellation by non-owner", async () => {
      const mockOrder = {
        id: "order-other-user",
        userId: "other-user-456",
        symbol: "BTCUSDT",
        side: "BUY" as const,
        type: "LIMIT" as const,
        quantity: new Decimal(0.1),
        limitPrice: new Decimal(59000),
        stopPrice: null,
        filledPrice: null,
        feeAmount: new Decimal(0),
        status: "OPEN" as const,
        idempotencyKey: "key-other",
        ledgerGroupId: null,
        createdAt: new Date(),
        filledAt: null,
        cancelledAt: null,
        takeProfitPrice: null,
        exitTrigger: null,
        parentOrderId: null,
      };

      const mockTransaction = vi.fn(async (callback: TransactionCallback) => {
        return callback({
          cryptoOrder: {
            findUnique: vi.fn().mockResolvedValue(mockOrder),
          },
        } as unknown as Prisma.TransactionClient);
      });

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      const result = await cancelOrder({
        userId: testUserId,
        orderId: "order-other-user",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Not authorized");
    });
  });

  describe("Input Validation", () => {
    it("should reject negative quantity", async () => {
      const result = await placeOrder({
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: "-0.5",
        idempotencyKey: "test-negative",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("positive");
    });

    it("should reject invalid trading pair", async () => {
      vi.mocked(prisma.cryptoOrder.findUnique).mockResolvedValue(null);

      const result = await placeOrder({
        userId: testUserId,
        symbol: "INVALID",
        side: "BUY",
        type: "MARKET",
        quantity: "1.0",
        idempotencyKey: "test-invalid-pair",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid trading pair");
    });
  });
});
