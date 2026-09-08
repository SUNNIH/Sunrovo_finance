import Decimal from "decimal.js";
import {
  TRADING_FEE_RATE,
  computeMarketBuyFill,
  computeMarketSellFill,
} from "@/features/crypto/trading-pricing";
import type { SupportedPair } from "@/lib/bybit/instruments";

export interface TradePreview {
  indicativePrice: string;
  notional: string;
  feeAmount: string;
  feeAsset: string;
  netAmount: string;
  netAsset: string;
  isValid: boolean;
  validationError?: string;
}

interface ShortcutQuantityParams {
  percentage: number; // 25, 50, 75, 100
  side: "BUY" | "SELL";
  availableBase: string;
  availableQuote: string;
  price: string;
  quantityPrecision: number;
}

/**
 * Calculates order quantity for 25%, 50%, 75%, and Max shortcuts using Decimal.js.
 * Strictly truncates to the pair's quantity precision with ROUND_DOWN so the resulting
 * order never rounds up or exceeds the available balance.
 */
export function calculateShortcutQuantity({
  percentage,
  side,
  availableBase,
  availableQuote,
  price,
  quantityPrecision,
}: ShortcutQuantityParams): string {
  if (percentage <= 0 || percentage > 100) return "";

  try {
    const fraction = new Decimal(percentage).div(100);

    if (side === "SELL") {
      const base = new Decimal(availableBase || 0);
      if (base.lte(0)) return "";
      const raw = base.mul(fraction);
      const formatted = raw.toFixed(quantityPrecision, Decimal.ROUND_DOWN);
      return new Decimal(formatted).gt(0) ? formatted : "";
    }

    // BUY: spend quote asset to purchase base asset
    const quote = new Decimal(availableQuote || 0);
    const p = new Decimal(price || 0);
    if (quote.lte(0) || p.lte(0)) return "";

    const quoteBudget = quote.mul(fraction);
    const raw = quoteBudget.div(p);
    const formatted = raw.toFixed(quantityPrecision, Decimal.ROUND_DOWN);
    return new Decimal(formatted).gt(0) ? formatted : "";
  } catch {
    return "";
  }
}

interface CalculatePreviewParams {
  side: "BUY" | "SELL";
  orderType: "MARKET" | "LIMIT";
  quantity: string;
  limitPrice: string;
  bestAsk: string;
  bestBid: string;
  pair: SupportedPair;
  availableBase: string;
  availableQuote: string;
}

/**
 * Calculates indicative trading preview (notional, fee, net proceeds/cost)
 * by directly reusing PLT's computeMarketBuyFill / computeMarketSellFill
 * and exact Decimal arithmetic for limit orders.
 */
