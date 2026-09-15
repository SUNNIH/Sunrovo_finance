import "server-only";
import Decimal from "decimal.js";
import { isFiatAsset } from "./asset-kind";

/**
 * Approximate FX rates for fiat currencies to USD.
 * In a production system, these would come from a real FX data provider.
 * These rates are used for policy enforcement only, not for actual conversion.
 */
const FIAT_USD_APPROX_RATE: Record<string, Decimal.Value> = {
  USD: 1,
  EUR: 1.08, // 1 EUR ≈ 1.08 USD
  GBP: 1.27, // 1 GBP ≈ 1.27 USD
  NGN: 0.00066, // 1 NGN ≈ 0.00066 USD (≈1500 NGN per USD)
};

/**
 * Minimum withdrawal amount in USD equivalent.
 * This is the authoritative source for the policy.
 */
export const MINIMUM_WITHDRAWAL_USD = new Decimal(100);

/**
 * Estimate the USD-equivalent value of an amount in any asset.
 *
 * Phase 8: Crypto withdrawals removed from product surface. This function is now
 * only used for fiat withdrawal minimum enforcement.
 *
 * For fiat: uses approximate FX rates.
 * For USDT: 1:1 with USD (stablecoin) - kept defensively though crypto withdrawals removed.
 * For other crypto: throws error (defensive - should not be reached since crypto withdrawals rejected at service level).
 *
 * @param assetSymbol - The asset symbol (USD, GBP, etc.)
 * @param amount - The amount as a string
 * @returns USD-equivalent value as Decimal
 * @throws Error if pricing cannot be determined
 */
export async function estimateUsdValue(assetSymbol: string, amount: string): Promise<Decimal> {
  const amountDecimal = new Decimal(amount);

  // Fiat currencies
  if (isFiatAsset(assetSymbol)) {
    const rate = FIAT_USD_APPROX_RATE[assetSymbol];
    if (!rate) {
      throw new Error(`No FX rate available for ${assetSymbol}`);
    }
    return amountDecimal.mul(rate);
  }

  // USDT is 1:1 with USD (stablecoin)
  if (assetSymbol === "USDT") {
    return amountDecimal;
  }

  // Phase 8: Crypto withdrawals removed from product surface
  // This error is defensive - should not be reached since crypto withdrawals
  // are rejected at the service level before reaching pricing logic
  throw new Error(
    `Crypto withdrawal pricing is no longer supported. ` +
    `Asset ${assetSymbol} is not a supported fiat currency. ` +
    `Only fiat withdrawals to bank accounts are available.`
  );
}

/**
 * Check if an amount meets the minimum withdrawal requirement.
 *
 * @param assetSymbol - The asset symbol
 * @param amount - The amount as a string
 * @returns true if >= $100 USD equivalent, false otherwise
 * @throws Error if pricing cannot be determined
 */
export async function meetsMinimumWithdrawal(assetSymbol: string, amount: string): Promise<boolean> {
  const usdValue = await estimateUsdValue(assetSymbol, amount);
  return usdValue.gte(MINIMUM_WITHDRAWAL_USD);
}
