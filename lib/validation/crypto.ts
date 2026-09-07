import { z } from "zod";
import Decimal from "decimal.js";

function isPositiveDecimalString(value: string): boolean {
  try {
    return new Decimal(value).gt(0);
  } catch {
    return false;
  }
}

const quantitySchema = z
  .string()
  .trim()
  .min(1, "Enter a quantity")
  .refine(isPositiveDecimalString, "Enter a quantity greater than zero");

export const marketOrderSchema = z.object({
  symbol: z.string().trim().toUpperCase(),
  side: z.enum(["BUY", "SELL"]),
  quantity: quantitySchema,
});
export type MarketOrderInput = z.infer<typeof marketOrderSchema>;

export const limitOrderSchema = z.object({
  symbol: z.string().trim().toUpperCase(),
  side: z.enum(["BUY", "SELL"]),
  quantity: quantitySchema,
  limitPrice: quantitySchema,
});
export type LimitOrderInput = z.infer<typeof limitOrderSchema>;

export const convertQuoteSchema = z.object({
  fromAsset: z.string().trim().toUpperCase(),
  toAsset: z.string().trim().toUpperCase(),
  fromAmount: quantitySchema,
});
export type ConvertQuoteInput = z.infer<typeof convertQuoteSchema>;

export const convertExecuteSchema = z.object({
  quoteId: z.string().min(1),
});
export type ConvertExecuteInput = z.infer<typeof convertExecuteSchema>;

export const watchlistToggleSchema = z.object({
  assetSymbol: z.string().trim().toUpperCase(),
});
export type WatchlistToggleInput = z.infer<typeof watchlistToggleSchema>;
