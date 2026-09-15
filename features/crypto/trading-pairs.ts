/**
 * Historical Trading Pair Metadata
 * 
 * Phase 7: Local helper for Phase 5 order cleanup.
 * Preserves trading pair structure data needed to release locked balances
 * from historical OPEN orders without depending on Bybit infrastructure.
 * 
 * This data represents the retired trading functionality and is retained
 * only for safe cleanup of historical order state.
 */

export interface TradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  pricePrecision: number;
  quantityPrecision: number;
}

/**
 * Historical trading pairs that may exist in legacy OPEN orders.
 * Used exclusively for Phase 5 order cleanup to determine which asset
 * was locked by a BUY or SELL order.
 */
const HISTORICAL_TRADING_PAIRS: TradingPair[] = [
  {
    symbol: "BTCUSDT",
    baseAsset: "BTC",
    quoteAsset: "USDT",
    pricePrecision: 2,
    quantityPrecision: 6,
  },
  {
    symbol: "ETHUSDT",
    baseAsset: "ETH",
    quoteAsset: "USDT",
    pricePrecision: 2,
    quantityPrecision: 5,
  },
  {
    symbol: "SOLUSDT",
    baseAsset: "SOL",
    quoteAsset: "USDT",
    pricePrecision: 3,
    quantityPrecision: 3,
  },
  {
    symbol: "XRPUSDT",
    baseAsset: "XRP",
    quoteAsset: "USDT",
    pricePrecision: 4,
    quantityPrecision: 1,
  },
  {
    symbol: "PLTUSDT",
    baseAsset: "PLT",
    quoteAsset: "USDT",
    pricePrecision: 4,
    quantityPrecision: 2,
  },
];

/**
 * Look up historical trading pair metadata by symbol.
 * Case-insensitive.
 * 
 * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
 * @returns Trading pair metadata or undefined if not found
 */
export function getHistoricalTradingPair(symbol: string): TradingPair | undefined {
  return HISTORICAL_TRADING_PAIRS.find((p) => p.symbol === symbol.toUpperCase());
}
