import type { Candle, InstrumentInfo, MarketTicker, OrderBookSnapshot, RecentTrade } from "./types";
import type { SupportedPair } from "./instruments";
import Decimal from "decimal.js";

/**
 * Bybit V5 response shapes, typed loosely (`unknown` fields narrowed at
 * the point of use) since this is the one boundary in the codebase that
 * legitimately has to deal with an external, versioned, possibly-drifting
 * API contract. Every function here fails by throwing rather than
 * returning malformed data — callers (lib/bybit/client.ts) catch that and
 * fall back to mock data, so a Bybit field-name change degrades to
 * "stale demo data" rather than a broken page.
 */

function asString(value: unknown, fallback = "0"): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

export function normaliseTicker(raw: unknown, pair: SupportedPair): MarketTicker {
  const row = raw as Record<string, unknown>;
  const lastPrice = new Decimal(asString(row.lastPrice));
  const changeFraction = new Decimal(asString(row.price24hPcnt, "0"));

  return {
    symbol: pair.symbol,
    baseAsset: pair.baseAsset,
    quoteAsset: pair.quoteAsset,
    lastPrice: lastPrice.toFixed(pair.pricePrecision),
    change24hPercent: changeFraction.mul(100).toFixed(2),
    high24h: new Decimal(asString(row.highPrice24h)).toFixed(pair.pricePrecision),
    low24h: new Decimal(asString(row.lowPrice24h)).toFixed(pair.pricePrecision),
    volume24h: asString(row.volume24h),
    bestBid: new Decimal(asString(row.bid1Price, asString(row.lastPrice))).toFixed(pair.pricePrecision),
    bestAsk: new Decimal(asString(row.ask1Price, asString(row.lastPrice))).toFixed(pair.pricePrecision),
    updatedAt: new Date().toISOString(),
    isStale: false,
  };
}

export function normaliseCandles(raw: unknown, pair: SupportedPair): Candle[] {
  const rows = raw as unknown[];
  if (!Array.isArray(rows)) throw new Error("Malformed kline response");

  // Bybit returns newest-first; charts want oldest-first.
  const ascending = [...rows].reverse();

  return ascending.map((entry) => {
    const [openTime, open, high, low, close, volume] = entry as string[];
    if (!openTime || !open || !high || !low || !close) throw new Error("Malformed kline row");
    return {
      openTime: new Date(Number(openTime)).toISOString(),
      open: new Decimal(open).toFixed(pair.pricePrecision),
      high: new Decimal(high).toFixed(pair.pricePrecision),
      low: new Decimal(low).toFixed(pair.pricePrecision),
      close: new Decimal(close).toFixed(pair.pricePrecision),
      volume: volume ?? "0",
    };
  });
}

/** Normalises a Bybit WebSocket kline update into the same owned Candle type as REST. */
export function normaliseLiveKline(raw: unknown, pair: SupportedPair): Candle {
  const row = raw as Record<string, unknown>;
  const start = asString(row.start ?? row.startTime, "");
  const open = asString(row.open, "");
  const high = asString(row.high, "");
  const low = asString(row.low, "");
  const close = asString(row.close, "");
  if (!start || !open || !high || !low || !close) throw new Error("Malformed live kline update");
  return {
    openTime: new Date(Number(start)).toISOString(),
    open: new Decimal(open).toFixed(pair.pricePrecision),
    high: new Decimal(high).toFixed(pair.pricePrecision),
    low: new Decimal(low).toFixed(pair.pricePrecision),
    close: new Decimal(close).toFixed(pair.pricePrecision),
    volume: asString(row.volume),
  };
}

export function normaliseOrderBook(raw: unknown, pair: SupportedPair): OrderBookSnapshot {
  const row = raw as Record<string, unknown>;
  const bids = row.b as unknown as string[][] | undefined;
  const asks = row.a as unknown as string[][] | undefined;
  if (!Array.isArray(bids) || !Array.isArray(asks)) throw new Error("Malformed orderbook response");

  const mapLevel = ([price, quantity]: string[]) => {
    if (!price || !quantity) throw new Error("Malformed orderbook level");
    return {
      price: new Decimal(price).toFixed(pair.pricePrecision),
      quantity: new Decimal(quantity).toFixed(pair.quantityPrecision),
    };
  };

  return {
    symbol: pair.symbol,
    bids: bids.map(mapLevel),
    asks: asks.map(mapLevel),
    updatedAt: new Date().toISOString(),
    isStale: false,
  };
}

export function normaliseTrades(raw: unknown, pair: SupportedPair): RecentTrade[] {
  const rows = raw as unknown[];
  if (!Array.isArray(rows)) throw new Error("Malformed recent-trades response");

  return rows.map((entry) => {
    const row = entry as Record<string, unknown>;
    return {
      id: asString(row.execId, `${pair.symbol}-${Math.random()}`),
      price: new Decimal(asString(row.price)).toFixed(pair.pricePrecision),
      quantity: new Decimal(asString(row.size)).toFixed(pair.quantityPrecision),
      side: String(row.side).toLowerCase() === "buy" ? ("BUY" as const) : ("SELL" as const),
      executedAt: new Date(Number(asString(row.time))).toISOString(),
    };
  });
}

export function normaliseInstrument(raw: unknown): InstrumentInfo {
  const row = raw as Record<string, unknown>;
  const lotSizeFilter = row.lotSizeFilter as Record<string, unknown> | undefined;
  const priceFilter = row.priceFilter as Record<string, unknown> | undefined;
  const tickSize = asString(priceFilter?.tickSize, "0.01");
  const basePrecision = asString(lotSizeFilter?.basePrecision, "0.000001");

  return {
    symbol: asString(row.symbol),
    baseAsset: asString(row.baseCoin),
    quoteAsset: asString(row.quoteCoin),
    pricePrecision: (tickSize.split(".")[1] ?? "").length,
    quantityPrecision: (basePrecision.split(".")[1] ?? "").length,
    minOrderQuantity: asString(lotSizeFilter?.minOrderQty, "0"),
    minOrderValue: asString(lotSizeFilter?.minOrderAmt, "0"),
  };
}
