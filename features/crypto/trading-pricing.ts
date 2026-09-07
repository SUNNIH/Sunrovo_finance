import Decimal from "decimal.js";

/**
 * Pure trading-engine math, deliberately free of any Prisma/DB import
 * (same pattern as features/banking/transfer-pricing.ts) so it's fully
 * unit-testable. `features/crypto/trading.ts` is the impure layer that
 * wraps this with balance checks and ledger postings.
 */

/** Flat 0.1% taker fee for simulated market orders. */
export const TRADING_FEE_RATE = "0.001";

export interface MarketBuyFill {
  fillPrice: string;
  notional: string; // quote-asset amount spent
  feeAmount: string; // charged in the base asset (you receive slightly less)
  netBaseQuantity: string; // base asset actually credited to the buyer
}

export interface MarketSellFill {
  fillPrice: string;
  notional: string; // quote-asset amount before fee
  feeAmount: string; // charged in the quote asset (you receive slightly less)
  netQuoteAmount: string; // quote asset actually credited to the seller
}

export function computeMarketBuyFill(
  quantity: string,
  askPrice: string,
  basePrecision: number,
  quotePrecision: number
): MarketBuyFill {
  const qty = new Decimal(quantity);
  const price = new Decimal(askPrice);
  const notional = qty.mul(price);
  const fee = qty.mul(TRADING_FEE_RATE);
  const netQuantity = qty.sub(fee);

  return {
    fillPrice: price.toFixed(quotePrecision),
    notional: notional.toFixed(quotePrecision),
    feeAmount: fee.toFixed(basePrecision),
    netBaseQuantity: netQuantity.toFixed(basePrecision),
  };
}

export function computeMarketSellFill(quantity: string, bidPrice: string, quotePrecision: number): MarketSellFill {
  const qty = new Decimal(quantity);
  const price = new Decimal(bidPrice);
  const notional = qty.mul(price);
  const fee = notional.mul(TRADING_FEE_RATE);
  const netNotional = notional.sub(fee);

  return {
    fillPrice: price.toFixed(quotePrecision),
    notional: notional.toFixed(quotePrecision),
    feeAmount: fee.toFixed(quotePrecision),
    netQuoteAmount: netNotional.toFixed(quotePrecision),
  };
}

/** True when a BUY limit order's price crosses the current ask (i.e. should fill). */
export function limitBuyShouldFill(limitPrice: string, currentAsk: string): boolean {
  return new Decimal(limitPrice).gte(currentAsk);
}

/** True when a SELL limit order's price crosses the current bid (i.e. should fill). */
export function limitSellShouldFill(limitPrice: string, currentBid: string): boolean {
  return new Decimal(limitPrice).lte(currentBid);
}
