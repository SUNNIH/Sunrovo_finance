/**
 * Supported spot pairs for the MVP (product-scope memory: BTC/USDT,
 * ETH/USDT, SOL/USDT, XRP/USDT, plus the fictional PLT/USDT demo token).
 * `isFictional: true` pairs never hit Bybit — PLT is not a real,
 * tradable security and must always use generated mock data.
 */
export interface SupportedPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  pricePrecision: number;
  quantityPrecision: number;
  minOrderQuantity: string;
  minOrderValue: string;
  isFictional: boolean;
  /** Seed price for deterministic-ish mock data generation. */
  basePriceHint: number;
}

export const SUPPORTED_PAIRS: SupportedPair[] = [
  {
    symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT",
    pricePrecision: 2, quantityPrecision: 6,
    minOrderQuantity: "0.0001", minOrderValue: "5",
    isFictional: false, basePriceHint: 67000,
  },
  {
    symbol: "ETHUSDT", baseAsset: "ETH", quoteAsset: "USDT",
    pricePrecision: 2, quantityPrecision: 5,
    minOrderQuantity: "0.001", minOrderValue: "5",
    isFictional: false, basePriceHint: 3400,
  },
  {
    symbol: "SOLUSDT", baseAsset: "SOL", quoteAsset: "USDT",
    pricePrecision: 3, quantityPrecision: 3,
    minOrderQuantity: "0.01", minOrderValue: "5",
    isFictional: false, basePriceHint: 170,
  },
  {
    symbol: "XRPUSDT", baseAsset: "XRP", quoteAsset: "USDT",
    pricePrecision: 4, quantityPrecision: 1,
    minOrderQuantity: "1", minOrderValue: "5",
    isFictional: false, basePriceHint: 0.53,
  },
  {
    symbol: "PLTUSDT", baseAsset: "PLT", quoteAsset: "USDT",
    pricePrecision: 4, quantityPrecision: 2,
    minOrderQuantity: "1", minOrderValue: "1",
    isFictional: true, basePriceHint: 0.1234,
  },
];

export function getSupportedPair(symbol: string): SupportedPair | undefined {
  return SUPPORTED_PAIRS.find((p) => p.symbol === symbol.toUpperCase());
}

export function isSupportedSymbol(symbol: string): boolean {
  return getSupportedPair(symbol) !== undefined;
}
