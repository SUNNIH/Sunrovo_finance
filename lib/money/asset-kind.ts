const FIAT_SYMBOLS = new Set(["USD", "NGN", "EUR", "GBP"]);

export function isFiatAsset(assetSymbol: string): boolean {
  return FIAT_SYMBOLS.has(assetSymbol.toUpperCase());
}

export function isCryptoAsset(assetSymbol: string): boolean {
  return !isFiatAsset(assetSymbol);
}