export function calculateOrderPreview({
  side,
  orderType,
  quantity,
  limitPrice,
  bestAsk,
  bestBid,
  pair,
  availableBase,
  availableQuote,
}: CalculatePreviewParams): TradePreview {
  const fallbackPreview: TradePreview = {
    indicativePrice: "0",
    notional: "0",
    feeAmount: "0",
    feeAsset: side === "BUY" ? pair.baseAsset : pair.quoteAsset,
    netAmount: "0",
    netAsset: side === "BUY" ? pair.baseAsset : pair.quoteAsset,
    isValid: false,
  };

  if (!quantity) return fallbackPreview;

  let qty: Decimal;
  try {
    qty = new Decimal(quantity);
    if (!qty.isFinite() || qty.lte(0)) return fallbackPreview;
  } catch {
    return fallbackPreview;
  }

  // Pre-check minimum quantity
  if (qty.lt(pair.minOrderQuantity)) {
    return {
      ...fallbackPreview,
      validationError: `Minimum order quantity is ${pair.minOrderQuantity} ${pair.baseAsset}`,
    };
  }

  if (orderType === "MARKET") {
    const rawPrice = side === "BUY" ? bestAsk : bestBid;
    let priceDecimal: Decimal;
    try {
      priceDecimal = new Decimal(rawPrice);
      if (!priceDecimal.isFinite() || priceDecimal.lte(0)) return fallbackPreview;
    } catch {
      return fallbackPreview;
    }

    if (side === "BUY") {
      const fill = computeMarketBuyFill(quantity, rawPrice, pair.quantityPrecision, pair.pricePrecision);
      const notionalDec = new Decimal(fill.notional);

      // Check balance
      let error: string | undefined;
      const quoteBal = new Decimal(availableQuote || 0);
      if (quoteBal.lt(notionalDec)) {
        error = `Insufficient ${pair.quoteAsset} balance. Required: ${fill.notional}`;
      } else if (notionalDec.lt(pair.minOrderValue)) {
        error = `Minimum order value is ${pair.minOrderValue} ${pair.quoteAsset}`;
      }

      return {
        indicativePrice: fill.fillPrice,
        notional: fill.notional,
        feeAmount: fill.feeAmount,
        feeAsset: pair.baseAsset,
        netAmount: fill.netBaseQuantity,
        netAsset: pair.baseAsset,
        isValid: !error,
        validationError: error,
      };
    } else {
      const fill = computeMarketSellFill(quantity, rawPrice, pair.pricePrecision);
      const notionalDec = new Decimal(fill.notional);

      let error: string | undefined;
      const baseBal = new Decimal(availableBase || 0);
      if (baseBal.lt(qty)) {
        error = `Insufficient ${pair.baseAsset} balance. Required: ${quantity}`;
      } else if (notionalDec.lt(pair.minOrderValue)) {
        error = `Minimum order value is ${pair.minOrderValue} ${pair.quoteAsset}`;
      }

      return {
        indicativePrice: fill.fillPrice,
        notional: fill.notional,
        feeAmount: fill.feeAmount,
        feeAsset: pair.quoteAsset,
        netAmount: fill.netQuoteAmount,
        netAsset: pair.quoteAsset,
        isValid: !error,
        validationError: error,
      };
    }
  }

  // LIMIT ORDER
  if (!limitPrice) return fallbackPreview;
  let priceDec: Decimal;
  try {
    priceDec = new Decimal(limitPrice);
    if (!priceDec.isFinite() || priceDec.lte(0)) return fallbackPreview;
  } catch {
    return fallbackPreview;
  }

  const notional = qty.mul(priceDec);
  const notionalStr = notional.toFixed(pair.pricePrecision);
  const feeRate = new Decimal(TRADING_FEE_RATE);

  if (side === "BUY") {
    const feeAmount = qty.mul(feeRate).toFixed(pair.quantityPrecision);
    const netBase = qty.sub(new Decimal(feeAmount)).toFixed(pair.quantityPrecision);

    let error: string | undefined;
    const quoteBal = new Decimal(availableQuote || 0);
    if (quoteBal.lt(notional)) {
      error = `Insufficient ${pair.quoteAsset} balance to reserve. Required: ${notionalStr}`;
    } else if (notional.lt(pair.minOrderValue)) {
      error = `Minimum order value is ${pair.minOrderValue} ${pair.quoteAsset}`;
    }

    return {
      indicativePrice: priceDec.toFixed(pair.pricePrecision),
      notional: notionalStr,
      feeAmount,
      feeAsset: pair.baseAsset,
      netAmount: netBase,
      netAsset: pair.baseAsset,
      isValid: !error,
      validationError: error,
    };
  } else {
    const feeAmount = notional.mul(feeRate).toFixed(pair.pricePrecision);
    const netQuote = notional.sub(new Decimal(feeAmount)).toFixed(pair.pricePrecision);

    let error: string | undefined;
    const baseBal = new Decimal(availableBase || 0);
    if (baseBal.lt(qty)) {
      error = `Insufficient ${pair.baseAsset} balance. Required: ${quantity}`;
    } else if (notional.lt(pair.minOrderValue)) {
      error = `Minimum order value is ${pair.minOrderValue} ${pair.quoteAsset}`;
    }

    return {
      indicativePrice: priceDec.toFixed(pair.pricePrecision),
      notional: notionalStr,
      feeAmount,
      feeAsset: pair.quoteAsset,
      netAmount: netQuote,
      netAsset: pair.quoteAsset,
      isValid: !error,
      validationError: error,
    };
  }
}
