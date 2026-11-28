/**
 * Market Data Service
 * 
 * High-level API for fetching market data from Bybit.
 * Provides caching, error handling, and normalized responses.
 * This is the primary interface that application code should use.
 */

import type {
  MarketTicker,
  TradingInstrument,
  Candlestick,
  OrderBook,
  PublicTrade,
  CandlestickInterval,
  MarketDataHealth,
} from "./types";
import * as restClient from "@/lib/bybit/rest-client";
import * as normalization from "@/lib/bybit/normalization";
import * as cache from "@/lib/bybit/cache";
import {
  getProviderHealth,
  recordProviderSuccess,
  recordProviderFailure,
} from "@/lib/bybit/health";

// ─── Ticker ─────────────────────────────────────────────────────────────────

/**
 * Get ticker data for a trading pair.
 * Returns cached data if fresh, otherwise fetches from Bybit.
 * 
 * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
 */
export async function getMarketTicker(symbol: string): Promise<MarketTicker> {
  const cacheKey = cache.buildTickerCacheKey(symbol);

  // Check cache first
  const cached = cache.getCachedData<MarketTicker>(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch from Bybit
  const startTime = Date.now();

  try {
    const result = await restClient.fetchTicker(symbol);

    const latency = Date.now() - startTime;
    recordProviderSuccess(latency);

    if (result.list.length === 0) {
      throw new Error(`Symbol ${symbol} not found`);
    }

    const ticker = normalization.normalizeTickerResponse(result.list[0]!, "live");

    // Cache the result
    cache.setCachedData(cacheKey, ticker);

    return ticker;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    recordProviderFailure(errorMessage);

    const staleCache = cache.getStaleCachedData<MarketTicker>(cacheKey);
    if (staleCache) {
      return { ...staleCache, status: "stale" };
    }

    throw error;
  }
}

/**
 * Get ticker data for multiple trading pairs.
 * 
 * @param symbols - Array of trading pair symbols (e.g., ["BTCUSDT", "ETHUSDT"])
 */
export async function getMultipleMarketTickers(
  symbols: string[]
): Promise<Map<string, MarketTicker>> {

  const results = new Map<string, MarketTicker>();

  const uniqueSymbols = [
    ...new Set(symbols.map((s) => s.toUpperCase())),
  ];

  if (uniqueSymbols.length === 0) {
    return results;
  }

  const missingSymbols = new Set<string>();

  // Use existing fresh cached values first.
  for (const symbol of uniqueSymbols) {
    const cacheKey = cache.buildTickerCacheKey(symbol);

    const cached =
      cache.getCachedData<MarketTicker>(cacheKey);

    if (cached) {
      results.set(symbol, cached);
    } else {
      missingSymbols.add(symbol);
    }
  }

  if (missingSymbols.size === 0) {
    return results;
  }

  const startTime = Date.now();

  try {
    // One request returns all spot tickers.
    const response = await restClient.fetchTicker();

    recordProviderSuccess(Date.now() - startTime);

    for (const rawTicker of response.list) {

      if (!missingSymbols.has(rawTicker.symbol)) {
        continue;
      }

      const ticker =
        normalization.normalizeTickerResponse(
          rawTicker,
          "live"
        );

      results.set(rawTicker.symbol, ticker);

      cache.setCachedData(
        cache.buildTickerCacheKey(rawTicker.symbol),
        ticker
      );
    }

  } catch (error) {
  recordProviderFailure(
    error instanceof Error
      ? error.message
      : "Unknown error"
  );

  console.error(
    "Failed to retrieve Bybit market tickers",
    error
  );

  // Recover recently expired prices when Bybit is unavailable.
  // Recovered prices must always be marked as stale.
  for (const symbol of missingSymbols) {
    const staleTicker = cache.getStaleCachedData<MarketTicker>(
      cache.buildTickerCacheKey(symbol)
    );

    if (staleTicker) {
      results.set(symbol, {
        ...staleTicker,
        status: "stale",
      });
    }
  }
}

  return results;
}

// ─── Instruments ────────────────────────────────────────────────────────────

/**
 * Get list of available trading instruments (trading pairs).
 * Results are cached for longer (5 minutes) since they change infrequently.
 * 
 * @param params.symbol - Filter by specific symbol (optional)
 * @param params.activeOnly - Only return active trading pairs (default: true)
 */
export async function getTradingInstruments(
  params: {
    symbol?: string;
    activeOnly?: boolean;
  } = {}
): Promise<TradingInstrument[]> {

  const cacheKey = cache.buildInstrumentsCacheKey();

  // Always cache the full instrument dataset.
  let instruments =
    cache.getCachedData<TradingInstrument[]>(cacheKey);

  if (!instruments) {
    const startTime = Date.now();

    try {
      // Fetch all spot instruments.
      const result = await restClient.fetchInstruments();

      instruments = result.list.map(
        normalization.normalizeInstrument
      );

      cache.setCachedData(
        cacheKey,
        instruments,
        300
      );

      recordProviderSuccess(Date.now() - startTime);

    } catch (error) {
      recordProviderFailure(
        error instanceof Error
          ? error.message
          : "Unknown error"
      );

      throw error;
    }
  }

  // Apply filters AFTER retrieving the complete dataset.
  return instruments.filter((instrument) => {

    if (
      params.activeOnly !== false &&
      instrument.status !== "active"
    ) {
      return false;
    }

    if (
      params.symbol &&
      instrument.symbol !== params.symbol.toUpperCase()
    ) {
      return false;
    }

    return true;
  });
}

// ─── Candlesticks ───────────────────────────────────────────────────────────

/**
 * Get candlestick (OHLCV) data for a trading pair.
 * 
 * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
 * @param interval - Candlestick interval (e.g., "1h", "1d")
 * @param params.start - Start timestamp (optional)
 * @param params.end - End timestamp (optional)
 * @param params.limit - Number of candles (default: 200, max: 1000)
 */
export async function getCandlesticks(
  symbol: string,
  interval: CandlestickInterval,
  params: {
    start?: Date;
    end?: Date;
    limit?: number;
  } = {}
): Promise<Candlestick[]> {
  const limit = params.limit ?? 200;
  const cacheKey = cache.buildKlineCacheKey(symbol, interval, limit);

  // Check cache
  const cached = cache.getCachedData<Candlestick[]>(cacheKey);
  if (cached && !params.start && !params.end) {
    return cached;
  }

  // Fetch from Bybit
  const startTime = Date.now();

  try {
    const bybitInterval = normalization.toBybitInterval(interval);
    const result = await restClient.fetchKline(symbol, bybitInterval, {
      start: params.start?.getTime(),
      end: params.end?.getTime(),
      limit,
    });

    const latency = Date.now() - startTime;
    recordProviderSuccess(latency);

    // Bybit returns candles in descending order, reverse to ascending
    const candles = result.list
      .reverse()
      .map((kline, index) =>
        normalization.normalizeKline(
          symbol,
          kline,
          bybitInterval,
          index < result.list.length - 1 // Last candle might be incomplete
        )
      );

    // Cache the result
    if (!params.start && !params.end) {
      cache.setCachedData(cacheKey, candles);
    }

    return candles;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    recordProviderFailure(errorMessage);

    // Return cached data if available
    const staleCache = cache.getCachedData<Candlestick[]>(cacheKey);
    if (staleCache) {
      return staleCache;
    }

    throw error;
  }
}

// ─── Order Book ─────────────────────────────────────────────────────────────

/**
 * Get order book (depth) data for a trading pair.
 * 
 * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
 * @param depth - Number of price levels (1, 50, 200). Default: 50.
 */
export async function getOrderBook(
  symbol: string,
  depth: number = 50
): Promise<OrderBook> {
  const cacheKey = cache.buildOrderBookCacheKey(symbol, depth);

  // Check cache (short TTL for order book)
  const cached = cache.getCachedData<OrderBook>(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch from Bybit
  const startTime = Date.now();

  try {
    const result = await restClient.fetchOrderBook(symbol, depth);

    const latency = Date.now() - startTime;
    recordProviderSuccess(latency);

    const orderBook = normalization.normalizeOrderBook(result, "live");

    // Cache for shorter duration (order book changes frequently)
    cache.setCachedData(cacheKey, orderBook, 5);

    return orderBook;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    recordProviderFailure(errorMessage);

    // Return cached data with stale status if available
    const staleCache = cache.getStaleCachedData<OrderBook>(cacheKey);
    if (staleCache) {
      return { ...staleCache, status: "stale" };
    }

    throw error;
  }
}

// ─── Recent Trades ──────────────────────────────────────────────────────────

/**
 * Get recent public trades for a trading pair.
 * 
 * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
 * @param limit - Number of trades (default: 60, max: 1000)
 */
export async function getRecentTrades(
  symbol: string,
  limit: number = 60
): Promise<PublicTrade[]> {
  const cacheKey = cache.buildTradesCacheKey(symbol, limit);

  // Check cache
  const cached = cache.getCachedData<PublicTrade[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch from Bybit
  const startTime = Date.now();

  try {
    const result = await restClient.fetchRecentTrades(symbol, limit);

    const latency = Date.now() - startTime;
    recordProviderSuccess(latency);

    const trades = result.list.map(normalization.normalizePublicTrade);

    // Cache for short duration
    cache.setCachedData(cacheKey, trades, 5);

    return trades;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    recordProviderFailure(errorMessage);

    // Return cached data if available
    const staleCache = cache.getCachedData<PublicTrade[]>(cacheKey);
    if (staleCache) {
      return staleCache;
    }

    throw error;
  }
}

// ─── Health ─────────────────────────────────────────────────────────────────

/**
 * Get current market data provider health status.
 */
export async function getMarketDataHealth(): Promise<MarketDataHealth> {
  return getProviderHealth();
}
