/**
 * Bybit Market Data Cache
 * 
 * In-memory caching layer for Bybit API responses.
 * Reduces redundant requests and improves response times.
 * 
 * For production scale, consider Redis or similar external cache.
 */

import { MARKET_DATA_CACHE_TTL_SEC } from "./config";
// Retain expired entries briefly for clearly labeled stale-data fallback.
const STALE_RETENTION_MS = 60_000;
interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  expiresAt: Date;
}

class MarketDataCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  /**
   * Store data in cache with TTL.
   */
  set<T>(key: string, data: T, ttlSeconds: number = MARKET_DATA_CACHE_TTL_SEC): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt,
    });
  }

  /**
   * Retrieve data from cache if it exists and hasn't expired.
   * Returns null if cache miss or expired.
   */
  get<T>(key: string): T | null {
  const entry = this.cache.get(key) as CacheEntry<T> | undefined;

  if (!entry) {
    return null;
  }

  const now = Date.now();
  const expiresAt = entry.expiresAt.getTime();

  // Remove entries once their stale-retention period ends.
  if (now >= expiresAt + STALE_RETENTION_MS) {
    this.cache.delete(key);
    return null;
  }

  // Expired data must never be returned as fresh.
  if (now >= expiresAt) {
    return null;
  }

  return entry.data;
}
/**
 * Retrieve expired data within the permitted stale-retention window.
 * Never returns fresh data or data older than the retention limit.
 */
getStale<T>(key: string): T | null {
  const entry = this.cache.get(key) as CacheEntry<T> | undefined;

  if (!entry) {
    return null;
  }

  const now = Date.now();
  const expiresAt = entry.expiresAt.getTime();

  // Fresh data should be retrieved using get().
  if (now < expiresAt) {
    return null;
  }

  // Never return excessively old market data.
  if (now >= expiresAt + STALE_RETENTION_MS) {
    this.cache.delete(key);
    return null;
  }

  return entry.data;
}
  /**
   * Check if cached data exists and is fresh (not expired).
   */
 has(key: string): boolean {
  return this.get<unknown>(key) !== null;
}

  /**
   * Check if cached data exists but is stale (close to expiration).
   * Used to trigger background refresh while still serving cached data.
   */
  isStale(key: string, staleThresholdSeconds: number = 5): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = new Date();
    const timeUntilExpiry = entry.expiresAt.getTime() - now.getTime();
    return timeUntilExpiry <= staleThresholdSeconds * 1000;
  }

  /**
   * Get cache entry age in seconds.
   */
  getAge(key: string): number | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = new Date();
    return (now.getTime() - entry.timestamp.getTime()) / 1000;
  }

  /**
   * Manually invalidate a cache entry.
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics (for monitoring).
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Remove expired entries (garbage collection).
   * Called periodically to prevent memory leaks.
   */
  cleanup(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (
  now.getTime() >=
  entry.expiresAt.getTime() + STALE_RETENTION_MS
) {
  expiredKeys.push(key);
}
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }
  }
}

// ─── Singleton Instance ─────────────────────────────────────────────────────

const cache = new MarketDataCache();

// Run cleanup every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => cache.cleanup(), 5 * 60 * 1000);
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function getCachedData<T>(key: string): T | null {
  return cache.get<T>(key);
}
export function getStaleCachedData<T>(key: string): T | null {
  return cache.getStale<T>(key);
}

export function setCachedData<T>(
  key: string,
  data: T,
  ttlSeconds?: number
): void {
  cache.set(key, data, ttlSeconds);
}

export function hasCachedData(key: string): boolean {
  return cache.has(key);
}

export function isCachedDataStale(key: string, staleThresholdSeconds?: number): boolean {
  return cache.isStale(key, staleThresholdSeconds);
}

export function getCachedDataAge(key: string): number | null {
  return cache.getAge(key);
}

export function invalidateCache(key: string): void {
  cache.delete(key);
}

export function clearAllCache(): void {
  cache.clear();
}

export function getCacheStats(): { size: number; keys: string[] } {
  return cache.getStats();
}

// ─── Cache Key Builders ─────────────────────────────────────────────────────

export function buildTickerCacheKey(symbol: string): string {
  return `ticker:${symbol}`;
}

export function buildInstrumentsCacheKey(): string {
  return "instruments:all";
}

export function buildKlineCacheKey(
  symbol: string,
  interval: string,
  limit: number
): string {
  return `kline:${symbol}:${interval}:${limit}`;
}

export function buildOrderBookCacheKey(symbol: string, depth: number): string {
  return `orderbook:${symbol}:${depth}`;
}

export function buildTradesCacheKey(symbol: string, limit: number): string {
  return `trades:${symbol}:${limit}`;
}
