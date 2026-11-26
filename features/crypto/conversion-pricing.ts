import Decimal from "decimal.js";

import type {
  OrderBook,
} from "@/lib/market/types";

/**
 * Phase 5 — Simulated Cryptocurrency Conversion Pricing
 *
 * Uses visible Bybit spot order-book liquidity.
 *
 * BASE_TO_USDT:
 *   Sell base cryptocurrency against available bids.
 *
 * USDT_TO_BASE:
 *   Buy base cryptocurrency against available asks.
 *
 * No real exchange orders are submitted.
 */

export type ConversionDirection =
  | "BASE_TO_USDT"
  | "USDT_TO_BASE";

export interface ConversionPricingResult {
  rate: Decimal;
  grossAmount: Decimal;
  feeAmount: Decimal;
  netAmount: Decimal;
}

const CONVERSION_FEE_RATE = new Decimal("0.001");

const MAX_BOOK_AGE_MS = 10_000;

const MAX_DECIMAL_PLACES = 18;

/**
 * Reject stale, unavailable, or incorrectly
 * identified order-book snapshots.
 */
export function validateConversionOrderBook(
  book: OrderBook,
  expectedSymbol: string,
  now = Date.now()
): void {
  if (book.symbol !== expectedSymbol) {
    throw new Error(
      "Order book symbol does not match conversion pair"
    );
  }

  if (book.status !== "live") {
    throw new Error(
      "Market data unavailable or stale"
    );
  }

  const timestamp = book.timestamp.getTime();

  const age = now - timestamp;

  if (
    !Number.isFinite(age) ||
    age < -2_000 ||
    age > MAX_BOOK_AGE_MS
  ) {
    throw new Error(
      "Market data is too old for conversion"
    );
  }
}

/**
 * Calculate an executable simulated conversion quote
 * using available order-book liquidity.
 *
 * The entire input amount must be covered by visible
 * liquidity. Partial conversions are not supported.
 */
export function calculateConversionPrice(
  book: OrderBook,
  symbol: string,
  direction: ConversionDirection,
  fromAmount: Decimal,
  now = Date.now()
): ConversionPricingResult {
  validateConversionOrderBook(book, symbol, now);

  if (
    !fromAmount.isFinite() ||
    fromAmount.lte(0) ||
    fromAmount.decimalPlaces() > MAX_DECIMAL_PLACES ||
    fromAmount.gte("1e18")
  ) {
    throw new Error(
      "Invalid conversion amount or precision"
    );
  }

  const isBuyingBase = direction === "USDT_TO_BASE";

  const levels = isBuyingBase
    ? book.asks
    : book.bids;

  if (!levels.length) {
    throw new Error(
      "Insufficient market liquidity"
    );
  }

  let remaining = fromAmount;

  let grossReceived = new Decimal(0);

  let previousPrice: Decimal | null = null;

  for (const level of levels) {
    const price = level.price;
    const quantity = level.quantity;

    if (
      !price.isFinite() ||
      price.lte(0) ||
      !quantity.isFinite() ||
      quantity.lte(0)
    ) {
      throw new Error(
        "Invalid market depth data"
      );
    }

    // Bybit asks must be ascending.
    // Bybit bids must be descending.
    if (previousPrice !== null) {
      if (
        isBuyingBase
          ? price.lt(previousPrice)
          : price.gt(previousPrice)
      ) {
        throw new Error(
          "Order book price levels are incorrectly sorted"
        );
      }
    }

    previousPrice = price;

    if (isBuyingBase) {
      /*
       * USDT → BTC
       *
       * The input amount is a USDT budget.
       * Consume asks until the entire budget
       * is covered.
       */

      const quoteAvailable = price.times(quantity);

      const quoteSpent = Decimal.min(
        quoteAvailable,
        remaining
      );

      const baseReceived = quoteSpent.div(price);

      grossReceived = grossReceived.plus(
        baseReceived
      );

      remaining = remaining.minus(
        quoteSpent
      );

    } else {
      /*
       * BTC → USDT
       *
       * The input amount is BTC quantity.
       * Consume bids until the entire BTC
       * quantity is covered.
       */

      const baseSold = Decimal.min(
        quantity,
        remaining
      );

      const quoteReceived = baseSold.times(
        price
      );

      grossReceived = grossReceived.plus(
        quoteReceived
      );

      remaining = remaining.minus(
        baseSold
      );
    }

    if (remaining.eq(0)) {
      break;
    }
  }

  // Never invent liquidity or silently execute
  // only part of the requested conversion.
  if (!remaining.eq(0)) {
    throw new Error(
      "Insufficient market liquidity for full conversion"
    );
  }

  // Prisma financial amounts use Decimal(36,18).
  // Round received amounts conservatively.
  const grossAmount = grossReceived.toDecimalPlaces(
    MAX_DECIMAL_PLACES,
    Decimal.ROUND_DOWN
  );

  if (
    !grossAmount.isFinite() ||
    grossAmount.lte(0) ||
    grossAmount.gte("1e18")
  ) {
    throw new Error(
      "Conversion amount exceeds supported precision"
    );
  }

  // Fee is charged in the destination asset.
  const feeAmount = grossAmount
    .times(CONVERSION_FEE_RATE)
    .toDecimalPlaces(
      MAX_DECIMAL_PLACES,
      Decimal.ROUND_UP
    );

  const netAmount = grossAmount.minus(
    feeAmount
  );

  if (netAmount.lte(0)) {
    throw new Error(
      "Conversion amount too small after fees"
    );
  }

  // Effective gross destination amount per
  // unit of source asset.
  const rate = grossAmount
    .div(fromAmount)
    .toDecimalPlaces(
      MAX_DECIMAL_PLACES,
      Decimal.ROUND_DOWN
    );

  if (!rate.isFinite() || rate.lte(0)) {
    throw new Error(
      "Invalid conversion exchange rate"
    );
  }

  return {
    rate,
    grossAmount,
    feeAmount,
    netAmount,
  };
}
