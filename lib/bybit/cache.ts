import "server-only";

/**
 * Short-TTL cache + in-flight request deduplication for Bybit reads
 * (product rule: "Implement caching, backoff and WebSocket reconnection,"
 * "Respect Bybit rate limits and avoid opening a separate provider
 * WebSocket for every browser tab"). In-memory and per-process — fine for
 * a single-instance demo deployment; a multi-instance production
 * deployment would want a shared cache (Redis), same caveat as the rate
 * limiter.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export async function cachedFetch<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const existing = inFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = loader()
    .then((value) => {
      cache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

/** Returns the last cached value regardless of expiry — used for the "stale but present" fallback. */
export function getStaleValue<T>(key: string): T | null {
  const cached = cache.get(key);
  return cached ? (cached.value as T) : null;
}

export function setCachedValue<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}
