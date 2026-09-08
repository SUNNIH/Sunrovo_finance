"use client";

import * as React from "react";
import { ArrowDownUp, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { SUPPORTED_PAIRS } from "@/lib/bybit/instruments";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CryptoAssetIcon, getCryptoAssetMeta } from "@/components/financial/crypto-asset-icon";
import {
  ConvertReceipt,
  type ConversionReceiptData,
} from "@/components/financial/convert-receipt";
import { postJson, postJsonIdempotent, ApiRequestError } from "@/lib/utilities/api-client";
import { generateClientId } from "@/lib/utilities/id";
import { cn } from "@/lib/utilities/cn";

interface WalletAssetView {
  assetSymbol: string;
  available: string;
}

const ALL_ASSETS = [
  "USDT",
  ...SUPPORTED_PAIRS.filter((p) => !p.isFictional || p.baseAsset === "PLT").map((p) => p.baseAsset),
];

interface ConvertQuote {
  id: string;
  fromAsset: string;
  toAsset: string;
  fromAmount: string;
  toAmount: string;
  rate: string;
  feeAmount: string;
  expiresAt: string;
}

interface ConversionApiResponse {
  conversion: ConversionReceiptData;
}

export function ConvertClient({ assets }: { assets: WalletAssetView[] }) {
  const [fromAsset, setFromAsset] = React.useState("USDT");
  const [toAsset, setToAsset] = React.useState("BTC");
  const [amount, setAmount] = React.useState("");
  const [quote, setQuote] = React.useState<ConvertQuote | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [loadingQuote, setLoadingQuote] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [completedConversion, setCompletedConversion] = React.useState<ConversionReceiptData | null>(null);

  const availableBalance = assets.find((a) => a.assetSymbol === fromAsset)?.available ?? "0";
  const fromMeta = getCryptoAssetMeta(fromAsset);
  const toMeta = getCryptoAssetMeta(toAsset);

  // Quote real-expiry timer
  React.useEffect(() => {
    if (!quote) return;

    function updateTimer() {
      const remaining = Math.max(0, Math.round((new Date(quote!.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
    }

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [quote]);

  const isQuoteExpired = Boolean(quote && secondsLeft <= 0);

  function swapAssets() {
    setFromAsset(toAsset);
    setToAsset(fromAsset);
    setQuote(null);
    setError(null);
  }

  function onFromChange(next: string) {
    setFromAsset(next);
    if (next !== "USDT" && toAsset !== "USDT") setToAsset("USDT");
    setQuote(null);
    setError(null);
  }

  function onToChange(next: string) {
    setToAsset(next);
    if (next !== "USDT" && fromAsset !== "USDT") setFromAsset("USDT");
    setQuote(null);
    setError(null);
  }

  async function getQuote() {
    setError(null);
    setLoadingQuote(true);
    try {
      const result = await postJson<{ quote: ConvertQuote }>("/api/quotes/convert", {
        fromAsset,
        toAsset,
        fromAmount: amount,
      });
      setQuote(result.quote);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Unable to generate conversion quote.");
    } finally {
      setLoadingQuote(false);
    }
  }

  async function confirmConversion() {
    if (!quote || isQuoteExpired) return;
    setError(null);
    setConfirming(true);

    try {
      const result = await postJsonIdempotent<ConversionApiResponse>(
        "/api/conversions",
        { quoteId: quote.id },
        generateClientId()
      );
      setCompletedConversion(result.conversion);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Conversion could not be processed.");
    } finally {
      setConfirming(false);
    }
  }

  function resetFlow() {
    setCompletedConversion(null);
    setQuote(null);
    setAmount("");
    setError(null);
  }

  // ── Render Receipt View ─────────────────────────────────────────────────
  if (completedConversion) {
    return <ConvertReceipt conversion={completedConversion} onReset={resetFlow} />;
  }

  // ── Render Conversion Form / Review ─────────────────────────────────────
  return (
    <Card className="mx-auto w-full max-w-xl rounded-2xl border-border bg-surface shadow-xs">
      <CardContent className="flex flex-col gap-5 p-5 sm:p-7">
        {/* ── FROM ASSET SECTION ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-elevated p-4">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <label htmlFor="from-amount-input" className="font-medium text-text-secondary">
              You Pay / Convert
            </label>
            <span className="text-text-tertiary">
              Available:{" "}
              <strong className="font-mono financial-value font-medium text-text-primary">
                {availableBalance} {fromAsset}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Asset Selector */}
            <div className="relative flex shrink-0 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 shadow-xs">
              <CryptoAssetIcon symbol={fromAsset} size="sm" showBadge />
              <select
                id="from-asset-select"
                value={fromAsset}
                onChange={(e) => onFromChange(e.target.value)}
                aria-label="Source asset"
                className="touch-target appearance-none bg-transparent pr-4 text-sm font-semibold text-text-primary cursor-pointer focus-visible:outline-none"
              >
                {ALL_ASSETS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount Input */}
            <input
              id="from-amount-input"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setQuote(null);
                setError(null);
              }}
              placeholder="0.00"
              className="financial-value h-11 w-full flex-1 rounded-lg border border-border bg-surface px-3 text-right text-base font-semibold text-text-primary placeholder:text-text-tertiary shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <span className="text-[11px] text-text-tertiary">{fromMeta.name}</span>
        </div>

        {/* ── SWAP CONTROL ───────────────────────────────────────────────── */}
        <div className="relative flex items-center justify-center -my-2">
          <div className="absolute inset-x-0 h-px bg-border" aria-hidden="true" />
          <button
            type="button"
            onClick={swapAssets}
            aria-label="Swap from and to assets"
            className="touch-target relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-text-secondary shadow-xs transition-transform hover:scale-110 hover:bg-surface-hover hover:text-text-primary active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowDownUp className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* ── TO ASSET SECTION ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-elevated p-4">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <label htmlFor="to-asset-select" className="font-medium text-text-secondary">
              You Receive (Estimated)
            </label>
            {quote && (
              <span className="font-mono text-xs text-text-tertiary financial-value">
                Rate: 1 {quote.fromAsset} = {quote.rate} {quote.toAsset}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Asset Selector */}
            <div className="relative flex shrink-0 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 shadow-xs">
              <CryptoAssetIcon symbol={toAsset} size="sm" showBadge />
              <select
                id="to-asset-select"
                value={toAsset}
                onChange={(e) => onToChange(e.target.value)}
                aria-label="Destination asset"
                className="touch-target appearance-none bg-transparent pr-4 text-sm font-semibold text-text-primary cursor-pointer focus-visible:outline-none"
              >
                {ALL_ASSETS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Read-only estimated receive or placeholder */}
            <div className="flex h-11 flex-1 items-center justify-end rounded-lg border border-border/70 bg-surface/60 px-3 text-right">
              <span
                className={cn(
                  "financial-value font-mono text-base font-semibold",
                  quote ? "text-success" : "text-text-tertiary"
                )}
              >
                {quote ? quote.toAmount : "—"}
              </span>
            </div>
          </div>

          <span className="text-[11px] text-text-tertiary">{toMeta.name}</span>
        </div>

        {/* ── Error Banner ───────────────────────────────────────────────── */}
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl bg-danger-soft p-3 text-xs font-medium text-danger animate-slide-up"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Initial Quote CTA ──────────────────────────────────────────── */}
        {!quote && (
          <Button
            type="button"
            size="lg"
            disabled={!amount || loadingQuote}
            onClick={getQuote}
            className="touch-target w-full text-sm font-semibold cursor-pointer"
          >
            {loadingQuote ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Getting live quote...</span>
              </span>
            ) : (
              <span>Preview Conversion Quote</span>
            )}
          </Button>
        )}

        {/* ── ACTIVE QUOTE REVIEW STATE ──────────────────────────────────── */}
        {quote && (
          <div className="flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary-soft/30 p-4 animate-fade-in sm:p-5">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <span className="text-xs font-semibold text-text-primary">
                Conversion Quote Review
              </span>

              {isQuoteExpired ? (
                <Badge variant="danger" className="text-[11px] font-semibold">
                  Quote Expired
                </Badge>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  <span>Expires in:</span>
                  <span className="font-mono font-bold text-text-primary financial-value">
                    {secondsLeft}s
                  </span>
                </div>
              )}
            </div>

            {/* Quote details */}
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between text-text-secondary">
                <span>You Convert</span>
                <span className="financial-value font-mono font-medium text-text-primary">
                  {quote.fromAmount} {quote.fromAsset}
                </span>
              </div>

              <div className="flex justify-between text-text-secondary">
                <span>You Receive</span>
                <span className="financial-value font-mono font-semibold text-success">
                  {quote.toAmount} {quote.toAsset}
                </span>
              </div>

              <div className="flex justify-between text-text-secondary">
                <span>Exchange Rate</span>
                <span className="financial-value font-mono text-text-primary">
                  1 {quote.fromAsset} = {quote.rate} {quote.toAsset}
                </span>
              </div>

              <div className="flex justify-between text-text-secondary">
                <span>Conversion Fee</span>
                <span className="financial-value font-mono text-text-tertiary">
                  {quote.feeAmount} {quote.toAsset}
                </span>
              </div>
            </div>

            {/* Expired message callout */}
            {isQuoteExpired && (
              <div className="rounded-lg bg-danger-soft p-2.5 text-xs text-danger">
                This quote has expired. Please refresh the quote to receive the current rate.
              </div>
            )}

            {/* Confirm or Refresh Actions */}
            <div className="flex flex-col gap-2 pt-1">
              {isQuoteExpired ? (
                <Button
                  type="button"
                  size="lg"
                  disabled={loadingQuote}
                  onClick={getQuote}
                  className="touch-target w-full font-semibold cursor-pointer"
                >
                  <RefreshCw className={cn("mr-2 h-4 w-4", loadingQuote && "animate-spin")} />
                  Refresh Quote
                </Button>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  disabled={confirming}
                  onClick={confirmConversion}
                  className="touch-target w-full font-semibold cursor-pointer"
                >
                  {confirming ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Converting assets...</span>
                    </span>
                  ) : (
                    <span>
                      Confirm Conversion ({quote.fromAmount} {quote.fromAsset} → {quote.toAmount} {quote.toAsset})
                    </span>
                  )}
                </Button>
              )}

              <button
                type="button"
                onClick={() => setQuote(null)}
                className="touch-target py-1.5 text-xs font-medium text-text-tertiary hover:text-text-primary cursor-pointer"
              >
                Change Amount or Assets
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
