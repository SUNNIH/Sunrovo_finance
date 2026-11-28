/**
 * Bybit Response Normalization
 * 
 * Transforms Bybit V5 API responses into internal Sunrovo Finance types.
 * Ensures decimal precision and consistent data structures.
 */

import { Decimal } from "decimal.js";
import type {
  BybitTicker,
  BybitInstrument,
  BybitKline,
  BybitOrderBookResult,
  BybitPublicTrade,
  BybitWSTickerData,
  BybitWSKlineData,
  BybitWSOrderBookData,
  BybitWSTradeData,
  BybitKlineInterval,
} from "./types";
import type {
  MarketTicker,
  TradingInstrument,
  Candlestick,
  OrderBook,
  OrderBookLevel,
  PublicTrade,
  CandlestickInterval,
  MarketDataStatus,
} from "@/lib/market/types";

// ─── Ticker Normalization ───────────────────────────────────────────────────

export function normalizeTickerResponse(
  ticker: BybitTicker,
  status: MarketDataStatus = "live"
): MarketTicker {
  const lastPrice = new Decimal(ticker.lastPrice);
  const prevPrice = new Decimal(ticker.prevPrice24h);
  const priceChange = lastPrice.minus(prevPrice);
  const priceChangePercent = new Decimal(ticker.price24hPcnt);

  return {
    symbol: ticker.symbol,
    lastPrice,
    high24h: new Decimal(ticker.highPrice24h),
    low24h: new Decimal(ticker.lowPrice24h),
    priceChange24h: priceChange,
    priceChangePercent24h: priceChangePercent,
    volume24h: new Decimal(ticker.volume24h),
    quoteVolume24h: new Decimal(ticker.turnover24h),
    timestamp: new Date(),
    status,
  };
}

export function normalizeWSTickerData(
  data: BybitWSTickerData,
  status: MarketDataStatus = "live"
): MarketTicker {
  const tickerData = data.data;
  const lastPrice = new Decimal(tickerData.lastPrice);
  const prevPrice = new Decimal(tickerData.prevPrice24h);
  const priceChange = lastPrice.minus(prevPrice);
  const priceChangePercent = new Decimal(tickerData.price24hPcnt);

  return {
    symbol: tickerData.symbol,
    lastPrice,
    high24h: new Decimal(tickerData.highPrice24h),
    low24h: new Decimal(tickerData.lowPrice24h),
    priceChange24h: priceChange,
    priceChangePercent24h: priceChangePercent,
    volume24h: new Decimal(tickerData.volume24h),
    quoteVolume24h: new Decimal(tickerData.turnover24h),
    timestamp: new Date(data.ts),
    status,
  };
}

// ─── Instrument Normalization ───────────────────────────────────────────────

export function normalizeInstrument(
  instrument: BybitInstrument
): TradingInstrument {
  const status =
    instrument.status === "Trading"
      ? "active"
      : instrument.status === "PreLaunch"
        ? "prelisting"
        : "inactive";

  return {
    symbol: instrument.symbol,
    baseAsset: instrument.baseCoin,
    quoteAsset: instrument.quoteCoin,
    status,
    minOrderQuantity: new Decimal(instrument.lotSizeFilter.minOrderQty),
    maxOrderQuantity: new Decimal(instrument.lotSizeFilter.maxOrderQty),
    minOrderValue: new Decimal(instrument.lotSizeFilter.minOrderAmt),
    maxOrderValue: new Decimal(instrument.lotSizeFilter.maxOrderAmt),
    pricePrecision: countDecimals(instrument.priceFilter.tickSize),
    quantityPrecision: countDecimals(instrument.lotSizeFilter.basePrecision),
    tickSize: new Decimal(instrument.priceFilter.tickSize),
  };
}

// ─── Kline Normalization ────────────────────────────────────────────────────

const BYBIT_TO_INTERNAL_INTERVAL: Record<BybitKlineInterval, CandlestickInterval> = {
  "1": "1m",
  "3": "3m",
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "60": "1h",
  "120": "2h",
  "240": "4h",
  "360": "6h",
  "720": "12h",
  D: "1d",
  W: "1w",
  M: "1M",
};

export function normalizeKline(
  symbol: string,
  kline: BybitKline,
  interval: BybitKlineInterval,
  isFinal = true
): Candlestick {
  const [startTime, open, high, low, close, volume, turnover] = kline;
  const openTimeMs = parseInt(startTime, 10);
  const internalInterval = BYBIT_TO_INTERNAL_INTERVAL[interval];

  // Calculate close time based on interval
  const intervalMs = getIntervalMs(internalInterval);
  const closeTimeMs = openTimeMs + intervalMs - 1;

  return {
    symbol,
    interval: internalInterval,
    openTime: new Date(openTimeMs),
    closeTime: new Date(closeTimeMs),
    open: new Decimal(open),
    high: new Decimal(high),
    low: new Decimal(low),
    close: new Decimal(close),
    volume: new Decimal(volume),
    quoteVolume: new Decimal(turnover),
    isFinal,
  };
}

