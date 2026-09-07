import type { Candle, KlineInterval, MarketTicker, OrderBookSnapshot, RecentTrade } from "./types";
import type { SupportedPair } from "./instruments";

/** Small deterministic hash so each symbol gets a stable-but-different phase offset. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 100000;
  }
  return hash / 100000;
}

/** Slow sine-wave drift (minutes-scale) plus small per-call jitter — smooth enough to
 * feel "live" across repeated polls without jumping wildly between requests. */
function pseudoPrice(basePrice: number, symbol: string, atMs: number = Date.now()): number {
  const phase = hashString(symbol) * Math.PI * 2;
  const wave = Math.sin(atMs / 90_000 + phase) * 0.02;
  const noise = (Math.random() - 0.5) * 0.004;
  return basePrice * (1 + wave + noise);
}

export function generateMockTicker(pair: SupportedPair): MarketTicker {
  const price = pseudoPrice(pair.basePriceHint, pair.symbol);
  const priceOneDayAgo = pseudoPrice(pair.basePriceHint, pair.symbol, Date.now() - 24 * 60 * 60 * 1000);
  const changePercent = ((price - priceOneDayAgo) / priceOneDayAgo) * 100;
  const high = price * (1 + Math.random() * 0.015);
  const low = price * (1 - Math.random() * 0.015);
  const spread = price * 0.0005;

  return {
    symbol: pair.symbol,
    baseAsset: pair.baseAsset,
    quoteAsset: pair.quoteAsset,
    lastPrice: price.toFixed(pair.pricePrecision),
    change24hPercent: changePercent.toFixed(2),
    high24h: high.toFixed(pair.pricePrecision),
    low24h: low.toFixed(pair.pricePrecision),
    volume24h: (pair.basePriceHint * (5000 + Math.random() * 20000)).toFixed(2),
    bestBid: (price - spread).toFixed(pair.pricePrecision),
    bestAsk: (price + spread).toFixed(pair.pricePrecision),
    updatedAt: new Date().toISOString(),
    isStale: true,
  };
}

const INTERVAL_MS: Record<KlineInterval, number> = {
  "1": 60_000,
  "5": 5 * 60_000,
  "15": 15 * 60_000,
  "60": 60 * 60_000,
  "240": 4 * 60 * 60_000,
  D: 24 * 60 * 60_000,
};

export function generateMockCandles(pair: SupportedPair, interval: KlineInterval, limit: number): Candle[] {
  const stepMs = INTERVAL_MS[interval];
  const now = Date.now();
  const candles: Candle[] = [];
  let previousClose = pseudoPrice(pair.basePriceHint, pair.symbol, now - limit * stepMs);

  for (let i = limit - 1; i >= 0; i -= 1) {
    const openTime = now - i * stepMs;
    const open = previousClose;
    const close = pseudoPrice(pair.basePriceHint, pair.symbol, openTime);
    const high = Math.max(open, close) * (1 + Math.random() * 0.006);
    const low = Math.min(open, close) * (1 - Math.random() * 0.006);
    candles.push({
      openTime: new Date(openTime).toISOString(),
      open: open.toFixed(pair.pricePrecision),
      high: high.toFixed(pair.pricePrecision),
      low: low.toFixed(pair.pricePrecision),
      close: close.toFixed(pair.pricePrecision),
      volume: (pair.basePriceHint * (10 + Math.random() * 200)).toFixed(2),
    });
    previousClose = close;
  }

  return candles;
}

export function generateMockOrderBook(pair: SupportedPair): OrderBookSnapshot {
  const price = pseudoPrice(pair.basePriceHint, pair.symbol);
  const step = price * 0.0008;

  const bids = Array.from({ length: 12 }, (_, i) => ({
    price: (price - step * (i + 1)).toFixed(pair.pricePrecision),
    quantity: (Math.random() * 4 + 0.05).toFixed(pair.quantityPrecision),
  }));
  const asks = Array.from({ length: 12 }, (_, i) => ({
    price: (price + step * (i + 1)).toFixed(pair.pricePrecision),
    quantity: (Math.random() * 4 + 0.05).toFixed(pair.quantityPrecision),
  }));

  return { symbol: pair.symbol, bids, asks, updatedAt: new Date().toISOString(), isStale: true };
}

export function generateMockTrades(pair: SupportedPair, limit: number): RecentTrade[] {
  const now = Date.now();
  return Array.from({ length: limit }, (_, i) => {
    const price = pseudoPrice(pair.basePriceHint, pair.symbol, now - i * 1500);
    return {
      id: `mock-${pair.symbol}-${now}-${i}`,
      price: price.toFixed(pair.pricePrecision),
      quantity: (Math.random() * 0.5 + 0.001).toFixed(pair.quantityPrecision),
      side: Math.random() > 0.5 ? ("BUY" as const) : ("SELL" as const),
      executedAt: new Date(now - i * 1500).toISOString(),
    };
  });
}
