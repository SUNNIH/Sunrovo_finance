"use client";

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import type { SupportedPair } from "@/lib/bybit/instruments";
import type { MarketTicker } from "@/lib/bybit/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TextField } from "@/components/forms/text-field";
import {
  calculateOrderPreview,
  calculateShortcutQuantity,
  type TradePreview,
} from "@/components/financial/trade-helpers";
import { cn } from "@/lib/utilities/cn";

interface WalletAssetView {
  assetSymbol: string;
  available: string;
  locked: string;
  usdValue: string;
}

interface TradeOrderTicketProps {
  pair: SupportedPair;
  ticker: MarketTicker;
  wallet: { assets: WalletAssetView[] } | null;
  initialSide?: "BUY" | "SELL";
  submitting: boolean;
  submitError: string | null;
  submitSuccess: string | null;
  onSubmit: (params: {
    side: "BUY" | "SELL";
    orderType: "MARKET" | "LIMIT";
    quantity: string;
    limitPrice?: string;
  }) => Promise<void>;
}

export function TradeOrderTicket({
  pair,
  ticker,
  wallet,
  initialSide = "BUY",
  submitting,
  submitError,
  submitSuccess,
  onSubmit,
}: TradeOrderTicketProps) {
  const [side, setSide] = React.useState<"BUY" | "SELL">(initialSide);
  const [orderType, setOrderType] = React.useState<"MARKET" | "LIMIT">("MARKET");
  const [quantity, setQuantity] = React.useState("");
  const [limitPrice, setLimitPrice] = React.useState("");

  // Sync side if prop changes
  React.useEffect(() => {
    if (initialSide) setSide(initialSide);
  }, [initialSide]);

  // Extract balances
  const quoteAssetView = wallet?.assets.find((a) => a.assetSymbol === pair.quoteAsset);
  const baseAssetView = wallet?.assets.find((a) => a.assetSymbol === pair.baseAsset);

  const quoteAvailable = quoteAssetView?.available ?? "0";
  const quoteLocked = quoteAssetView?.locked ?? "0";
  const baseAvailable = baseAssetView?.available ?? "0";
  const baseLocked = baseAssetView?.locked ?? "0";

  const activeAvailable = side === "BUY" ? quoteAvailable : baseAvailable;
  const activeLocked = side === "BUY" ? quoteLocked : baseLocked;
  const activeCurrency = side === "BUY" ? pair.quoteAsset : pair.baseAsset;

  // Derive preview
  const preview: TradePreview = React.useMemo(() => {
    return calculateOrderPreview({
      side,
      orderType,
      quantity,
      limitPrice,
      bestAsk: ticker.bestAsk,
      bestBid: ticker.bestBid,
      pair,
      availableBase: baseAvailable,
      availableQuote: quoteAvailable,
    });
  }, [
    side,
    orderType,
    quantity,
    limitPrice,
    ticker.bestAsk,
    ticker.bestBid,
    pair,
    baseAvailable,
    quoteAvailable,
  ]);

  // Percentage shortcut handler
  function handlePercentageClick(percentage: number) {
    const effectivePrice =
      orderType === "LIMIT"
        ? limitPrice || ticker.lastPrice
        : ticker.bestAsk;

    const calculated = calculateShortcutQuantity({
      percentage,
      side,
      availableBase: baseAvailable,
      availableQuote: quoteAvailable,
      price: effectivePrice,
      quantityPrecision: pair.quantityPrecision,
    });

    if (calculated) {
      setQuantity(calculated);
    }
  }

  // Pre-fill limit price with market price
  function handleUseMarketPrice() {
    const marketRef = side === "BUY" ? ticker.bestAsk : ticker.bestBid;
    setLimitPrice(marketRef && marketRef !== "0" ? marketRef : ticker.lastPrice);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !quantity || (orderType === "LIMIT" && !limitPrice)) return;
    if (preview.validationError) return;

    await onSubmit({
      side,
      orderType,
      quantity,
      limitPrice: orderType === "LIMIT" ? limitPrice : undefined,
    });

    // Clear inputs on success
    setQuantity("");
    if (orderType === "LIMIT") {
      setLimitPrice("");
    }
  }

  return (
    <Card className="rounded-xl border-border bg-surface shadow-xs">
      <CardContent className="p-4 sm:p-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* ── Side Switcher: BUY / SELL ──────────────────────────────────── */}
          <div
            role="tablist"
            aria-label="Order side"
            className="grid grid-cols-2 gap-2 rounded-lg bg-surface-elevated p-1 border border-border"
          >
            <button
              type="button"
              role="tab"
              aria-selected={side === "BUY"}
              onClick={() => setSide("BUY")}
              className={cn(
                "touch-target flex items-center justify-center gap-2 rounded-md py-2 text-sm font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                side === "BUY"
                  ? "bg-success text-white shadow-xs"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-hover/70"
              )}
            >
              <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />
              <span>Buy {pair.baseAsset}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={side === "SELL"}
              onClick={() => setSide("SELL")}
              className={cn(
                "touch-target flex items-center justify-center gap-2 rounded-md py-2 text-sm font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                side === "SELL"
                  ? "bg-danger text-white shadow-xs"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-hover/70"
              )}
            >
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              <span>Sell {pair.baseAsset}</span>
            </button>
          </div>

          {/* ── Order Type Switcher: MARKET / LIMIT ─────────────────────────── */}
          <div
            role="tablist"
            aria-label="Order type"
            className="flex rounded-md border border-border bg-surface-elevated p-1"
          >
            {(["MARKET", "LIMIT"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={orderType === t}
                onClick={() => setOrderType(t)}
                className={cn(
                  "touch-target flex-1 rounded py-1.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  orderType === t
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                {t.toLowerCase()}
              </button>
            ))}
          </div>

          {/* ── Available Balance Display ───────────────────────────────────── */}
          <div className="flex items-center justify-between rounded-lg bg-surface-elevated px-3 py-2 border border-border text-xs">
            <span className="text-text-tertiary">Available to {side.toLowerCase()}:</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-medium text-text-primary financial-value">
                {activeAvailable} {activeCurrency}
              </span>
              {Number(activeLocked) > 0 && (
                <span className="text-text-tertiary" title="Locked in open limit orders">
                  (Locked: {activeLocked})
                </span>
              )}
            </div>
          </div>

          {/* ── Limit Price Field (Limit Order only) ────────────────────────── */}
          {orderType === "LIMIT" && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleUseMarketPrice}
                  className="text-xs font-medium text-primary hover:underline cursor-pointer"
                >
                  Use Market ({ticker.lastPrice})
                </button>
              </div>
              <TextField
                id="limit-price-field"
                label={`Limit price (${pair.quoteAsset})`}
                inputMode="decimal"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder={ticker.lastPrice}
                className="financial-value"
              />
            </div>
          )}

          {/* ── Market Price Note (Market Order only) ───────────────────────── */}
          {orderType === "MARKET" && (
            <div className="rounded-lg border border-border bg-surface-elevated/70 p-2.5 text-xs text-text-secondary">
              <div className="flex justify-between">
                <span className="text-text-tertiary">Indicative Market Price:</span>
                <span className="font-mono font-medium text-text-primary financial-value">
                  ~{side === "BUY" ? ticker.bestAsk : ticker.bestBid} {pair.quoteAsset}
                </span>
              </div>
              <p className="mt-1 text-text-tertiary text-[11px]">
                Estimated fill based on order book depth. Actual fill may vary slightly.
              </p>
            </div>
          )}

          {/* ── Quantity Input Field ────────────────────────────────────────── */}
          <TextField
            id="quantity-field"
            label={`Quantity (${pair.baseAsset})`}
            hint={`Min: ${pair.minOrderQuantity} ${pair.baseAsset}`}
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={pair.minOrderQuantity}
            className="financial-value"
          />

          {/* ── Percentage Shortcuts: 25%, 50%, 75%, Max ─────────────────────── */}
          <div className="grid grid-cols-4 gap-1.5">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handlePercentageClick(pct)}
                className="touch-target rounded-md border border-border bg-surface-elevated py-1 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {pct === 100 ? "Max" : `${pct}%`}
              </button>
            ))}
          </div>

          {/* ── Order Preview / Cost Breakdown ──────────────────────────────── */}
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-elevated p-3 text-xs">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-text-tertiary">
                {orderType === "MARKET" ? "Estimated Total:" : "Total (Reserve):"}
              </span>
              <span className="font-mono font-medium text-text-primary financial-value">
                {preview.notional} {pair.quoteAsset}
              </span>
            </div>

            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-text-tertiary">Estimated Fee (0.1%):</span>
              <span className="font-mono text-text-secondary financial-value">
                {preview.feeAmount} {preview.feeAsset}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-1.5 font-medium text-text-primary">
              <span className="text-text-secondary">
                {side === "BUY" ? "Estimated Receive:" : "Estimated Proceeds:"}
              </span>
              <span className="font-mono font-semibold financial-value text-text-primary">
                {preview.netAmount} {preview.netAsset}
              </span>
            </div>
          </div>

          {/* ── Validation & Submission Messages ────────────────────────────── */}
          {preview.validationError && (
            <p role="alert" className="text-xs text-danger">
              {preview.validationError}
            </p>
          )}
          {submitError && (
            <p role="alert" className="text-xs text-danger">
              {submitError}
            </p>
          )}
          {submitSuccess && (
            <p className="text-xs text-success font-medium">
              {submitSuccess}
            </p>
          )}

          {/* ── Submit CTA ─────────────────────────────────────────────────── */}
          <Button
            type="submit"
            variant={side === "BUY" ? "primary" : "danger"}
            size="lg"
            disabled={
              submitting ||
              !quantity ||
              (orderType === "LIMIT" && !limitPrice) ||
              Boolean(preview.validationError)
            }
            className="w-full touch-target font-semibold text-sm cursor-pointer"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Placing order...</span>
              </span>
            ) : (
              <span>
                {orderType === "MARKET"
                  ? `${side === "BUY" ? "Buy" : "Sell"} ${pair.baseAsset} (Market)`
                  : `Place Limit ${side === "BUY" ? "Buy" : "Sell"}`}
              </span>
            )}
          </Button>

          <p className="text-center text-[11px] text-text-tertiary">
            Simulated Spot Trading · Demo funds only
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
