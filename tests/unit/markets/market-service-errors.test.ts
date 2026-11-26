import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getMarketTicker,
  getTradingInstruments,
  getCandlesticks,
  getOrderBook,
  getRecentTrades,
} from "@/lib/market/service";
import * as restClient from "@/lib/bybit/rest-client";

vi.mock("@/lib/bybit/rest-client");
vi.mock("@/lib/bybit/health", () => ({
  recordProviderSuccess: vi.fn(),
  recordProviderFailure: vi.fn(),
  getProviderHealth: vi.fn(),
}));
vi.mock("@/lib/bybit/cache", () => ({
  getCachedData: vi.fn(() => null),
  getStaleCachedData: vi.fn(() => null),
  setCachedData: vi.fn(),
  buildTickerCacheKey: vi.fn((symbol) => `ticker:${symbol}`),
  buildInstrumentsCacheKey: vi.fn(() => "instruments"),
  buildKlineCacheKey: vi.fn((symbol, interval, limit) => `kline:${symbol}:${interval}:${limit}`),
  buildOrderBookCacheKey: vi.fn((symbol, depth) => `orderbook:${symbol}:${depth}`),
  buildTradesCacheKey: vi.fn((symbol, limit) => `trades:${symbol}:${limit}`),
}));

describe("Market Service Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTradingInstruments", () => {
    it("throws on Bybit failure", async () => {
      vi.mocked(restClient.fetchInstruments).mockRejectedValue(
        new Error("Network error")
      );

      await expect(getTradingInstruments()).rejects.toThrow("Network error");
    });

    it("filters by active status when requested", async () => {
      const response = {
        list: [
          {
            symbol: "BTCUSDT",
            baseCoin: "BTC",
            quoteCoin: "USDT",
            status: "Trading" as const,
            basePrecision: "0.000001",
            quotePrecision: "0.01",
            lotSizeFilter: {
              basePrecision: "0.000001",
              quotePrecision: "0.01",
              minOrderQty: "0.000001",
              maxOrderQty: "1000",
              minOrderAmt: "1",
              maxOrderAmt: "1000000",
            },
            priceFilter: {
              tickSize: "0.01",
            },
          },
          {
            symbol: "ETHUSDT",
            baseCoin: "ETH",
            quoteCoin: "USDT",
            status: "Closed" as const,
            basePrecision: "0.0001",
            quotePrecision: "0.01",
            lotSizeFilter: {
              basePrecision: "0.0001",
              quotePrecision: "0.01",
              minOrderQty: "0.0001",
              maxOrderQty: "1000",
              minOrderAmt: "1",
              maxOrderAmt: "1000000",
            },
            priceFilter: {
              tickSize: "0.01",
            },
          },
        ],
      };
      vi.mocked(restClient.fetchInstruments, { partial: true, deep: true }).mockResolvedValue(response);

      const result = await getTradingInstruments({ activeOnly: true });

      expect(result).toHaveLength(1);
      expect(result[0]?.symbol).toBe("BTCUSDT");
    });
  });

  describe("getMarketTicker", () => {
    it("throws on Bybit failure when no cache", async () => {
      vi.mocked(restClient.fetchTicker).mockRejectedValue(
        new Error("API error")
      );

      await expect(getMarketTicker("BTCUSDT")).rejects.toThrow("API error");
    });

    it("throws when ticker is missing", async () => {
      vi.mocked(restClient.fetchTicker, { partial: true, deep: true }).mockResolvedValue({
        list: [],
      });

      await expect(getMarketTicker("INVALIDPAIR")).rejects.toThrow(
        "Symbol INVALIDPAIR not found"
      );
    });
  });

  describe("getCandlesticks", () => {
    it("throws on Bybit failure when no cache", async () => {
      vi.mocked(restClient.fetchKline).mockRejectedValue(
        new Error("Timeout")
      );

      await expect(getCandlesticks("BTCUSDT", "1h")).rejects.toThrow("Timeout");
    });

    it("passes through limit parameter", async () => {
      vi.mocked(restClient.fetchKline, { partial: true, deep: true }).mockResolvedValue({
        list: [],
      });

      await getCandlesticks("BTCUSDT", "1h", { limit: 50 });

      expect(restClient.fetchKline).toHaveBeenCalledWith(
        "BTCUSDT",
        "60",
        expect.objectContaining({ limit: 50 })
      );
    });
  });

  describe("getOrderBook", () => {
    it("throws on Bybit failure when no cache", async () => {
      vi.mocked(restClient.fetchOrderBook).mockRejectedValue(
        new Error("Connection refused")
      );

      await expect(getOrderBook("BTCUSDT", 20)).rejects.toThrow(
        "Connection refused"
      );
    });
  });

  describe("getRecentTrades", () => {
    it("throws on Bybit failure when no cache", async () => {
      vi.mocked(restClient.fetchRecentTrades).mockRejectedValue(
        new Error("Rate limit exceeded")
      );

      await expect(getRecentTrades("BTCUSDT", 50)).rejects.toThrow(
        "Rate limit exceeded"
      );
    });

    it("passes through limit parameter", async () => {
      vi.mocked(restClient.fetchRecentTrades, { partial: true, deep: true }).mockResolvedValue({
        list: [],
      });

      await getRecentTrades("BTCUSDT", 100);

      expect(restClient.fetchRecentTrades).toHaveBeenCalledWith("BTCUSDT", 100);
    });
  });

  describe("Graceful Degradation", () => {
    it("all services throw on concurrent failures when no cache", async () => {
      vi.mocked(restClient.fetchInstruments).mockRejectedValue(
        new Error("API down")
      );
      vi.mocked(restClient.fetchTicker).mockRejectedValue(
        new Error("API down")
      );
      vi.mocked(restClient.fetchKline).mockRejectedValue(
        new Error("API down")
      );
      vi.mocked(restClient.fetchOrderBook).mockRejectedValue(
        new Error("API down")
      );
      vi.mocked(restClient.fetchRecentTrades).mockRejectedValue(
        new Error("API down")
      );

      const results = await Promise.allSettled([
        getTradingInstruments(),
        getMarketTicker("BTCUSDT"),
        getCandlesticks("BTCUSDT", "1h"),
        getOrderBook("BTCUSDT", 20),
        getRecentTrades("BTCUSDT", 50),
      ]);

      // All should fail with appropriate errors
      expect(results.every((r) => r.status === "rejected")).toBe(true);
      results.forEach((result) => {
        if (result.status === "rejected") {
          expect(result.reason.message).toBe("API down");
        }
      });
    });
  });
});
