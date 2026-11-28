import Decimal from "decimal.js";
import type { OrderBook } from "@/lib/market/types";

/**
 * Conservative all-or-none simulated fill based on visible Bybit spot depth.
 * Never claim fillable volume outside the snapshot.
 * Never fill at a price worse than the user's limit.
 */
export interface LimitFill {
  grossQuote: Decimal;
  averagePrice: Decimal;
}

export const MAX_ORDER_BOOK_AGE_MS = 10_000;

export function isFreshOrderBook(
  book: OrderBook,
  symbol: string,
  now = Date.now()
): boolean {
  const age = now - book.timestamp.getTime();

  return (
    book.symbol === symbol &&
    book.status === "live" &&
    Number.isFinite(age) &&
    age >= -2_000 &&
    age <= MAX_ORDER_BOOK_AGE_MS
  );
}

export function calculateFullLimitFill(
  side: "BUY" | "SELL",
  quantity: Decimal,
  limitPrice: Decimal,
  book: OrderBook
): LimitFill | null {
  if (
    !quantity.isFinite() ||
    quantity.lte(0) ||
    !limitPrice.isFinite() ||
    limitPrice.lte(0)
  ) {
    return null;
  }

  const levels = side === "BUY" ? book.asks : book.bids;

  let remaining = quantity;
  let grossQuote = new Decimal(0);
  let previousPrice: Decimal | null = null;

  for (const level of levels) {
    const { price, quantity: depthQuantity } = level;

    if (
      !price.isFinite() ||
      price.lte(0) ||
      !depthQuantity.isFinite() ||
      depthQuantity.lte(0)
    ) {
      return null;
    }

    // Reject incorrectly sorted market data.
    if (
      previousPrice &&
      (side === "BUY"
        ? price.lt(previousPrice)
        : price.gt(previousPrice))
    ) {
      return null;
    }

    previousPrice = price;

    // BUY: Ask must not exceed limit.
    // SELL: Bid must not fall below limit.
    if (
      side === "BUY"
        ? price.gt(limitPrice)
        : price.lt(limitPrice)
    ) {
      break;
    }

    const atLevel = Decimal.min(depthQuantity, remaining);

    grossQuote = grossQuote.plus(atLevel.times(price));
    remaining = remaining.minus(atLevel);

    if (remaining.eq(0)) {
      break;
    }
  }

  // This implementation does not support partial fills.
  if (
    !remaining.eq(0) ||
    grossQuote.lte(0) ||
    !grossQuote.isFinite()
  ) {
    return null;
  }

  // Fail closed rather than silently rounding settlement amounts.
  if (grossQuote.decimalPlaces() > 18) {
    return null;
  }

  const averagePrice = grossQuote
    .div(quantity)
    .toDecimalPlaces(18, Decimal.ROUND_HALF_UP);

  return {
    grossQuote,
    averagePrice,
  };
}