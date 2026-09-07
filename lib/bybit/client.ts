import "server-only";
import type { Candle, KlineInterval, MarketTicker, OrderBookSnapshot, RecentTrade } from "./types";
import { SUPPORTED_PAIRS, getSupportedPair, type SupportedPair } from "./instruments";
import { normaliseTicker, normaliseCandles, normaliseOrderBook, normaliseTrades } from "./normalisers";
import { generateMockTicker, generateMockCandles, generateMockOrderBook, generateMockTrades } from "./mock-data";
import { cachedFetch, getStaleValue, setCachedValue } from "./cache";
import { UnsupportedSymbolError } from "./errors";

const REST_BASE_URL = process.env.BYBIT_REST_BASE_URL ?? "https://api.bybit.com";
const REQUEST_TIMEOUT_MS = 5000;
const TICKER_TTL_MS = 5_000;
const CANDLE_TTL_MS = 15_000;
const ORDERBOOK_TTL_MS = 3_000;
const TRADES_TTL_MS = 5_000;

// --- Lightweight circuit breaker -------------------------------------------
// After repeated failures, stop attempting real Bybit calls for a cooldown
// window and go straight to mock data — avoids hammering a down/rate-limited
// provider on every request (product rule: "circuit breaker").
const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 30_000;
let consecutiveFailures = 0;
let circuitOpenUntil = 0;

function isCircuitOpen(): boolean {
  return Date.now() < circuitOpenUntil;
}
function recordFailure(): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    circuitOpenUntil = Date.now() + COOLDOWN_MS;
  }
}
function recordSuccess(): void {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}

async function fetchWithTimeout(url: string, attempt = 0): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Bybit HTTP ${response.status}`);
    }
    const json = (await response.json()) as { retCode?: number; retMsg?: string; result?: unknown };
    if (json.retCode !== 0) {
      throw new Error(`Bybit retCode ${json.retCode}: ${json.retMsg}`);
    }
    recordSuccess();
    return json.result;
  } catch (error) {
    // Jittered exponential backoff, max 2 retries.
    if (attempt < 2) {
      const delay = 2 ** attempt * 250 + Math.random() * 150;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithTimeout(url, attempt + 1);
    }
    recordFailure();
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function requirePair(symbol: string): SupportedPair {
  const pair = getSupportedPair(symbol);
  if (!pair) throw new UnsupportedSymbolError(symbol);
  return pair;
}

async function withMockFallback<T>(
  cacheKey: string,
  ttlMs: number,
  attemptReal: () => Promise<T>,
  buildMock: () => T
): Promise<T> {
  try {
    return await cachedFetch(cacheKey, ttlMs, attemptReal);
  } catch {
    const stale = getStaleValue<T>(cacheKey);
    if (stale) return stale;
    const mock = buildMock();
    setCachedValue(cacheKey, mock, ttlMs);
    return mock;
  }
}

export async function getTicker(symbol: string): Promise<MarketTicker> {
  const pair = requirePair(symbol);
  if (pair.isFictional) return generateMockTicker(pair);

  return withMockFallback(
    `ticker:${pair.symbol}`,
    TICKER_TTL_MS,
    async () => {
      if (isCircuitOpen()) throw new Error("circuit open");
      const result = (await fetchWithTimeout(
        `${REST_BASE_URL}/v5/market/tickers?category=spot&symbol=${pair.symbol}`
      )) as { list?: unknown[] };
      const row = result.list?.[0];
      if (!row) throw new Error("Empty ticker response");
      return normaliseTicker(row, pair);
    },
    () => generateMockTicker(pair)
  );
}

export async function getAllTickers(): Promise<MarketTicker[]> {
  return Promise.all(SUPPORTED_PAIRS.map((pair) => getTicker(pair.symbol)));
}

export async function getCandles(symbol: string, interval: KlineInterval, limit = 200): Promise<Candle[]> {
  const pair = requirePair(symbol);
  if (pair.isFictional) return generateMockCandles(pair, interval, limit);

  return withMockFallback(
    `candles:${pair.symbol}:${interval}:${limit}`,
    CANDLE_TTL_MS,
    async () => {
      if (isCircuitOpen()) throw new Error("circuit open");
      const result = (await fetchWithTimeout(
        `${REST_BASE_URL}/v5/market/kline?category=spot&symbol=${pair.symbol}&interval=${interval}&limit=${limit}`
      )) as { list?: unknown[] };
      if (!result.list) throw new Error("Empty kline response");
      return normaliseCandles(result.list, pair);
    },
    () => generateMockCandles(pair, interval, limit)
  );
}

export async function getOrderBook(symbol: string, limit = 25): Promise<OrderBookSnapshot> {
  const pair = requirePair(symbol);
  if (pair.isFictional) return generateMockOrderBook(pair);

  return withMockFallback(
    `orderbook:${pair.symbol}:${limit}`,
    ORDERBOOK_TTL_MS,
    async () => {
      if (isCircuitOpen()) throw new Error("circuit open");
      const result = await fetchWithTimeout(
        `${REST_BASE_URL}/v5/market/orderbook?category=spot&symbol=${pair.symbol}&limit=${limit}`
      );
      return normaliseOrderBook(result, pair);
    },
    () => generateMockOrderBook(pair)
  );
}

export async function getRecentTrades(symbol: string, limit = 30): Promise<RecentTrade[]> {
  const pair = requirePair(symbol);
  if (pair.isFictional) return generateMockTrades(pair, limit);

  return withMockFallback(
    `trades:${pair.symbol}:${limit}`,
    TRADES_TTL_MS,
    async () => {
      if (isCircuitOpen()) throw new Error("circuit open");
      const result = (await fetchWithTimeout(
        `${REST_BASE_URL}/v5/market/recent-trade?category=spot&symbol=${pair.symbol}&limit=${limit}`
      )) as { list?: unknown[] };
      if (!result.list) throw new Error("Empty recent-trades response");
      return normaliseTrades(result.list, pair);
    },
    () => generateMockTrades(pair, limit)
  );
}
export async function probeBybitPublicApi(): Promise<{
  status: "healthy" | "unhealthy";
}> {
  try {
    await fetchWithTimeout(
      `${REST_BASE_URL}/v5/market/time`
    );

    return {
      status: "healthy",
    };
  } catch {
    return {
      status: "unhealthy",
    };
  }
}