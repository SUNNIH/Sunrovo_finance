/**
 * Bybit Cache Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as cache from "@/lib/bybit/cache";

describe("cache", () => {
  beforeEach(() => {
    cache.clearAllCache();
  });

  describe("basic operations", () => {
    it("should store and retrieve data", () => {
      cache.setCachedData("test:key", { value: 42 });
      const result = cache.getCachedData<{ value: number }>("test:key");

      expect(result).toEqual({ value: 42 });
    });

    it("should return null for non-existent keys", () => {
      const result = cache.getCachedData("nonexistent");
      expect(result).toBeNull();
    });

    it("should check if key exists", () => {
      cache.setCachedData("test:key", { value: 42 });

      expect(cache.hasCachedData("test:key")).toBe(true);
      expect(cache.hasCachedData("nonexistent")).toBe(false);
    });

    it("should invalidate specific keys", () => {
      cache.setCachedData("key1", "value1");
      cache.setCachedData("key2", "value2");

      cache.invalidateCache("key1");

      expect(cache.hasCachedData("key1")).toBe(false);
      expect(cache.hasCachedData("key2")).toBe(true);
    });

    it("should clear all cache", () => {
      cache.setCachedData("key1", "value1");
      cache.setCachedData("key2", "value2");

      cache.clearAllCache();

      expect(cache.hasCachedData("key1")).toBe(false);
      expect(cache.hasCachedData("key2")).toBe(false);
    });
  });

  describe("TTL and expiration", () => {
    it("should expire data after TTL", async () => {
      cache.setCachedData("test:key", { value: 42 }, 1); // 1 second TTL

      expect(cache.hasCachedData("test:key")).toBe(true);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(cache.hasCachedData("test:key")).toBe(false);
      expect(cache.getCachedData("test:key")).toBeNull();
    });

    it("should detect stale data", () => {
      vi.useFakeTimers();

      try {
        cache.setCachedData("test:key", { value: 42 }, 3);

        // Three seconds remaining: outside the one-second threshold.
        expect(cache.isCachedDataStale("test:key", 1)).toBe(false);

        // Three seconds remaining: inside the five-second threshold.
        expect(cache.isCachedDataStale("test:key", 5)).toBe(true);

        // Advance to the one-second staleness boundary.
        vi.advanceTimersByTime(2000);

        expect(cache.isCachedDataStale("test:key", 1)).toBe(true);

        // Near-expiration data is still available.
        expect(cache.getCachedData("test:key")).toEqual({ value: 42 });

        // Expired data must never be returned as fresh.
        vi.advanceTimersByTime(1000);

        expect(cache.getCachedData("test:key")).toBeNull();
        expect(cache.getStaleCachedData("test:key")).toEqual({
          value: 42,
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it("should return cache age", () => {
      cache.setCachedData("test:key", { value: 42 });

      const age = cache.getCachedDataAge("test:key");
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(1); // Should be less than 1 second old
    });
  });

  describe("cache key builders", () => {
    it("should build ticker cache key", () => {
      const key = cache.buildTickerCacheKey("BTCUSDT");
      expect(key).toBe("ticker:BTCUSDT");
    });

    it("should build instruments cache key", () => {
      const key = cache.buildInstrumentsCacheKey();
      expect(key).toBe("instruments:all");
    });

    it("should build kline cache key", () => {
      const key = cache.buildKlineCacheKey("BTCUSDT", "1h", 200);
      expect(key).toBe("kline:BTCUSDT:1h:200");
    });

    it("should build order book cache key", () => {
      const key = cache.buildOrderBookCacheKey("BTCUSDT", 50);
      expect(key).toBe("orderbook:BTCUSDT:50");
    });

    it("should build trades cache key", () => {
      const key = cache.buildTradesCacheKey("BTCUSDT", 60);
      expect(key).toBe("trades:BTCUSDT:60");
    });
  });

  describe("cache statistics", () => {
    it("should return cache stats", () => {
      cache.setCachedData("key1", "value1");
      cache.setCachedData("key2", "value2");
      cache.setCachedData("key3", "value3");

      const stats = cache.getCacheStats();

      expect(stats.size).toBe(3);
      expect(stats.keys).toContain("key1");
      expect(stats.keys).toContain("key2");
      expect(stats.keys).toContain("key3");
    });
  });
});
