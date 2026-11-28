/**
 * Bybit V5 Public Spot API Types
 * 
 * These types represent Bybit's V5 public API responses for spot markets.
 * Internal Sunrovo Finance code should use normalized types from lib/market/types.ts
 * instead of consuming these raw Bybit structures directly.
 */

// ─── Common Response Structure ──────────────────────────────────────────────

export interface BybitResponse<T> {
  retCode: number;
  retMsg: string;
  result: T;
  retExtInfo: Record<string, unknown>;
  time: number;
}

// ─── Ticker ─────────────────────────────────────────────────────────────────

export interface BybitTickerResult {
  category: "spot";
  list: BybitTicker[];
}

export interface BybitTicker {
  symbol: string;
  lastPrice: string;
  highPrice24h: string;
  lowPrice24h: string;
  prevPrice24h: string;
  volume24h: string;
  turnover24h: string;
  price24hPcnt: string; // percentage as decimal string, e.g., "0.0123" = 1.23%
  usdIndexPrice: string;
}

// ─── Instruments ────────────────────────────────────────────────────────────

export interface BybitInstrumentsResult {
  category: "spot";
  list: BybitInstrument[];
  nextPageCursor?: string;
}

export interface BybitInstrument {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  innovation: "0" | "1"; // 0 = normal, 1 = innovation zone
  status: "Trading" | "PreLaunch" | "Delivering" | "Closed";
  marginTrading: "none" | "utaOnly" | "normalSpotOnly" | "both";
  lotSizeFilter: {
    basePrecision: string;
    quotePrecision: string;
    minOrderQty: string;
    maxOrderQty: string;
    minOrderAmt: string;
    maxOrderAmt: string;
  };
  priceFilter: {
    tickSize: string;
  };
}

// ─── Kline / Candlestick ────────────────────────────────────────────────────

export interface BybitKlineResult {
  category: "spot";
  symbol: string;
  list: BybitKline[]; // Sorted in descending order by startTime
}

/**
 * Kline tuple format: [startTime, open, high, low, close, volume, turnover]
 * All numeric values are strings.
 */
export type BybitKline = [
  string, // startTime (ms timestamp)
  string, // open price
  string, // high price
  string, // low price
  string, // close price
  string, // volume
  string, // turnover (quote volume)
];

export type BybitKlineInterval =
  | "1"
  | "3"
  | "5"
  | "15"
  | "30"
  | "60"
  | "120"
  | "240"
  | "360"
  | "720"
  | "D"
  | "W"
  | "M";

// ─── Order Book ─────────────────────────────────────────────────────────────

export interface BybitOrderBookResult {
  s: string; // symbol
  b: [string, string][]; // bids: [price, quantity]
  a: [string, string][]; // asks: [price, quantity]
  ts: number; // timestamp
  u: number; // update ID
}

// ─── Recent Trades ──────────────────────────────────────────────────────────

export interface BybitRecentTradesResult {
  category: "spot";
  list: BybitPublicTrade[];
}

export interface BybitPublicTrade {
  execId: string;
  symbol: string;
  price: string;
  size: string;
  side: "Buy" | "Sell";
  time: string; // millisecond timestamp
  isBlockTrade: boolean;
}

// ─── WebSocket Types ────────────────────────────────────────────────────────

export interface BybitWSRequest {
  op: "subscribe" | "unsubscribe" | "ping";
  args?: string[];
  req_id?: string;
}

export interface BybitWSResponse {
  success: boolean;
  ret_msg: string;
  conn_id: string;
  op: string;
  req_id?: string;
}

export interface BybitWSTickerData {
  topic: string;
  type: "snapshot";
  ts: number;
  data: {
    symbol: string;
    lastPrice: string;
    highPrice24h: string;
    lowPrice24h: string;
    prevPrice24h: string;
    volume24h: string;
    turnover24h: string;
    price24hPcnt: string;
    usdIndexPrice: string;
  };
}

export interface BybitWSKlineData {
  topic: string;
  type: "snapshot";
  ts: number;
  data: Array<{
    start: number;
    end: number;
    interval: string;
    open: string;
    close: string;
    high: string;
    low: string;
    volume: string;
    turnover: string;
    confirm: boolean;
    timestamp: number;
  }>;
}

export interface BybitWSOrderBookData {
  topic: string;
  type: "snapshot" | "delta";
  ts: number;
  data: {
    s: string; // symbol
    b: [string, string][]; // bids
    a: [string, string][]; // asks
    u: number; // update ID
    seq: number; // sequence number
  };
}

export interface BybitWSTradeData {
  topic: string;
  type: "snapshot";
  ts: number;
  data: Array<{
    T: number; // timestamp
    s: string; // symbol
    S: "Buy" | "Sell";
    v: string; // volume
    p: string; // price
    L: string; // tick direction
    i: string; // trade ID
    BT: boolean; // is block trade
  }>;
}
