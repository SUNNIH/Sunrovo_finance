import type { Money } from "./money";

/**
 * Known display precision and formatting hints for supported assets.
 * This is a display-layer convenience map; the authoritative precision
 * lives in the `Asset` database table and should be preferred once the
 * assets API exists (Phase 4). Kept here so Phase 1 components can render
 * believable, correctly-rounded demo values without a DB round-trip.
 */
const ASSET_DISPLAY_PRECISION: Record<string, number> = {
  USD: 2,
  NGN: 2,
  EUR: 2,
  GBP: 2,
  USDT: 2,
  BTC: 8,
  ETH: 6,
  SOL: 4,
  XRP: 4,
  PLT: 4,
};

const FIAT_SYMBOLS: Record<string, string> = {
  USD: "$",
  NGN: "\u20A6",
  EUR: "\u20AC",
  GBP: "\u00A3",
};

export function getAssetPrecision(assetSymbol: string): number {
  return ASSET_DISPLAY_PRECISION[assetSymbol] ?? 2;
}

/**
 * Format a Money (or raw numeric string) for UI display. Callers must pair
 * this with the `.tabular-nums` / `.financial-value` CSS class so digits
 * align in tables and cards (design memory: "Financial values must use
 * tabular numerals").
 */
export function formatMoney(
  amount: Money | string,
  assetSymbol: string,
  options?: { showSymbol?: boolean; locale?: string }
): string {
  const precision = getAssetPrecision(assetSymbol);
  const value = typeof amount === "string" ? amount : amount.toFixed(precision);
  const locale = options?.locale ?? "en-US";

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(Number(value));

  const showSymbol = options?.showSymbol ?? true;
  if (!showSymbol) return formatted;

  const fiatSymbol = FIAT_SYMBOLS[assetSymbol];
  if (fiatSymbol) return `${fiatSymbol}${formatted}`;
  return `${formatted} ${assetSymbol}`;
}

export function formatPercent(value: number, options?: { alwaysSign?: boolean }): string {
  const sign = options?.alwaysSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}
