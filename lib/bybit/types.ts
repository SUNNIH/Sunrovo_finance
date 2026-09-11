/**
 * FHT-owned market data types. The UI and all business logic depend only
 * on these — never on Bybit's raw response shape. `lib/bybit/normalisers.ts`
 * is the one place raw Bybit JSON gets converted into these.
 */

export interface MarketTicker {
  symbol: string; // e.g. "BTCUSDT"
  baseAsset: string; // e.g. "BTC"
  quoteAsset: string; // e.g. "USDT"
  lastPrice: string;
  change24hPercent: string;
  high24h: string;
  low24h: string;
  volume24h: string;
  bestBid: string;
  bestAsk: string;
  updatedAt: string; // ISO timestamp
  /** True when this reflects the mock-data fallback rather than a live Bybit read. */
  isStale: boolean;
}

export interface Candle {
  openTime: string; // ISO timestamp
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export type KlineInterval = "1" | "5" | "15" | "60" | "240" | "D";

export interface OrderBookLevel {
  price: string;
  quantity: string;
}

export interface OrderBookSnapshot {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  updatedAt: string;
  isStale: boolean;
}

export interface RecentTrade {
  id: string;
  price: string;
  quantity: string;
  side: "BUY" | "SELL";
  executedAt: string;
}

export interface InstrumentInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  pricePrecision: number;
  quantityPrecision: number;
  minOrderQuantity: string;
  minOrderValue: string;
}