export function normalizeWSKlineData(data: BybitWSKlineData): Candlestick[] {
  return data.data.map((candle) => {
    const internalInterval = BYBIT_TO_INTERNAL_INTERVAL[
      candle.interval as BybitKlineInterval
    ] ?? "1m";

    return {
      symbol: data.topic.split(".")[2] ?? "", // topic format: "kline.{interval}.{symbol}"
      interval: internalInterval,
      openTime: new Date(candle.start),
      closeTime: new Date(candle.end),
      open: new Decimal(candle.open),
      high: new Decimal(candle.high),
      low: new Decimal(candle.low),
      close: new Decimal(candle.close),
      volume: new Decimal(candle.volume),
      quoteVolume: new Decimal(candle.turnover),
      isFinal: candle.confirm,
    };
  });
}

// ─── Order Book Normalization ───────────────────────────────────────────────

export function normalizeOrderBook(
  data: BybitOrderBookResult,
  status: MarketDataStatus = "live"
): OrderBook {
  const bids: OrderBookLevel[] = data.b.map(([price, quantity]) => ({
    price: new Decimal(price),
    quantity: new Decimal(quantity),
  }));

  const asks: OrderBookLevel[] = data.a.map(([price, quantity]) => ({
    price: new Decimal(price),
    quantity: new Decimal(quantity),
  }));

  // Bybit returns bids in descending order and asks in ascending order (correct)
  return {
    symbol: data.s,
    bids,
    asks,
    timestamp: new Date(data.ts),
    updateId: data.u,
    status,
  };
}

export function normalizeWSOrderBookData(
  data: BybitWSOrderBookData,
  status: MarketDataStatus = "live"
): OrderBook {
  const bookData = data.data;

  const bids: OrderBookLevel[] = bookData.b.map(([price, quantity]) => ({
    price: new Decimal(price),
    quantity: new Decimal(quantity),
  }));

  const asks: OrderBookLevel[] = bookData.a.map(([price, quantity]) => ({
    price: new Decimal(price),
    quantity: new Decimal(quantity),
  }));

  return {
    symbol: bookData.s,
    bids,
    asks,
    timestamp: new Date(data.ts),
    updateId: bookData.u,
    status,
  };
}

// ─── Public Trade Normalization ─────────────────────────────────────────────

export function normalizePublicTrade(trade: BybitPublicTrade): PublicTrade {
  const price = new Decimal(trade.price);
  const quantity = new Decimal(trade.size);

  return {
    id: trade.execId,
    symbol: trade.symbol,
    price,
    quantity,
    quoteQuantity: price.times(quantity),
    side: trade.side === "Buy" ? "buy" : "sell",
    timestamp: new Date(parseInt(trade.time, 10)),
    isBlockTrade: trade.isBlockTrade,
  };
}

export function normalizeWSTradeData(data: BybitWSTradeData): PublicTrade[] {
  return data.data.map((trade) => {
    const price = new Decimal(trade.p);
    const quantity = new Decimal(trade.v);

    return {
      id: trade.i,
      symbol: trade.s,
      price,
      quantity,
      quoteQuantity: price.times(quantity),
      side: trade.S === "Buy" ? "buy" : "sell",
      timestamp: new Date(trade.T),
      isBlockTrade: trade.BT,
    };
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Count decimal places in a numeric string.
 * Used to determine precision from Bybit's tickSize/basePrecision strings.
 */
function countDecimals(value: string): number {
  const decimal = new Decimal(value);
  if (decimal.isZero()) return 0;

  const normalized = decimal.toFixed();
  const parts = normalized.split(".");
  return parts[1] ? parts[1].length : 0;
}

/**
 * Convert candlestick interval to milliseconds.
 */
function getIntervalMs(interval: CandlestickInterval): number {
  const map: Record<CandlestickInterval, number> = {
    "1m": 60_000,
    "3m": 180_000,
    "5m": 300_000,
    "15m": 900_000,
    "30m": 1_800_000,
    "1h": 3_600_000,
    "2h": 7_200_000,
    "4h": 14_400_000,
    "6h": 21_600_000,
    "12h": 43_200_000,
    "1d": 86_400_000,
    "1w": 604_800_000,
    "1M": 2_592_000_000, // approximate 30 days
  };
  return map[interval] ?? 60_000;
}

/**
 * Convert internal interval to Bybit interval format.
 */
export function toBybitInterval(interval: CandlestickInterval): BybitKlineInterval {
  const map: Record<CandlestickInterval, BybitKlineInterval> = {
    "1m": "1",
    "3m": "3",
    "5m": "5",
    "15m": "15",
    "30m": "30",
    "1h": "60",
    "2h": "120",
    "4h": "240",
    "6h": "360",
    "12h": "720",
    "1d": "D",
    "1w": "W",
    "1M": "M",
  };
  return map[interval] ?? "1";
}
