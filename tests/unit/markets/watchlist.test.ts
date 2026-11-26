import { describe, it, expect, vi, beforeEach } from "vitest";
import { toggleWatchlist } from "@/app/(platform)/markets/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getTradingInstruments } from "@/lib/market/service";

vi.mock("@/lib/auth/session");
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    asset: {
      findUnique: vi.fn(),
    },
    watchlist: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/market/service");
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Watchlist Safety", () => {
  const mockUser = { id: "user-123", email: "test@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("rejects unauthenticated requests", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await toggleWatchlist("BTC", true);

      expect(result).toEqual({
        success: false,
        error: "Unauthorized",
      });
      expect(prisma.watchlist.upsert).not.toHaveBeenCalled();
    });
  });

  describe("Symbol Validation", () => {
    beforeEach(() => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    });

    it("rejects invalid symbols", async () => {
      const invalidSymbols = [
        "B", // too short
        "VERYLONGSYMBOLNAME123", // too long
        "BTC!", // special characters
        "btc-usdt", // hyphen
        "BTC USDT", // space
      ];

      for (const symbol of invalidSymbols) {
        const result = await toggleWatchlist(symbol, true);
        expect(result).toEqual({
          success: false,
          error: "Invalid asset symbol",
        });
      }

      expect(prisma.asset.findUnique).not.toHaveBeenCalled();
    });

    it("accepts valid symbols", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: "asset-1",
        symbol: "BTC",
        name: "Bitcoin",
        type: "CRYPTO",
        precision: 8,
        isActive: true,
        iconUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(getTradingInstruments).mockResolvedValue([
        {
          symbol: "BTCUSDT",
          baseAsset: "BTC",
          quoteAsset: "USDT",
          status: "trading",
          pricePrecision: 2,
          quantityPrecision: 6,
        } as any,
      ]);

      const result = await toggleWatchlist("BTC", true);

      expect(result.success).toBe(true);
      expect(prisma.asset.findUnique).toHaveBeenCalledWith({
        where: { symbol: "BTC" },
      });
    });
  });

  describe("Asset Safety", () => {
    beforeEach(() => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    });

    it("rejects non-existent assets", async () => {
      vi.mocked(prisma.asset.findUnique).mockResolvedValue(null);

      const result = await toggleWatchlist("FAKE", true);

      expect(result).toEqual({
        success: false,
        error: "Asset is not supported",
      });
      expect(prisma.watchlist.upsert).not.toHaveBeenCalled();
    });

    it("rejects non-crypto assets", async () => {
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: "asset-usd",
        symbol: "USD",
        name: "US Dollar",
        type: "FIAT",
        precision: 2,
        isActive: true,
        iconUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await toggleWatchlist("USD", true);

      expect(result).toEqual({
        success: false,
        error: "Asset is not supported",
      });
      expect(prisma.watchlist.upsert).not.toHaveBeenCalled();
    });

    it("rejects inactive assets", async () => {
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: "asset-old",
        symbol: "OLDCOIN",
        name: "Old Coin",
        type: "CRYPTO",
        precision: 8,
        isActive: false,
        iconUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await toggleWatchlist("OLDCOIN", true);

      expect(result).toEqual({
        success: false,
        error: "Asset is not supported",
      });
      expect(prisma.watchlist.upsert).not.toHaveBeenCalled();
    });
  });

  describe("Market Verification", () => {
    beforeEach(() => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: "asset-1",
        symbol: "BTC",
        name: "Bitcoin",
        type: "CRYPTO",
        precision: 8,
        isActive: true,
        iconUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it("rejects assets without active markets", async () => {
      vi.mocked(getTradingInstruments).mockResolvedValue([
        {
          symbol: "ETHUSDT",
          baseAsset: "ETH",
          quoteAsset: "USDT",
          status: "trading",
          pricePrecision: 2,
          quantityPrecision: 6,
        } as any,
      ]);

      const result = await toggleWatchlist("BTC", true);

      expect(result).toEqual({
        success: false,
        error: "No active market found for this asset",
      });
      expect(prisma.watchlist.upsert).not.toHaveBeenCalled();
    });

    it("accepts assets with active markets", async () => {
      vi.mocked(getTradingInstruments).mockResolvedValue([
        {
          symbol: "BTCUSDT",
          baseAsset: "BTC",
          quoteAsset: "USDT",
          status: "trading",
          pricePrecision: 2,
          quantityPrecision: 6,
        } as any,
      ]);
      vi.mocked(prisma.watchlist.upsert).mockResolvedValue({
        id: "watchlist-1",
        userId: mockUser.id,
        assetSymbol: "BTC",
        createdAt: new Date(),
      });

      const result = await toggleWatchlist("BTC", true);

      expect(result.success).toBe(true);
      expect(prisma.watchlist.upsert).toHaveBeenCalledWith({
        where: {
          userId_assetSymbol: {
            userId: mockUser.id,
            assetSymbol: "BTC",
          },
        },
        create: {
          userId: mockUser.id,
          assetSymbol: "BTC",
        },
        update: {},
      });
    });
  });

  describe("Removal", () => {
    beforeEach(() => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    });

    it("allows removal even when Bybit is offline", async () => {
      // No asset/market checks should be performed for removal
      vi.mocked(prisma.watchlist.deleteMany).mockResolvedValue({ count: 1 });

      const result = await toggleWatchlist("BTC", false);

      expect(result.success).toBe(true);
      expect(prisma.asset.findUnique).not.toHaveBeenCalled();
      expect(getTradingInstruments).not.toHaveBeenCalled();
      expect(prisma.watchlist.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          assetSymbol: "BTC",
        },
      });
    });
  });
});
