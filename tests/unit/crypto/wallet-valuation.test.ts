import { describe, it, expect, vi, beforeEach } from "vitest";
import { getWalletForUser } from "@/features/crypto/wallets";
import { prisma } from "@/lib/db/prisma";
import { getMultipleMarketTickers } from "@/lib/market/service";
import Decimal from "decimal.js";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    cryptoWallet: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/market/service");

describe("Wallet Market Valuation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Empty Wallet", () => {
    it("returns null when user has no wallet", async () => {
      vi.mocked(prisma.cryptoWallet.findFirst).mockResolvedValue(null);

      const result = await getWalletForUser("user-123");

      expect(result).toBeNull();
    });

    it("returns empty assets when all balances are zero", async () => {
      vi.mocked(prisma.cryptoWallet.findFirst).mockResolvedValue({
        id: "wallet-1",
        userId: "user-123",
        label: "Spot Wallet",
        createdAt: new Date(),
        updatedAt: new Date(),
        balances: [
          {
            id: "bal-1",
            walletId: "wallet-1",
            assetSymbol: "BTC",
            available: new Decimal(0),
            locked: new Decimal(0),
            updatedAt: new Date(),
          },
        ],
      } as any);

      const result = await getWalletForUser("user-123");

      expect(result).toEqual({
        walletId: "wallet-1",
        assets: [],
        totalUsdtValue: null,
        hasIncompleteValuation: false,
      });
    });
  });

  describe("USDT Holdings", () => {
    it("values USDT at 1:1 without market lookup", async () => {
      vi.mocked(prisma.cryptoWallet.findFirst).mockResolvedValue({
        id: "wallet-1",
        userId: "user-123",
        label: "Spot Wallet",
        createdAt: new Date(),
        updatedAt: new Date(),
        balances: [
          {
            id: "bal-1",
            walletId: "wallet-1",
            assetSymbol: "USDT",
            available: new Decimal("1000.50"),
            locked: new Decimal("0"),
            updatedAt: new Date(),
          },
        ],
      } as any);

      vi.mocked(getMultipleMarketTickers).mockResolvedValue(new Map());

      const result = await getWalletForUser("user-123");

      expect(result).toBeDefined();
      expect(result!.assets).toHaveLength(1);
      expect(result!.assets[0]).toMatchObject({
        assetSymbol: "USDT",
        available: "1000.5",
        usdtPrice: "1.0",
        usdtValue: "1000.5",
        priceStatus: "live",
      });
      expect(result!.totalUsdtValue).toBe("1000.5");
      expect(result!.hasIncompleteValuation).toBe(false);
    });
  });

  describe("Live Market Prices", () => {
    it("calculates values using live Bybit prices", async () => {
      vi.mocked(prisma.cryptoWallet.findFirst).mockResolvedValue({
        id: "wallet-1",
        userId: "user-123",
        label: "Spot Wallet",
        createdAt: new Date(),
        updatedAt: new Date(),
        balances: [
          {
            id: "bal-1",
            walletId: "wallet-1",
            assetSymbol: "BTC",
            available: new Decimal("0.5"),
            locked: new Decimal("0"),
            updatedAt: new Date(),
          },
          {
            id: "bal-2",
            walletId: "wallet-1",
            assetSymbol: "ETH",
            available: new Decimal("10"),
            locked: new Decimal("0"),
            updatedAt: new Date(),
          },
        ],
      } as any);

      vi.mocked(getMultipleMarketTickers).mockResolvedValue(
        new Map([
          [
            "BTCUSDT",
            {
              symbol: "BTCUSDT",
              lastPrice: new Decimal("60000"),
              priceChange24h: new Decimal("1000"),
              priceChangePercent24h: new Decimal("1.69"),
              high24h: new Decimal("61000"),
              low24h: new Decimal("59000"),
              volume24h: new Decimal("1000"),
              quoteVolume24h: new Decimal("60000000"),
              status: "live",
            } as any,
          ],
          [
            "ETHUSDT",
            {
              symbol: "ETHUSDT",
              lastPrice: new Decimal("3000"),
              priceChange24h: new Decimal("50"),
              priceChangePercent24h: new Decimal("1.69"),
              high24h: new Decimal("3100"),
              low24h: new Decimal("2900"),
              volume24h: new Decimal("5000"),
              quoteVolume24h: new Decimal("15000000"),
              status: "live",
            } as any,
          ],
        ])
      );

      const result = await getWalletForUser("user-123");

      expect(result).toBeDefined();
      expect(result!.assets).toHaveLength(2);

      // BTC: 0.5 * 60000 = 30000
      expect(result!.assets[0]).toMatchObject({
        assetSymbol: "BTC",
        available: "0.5",
        usdtPrice: "60000",
        usdtValue: "30000",
        priceStatus: "live",
      });

      // ETH: 10 * 3000 = 30000
      expect(result!.assets[1]).toMatchObject({
        assetSymbol: "ETH",
        available: "10",
        usdtPrice: "3000",
        usdtValue: "30000",
        priceStatus: "live",
      });

      // Total: 30000 + 30000 = 60000
      expect(result!.totalUsdtValue).toBe("60000");
      expect(result!.hasIncompleteValuation).toBe(false);
    });
  });

  describe("Locked Balances", () => {
    it("includes locked balances in total value calculation", async () => {
      vi.mocked(prisma.cryptoWallet.findFirst).mockResolvedValue({
        id: "wallet-1",
        userId: "user-123",
        label: "Spot Wallet",
        createdAt: new Date(),
        updatedAt: new Date(),
        balances: [
          {
            id: "bal-1",
            walletId: "wallet-1",
            assetSymbol: "BTC",
            available: new Decimal("0.3"),
            locked: new Decimal("0.2"),
            updatedAt: new Date(),
          },
        ],
      } as any);

      vi.mocked(getMultipleMarketTickers).mockResolvedValue(
        new Map([
          [
            "BTCUSDT",
            {
              symbol: "BTCUSDT",
              lastPrice: new Decimal("60000"),
              status: "live",
            } as any,
          ],
        ])
      );

      const result = await getWalletForUser("user-123");

      expect(result).toBeDefined();
      expect(result!.assets[0]).toMatchObject({
        assetSymbol: "BTC",
        available: "0.3",
        locked: "0.2",
        usdtPrice: "60000",
        usdtValue: "30000", // (0.3 + 0.2) * 60000
        priceStatus: "live",
      });
    });
  });

  describe("Stale Prices", () => {
    it("marks assets with stale prices and excludes from portfolio total", async () => {
      vi.mocked(prisma.cryptoWallet.findFirst).mockResolvedValue({
        id: "wallet-1",
        userId: "user-123",
        label: "Spot Wallet",
        createdAt: new Date(),
        updatedAt: new Date(),
        balances: [
          {
            id: "bal-1",
            walletId: "wallet-1",
            assetSymbol: "BTC",
            available: new Decimal("1"),
            locked: new Decimal("0"),
            updatedAt: new Date(),
          },
          {
            id: "bal-2",
            walletId: "wallet-1",
            assetSymbol: "ETH",
            available: new Decimal("10"),
            locked: new Decimal("0"),
            updatedAt: new Date(),
          },
        ],
      } as any);

      vi.mocked(getMultipleMarketTickers).mockResolvedValue(
        new Map([
          [
            "BTCUSDT",
            {
              symbol: "BTCUSDT",
              lastPrice: new Decimal("60000"),
              status: "live",
            } as any,
          ],
          [
            "ETHUSDT",
            {
              symbol: "ETHUSDT",
              lastPrice: new Decimal("3000"),
              status: "stale",
            } as any,
          ],
        ])
      );

      const result = await getWalletForUser("user-123");

      expect(result).toBeDefined();
      expect(result!.assets[0]).toMatchObject({
        assetSymbol: "BTC",
        priceStatus: "live",
      });
      expect(result!.assets[1]).toMatchObject({
        assetSymbol: "ETH",
        usdtPrice: "3000",
        usdtValue: "30000",
        priceStatus: "stale",
      });

      // Total only includes live prices
      expect(result!.totalUsdtValue).toBeNull();
      expect(result!.hasIncompleteValuation).toBe(true);
    });
  });

  describe("Unavailable Prices", () => {
    it("marks assets without prices as unavailable", async () => {
      vi.mocked(prisma.cryptoWallet.findFirst).mockResolvedValue({
        id: "wallet-1",
        userId: "user-123",
        label: "Spot Wallet",
        createdAt: new Date(),
        updatedAt: new Date(),
        balances: [
          {
            id: "bal-1",
            walletId: "wallet-1",
            assetSymbol: "BTC",
            available: new Decimal("0.5"),
            locked: new Decimal("0"),
            updatedAt: new Date(),
          },
        ],
      } as any);

      // Market data unavailable
      vi.mocked(getMultipleMarketTickers).mockResolvedValue(new Map());

      const result = await getWalletForUser("user-123");

      expect(result).toBeDefined();
      expect(result!.assets[0]).toMatchObject({
        assetSymbol: "BTC",
        available: "0.5",
        usdtPrice: null,
        usdtValue: null,
        priceStatus: "unavailable",
      });
      expect(result!.totalUsdtValue).toBeNull();
      expect(result!.hasIncompleteValuation).toBe(true);
    });

    it("continues showing native balances when Bybit is offline", async () => {
      vi.mocked(prisma.cryptoWallet.findFirst).mockResolvedValue({
        id: "wallet-1",
        userId: "user-123",
        label: "Spot Wallet",
        createdAt: new Date(),
        updatedAt: new Date(),
        balances: [
          {
            id: "bal-1",
            walletId: "wallet-1",
            assetSymbol: "BTC",
            available: new Decimal("2.5"),
            locked: new Decimal("0.5"),
            updatedAt: new Date(),
          },
        ],
      } as any);

      // Complete Bybit failure
      vi.mocked(getMultipleMarketTickers).mockRejectedValue(
        new Error("Bybit unavailable")
      );

      const result = await getWalletForUser("user-123");

      expect(result).toBeDefined();
      expect(result!.assets[0]).toMatchObject({
        assetSymbol: "BTC",
        available: "2.5",
        locked: "0.5",
        usdtPrice: null,
        usdtValue: null,
        priceStatus: "unavailable",
      });
      expect(result!.hasIncompleteValuation).toBe(true);
    });
  });

  describe("Mixed Portfolio", () => {
    it("handles USDT + crypto with live prices", async () => {
      vi.mocked(prisma.cryptoWallet.findFirst).mockResolvedValue({
        id: "wallet-1",
        userId: "user-123",
        label: "Spot Wallet",
        createdAt: new Date(),
        updatedAt: new Date(),
        balances: [
          {
            id: "bal-1",
            walletId: "wallet-1",
            assetSymbol: "USDT",
            available: new Decimal("5000"),
            locked: new Decimal("0"),
            updatedAt: new Date(),
          },
          {
            id: "bal-2",
            walletId: "wallet-1",
            assetSymbol: "BTC",
            available: new Decimal("0.1"),
            locked: new Decimal("0"),
            updatedAt: new Date(),
          },
        ],
      } as any);

      vi.mocked(getMultipleMarketTickers).mockResolvedValue(
        new Map([
          [
            "BTCUSDT",
            {
              symbol: "BTCUSDT",
              lastPrice: new Decimal("60000"),
              status: "live",
            } as any,
          ],
        ])
      );

      const result = await getWalletForUser("user-123");

      expect(result).toBeDefined();
      expect(result!.assets).toHaveLength(2);

      // USDT: 5000
      expect(result!.assets[0]).toMatchObject({
        assetSymbol: "USDT",
        usdtValue: "5000",
        priceStatus: "live",
      });

      // BTC: 0.1 * 60000 = 6000
      expect(result!.assets[1]).toMatchObject({
        assetSymbol: "BTC",
        usdtValue: "6000",
        priceStatus: "live",
      });

      // Total: 5000 + 6000 = 11000
      expect(result!.totalUsdtValue).toBe("11000");
      expect(result!.hasIncompleteValuation).toBe(false);
    });
  });

  describe("Decimal Precision", () => {
    it("maintains precision for small balances and prices", async () => {
      vi.mocked(prisma.cryptoWallet.findFirst).mockResolvedValue({
        id: "wallet-1",
        userId: "user-123",
        label: "Spot Wallet",
        createdAt: new Date(),
        updatedAt: new Date(),
        balances: [
          {
            id: "bal-1",
            walletId: "wallet-1",
            assetSymbol: "BTC",
            available: new Decimal("0.00012345"),
            locked: new Decimal("0"),
            updatedAt: new Date(),
          },
        ],
      } as any);

      vi.mocked(getMultipleMarketTickers).mockResolvedValue(
        new Map([
          [
            "BTCUSDT",
            {
              symbol: "BTCUSDT",
              lastPrice: new Decimal("59962.30"),
              status: "live",
            } as any,
          ],
        ])
      );

      const result = await getWalletForUser("user-123");

      expect(result).toBeDefined();
      expect(result!.assets[0]).toBeDefined();
      const value = new Decimal(result!.assets[0]!.usdtValue!);
      const expectedValue = new Decimal("0.00012345").times("59962.30");

      expect(value.toString()).toBe(expectedValue.toString());
    });
  });
});
