"use client";

import * as React from "react";
import { ArrowDown, CheckCircle2 } from "lucide-react";
import { SUPPORTED_PAIRS } from "@/lib/bybit/instruments";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { postJson, postJsonIdempotent, ApiRequestError } from "@/lib/utilities/api-client";
import { generateClientId } from "@/lib/utilities/id";

interface WalletAssetView {
  assetSymbol: string;
  available: string;
}

const ALL_ASSETS = ["USDT", ...SUPPORTED_PAIRS.filter((p) => !p.isFictional || p.baseAsset === "PLT").map((p) => p.baseAsset)];

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

export function ConvertClient({ assets }: { assets: WalletAssetView[] }) {
  const [fromAsset, setFromAsset] = React.useState("USDT");
  const [toAsset, setToAsset] = React.useState("BTC");
  const [amount, setAmount] = React.useState("");
  const [quote, setQuote] = React.useState<ConvertQuote | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [loadingQuote, setLoadingQuote] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const availableBalance = assets.find((a) => a.assetSymbol === fromAsset)?.available ?? "0";

  React.useEffect(() => {
    if (!quote) return;
    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.round((new Date(quote.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) setQuote(null);
    }, 1000);
    return () => clearInterval(tick);
  }, [quote]);

  function swapAssets() {
    setFromAsset(toAsset);
    setToAsset(fromAsset);
    setQuote(null);
  }

  function onFromChange(next: string) {
    setFromAsset(next);
    if (next !== "USDT" && toAsset !== "USDT") setToAsset("USDT");
    setQuote(null);
  }

  function onToChange(next: string) {
    setToAsset(next);
    if (next !== "USDT" && fromAsset !== "USDT") setFromAsset("USDT");
    setQuote(null);
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
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    } finally {
      setLoadingQuote(false);
    }
  }

  async function confirmConversion() {
    if (!quote) return;
    setError(null);
    setConfirming(true);
    try {
      await postJsonIdempotent("/api/conversions", { quoteId: quote.id }, generateClientId());
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    } finally {
      setConfirming(false);
    }
  }

  function resetFlow() {
    setDone(false);
    setQuote(null);
    setAmount("");
  }

  if (done && quote) {
    return (
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <CheckCircle2 className="h-10 w-10 text-success" aria-hidden="true" />
          <h2 className="text-section-title text-text-primary">Conversion complete</h2>
          <p className="text-sm text-text-secondary">
            Converted <span className="financial-value font-medium text-text-primary">{quote.fromAmount} {quote.fromAsset}</span>{" "}
            to <span className="financial-value font-medium text-text-primary">{quote.toAmount} {quote.toAsset}</span>.
          </p>
          <Button onClick={resetFlow}>New conversion</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="from-asset" className="text-sm font-medium text-text-primary">
            From
          </label>
          <div className="flex gap-2">
            <select
              id="from-asset"
              value={fromAsset}
              onChange={(e) => onFromChange(e.target.value)}
              className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-text-primary"
            >
              {ALL_ASSETS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setQuote(null);
              }}
              placeholder="0.00"
              className="financial-value h-11 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <p className="text-body-sm text-text-secondary">
            Available: <span className="financial-value">{Number(availableBalance).toFixed(6)}</span> {fromAsset}
          </p>
        </div>

        <button
          type="button"
          onClick={swapAssets}
          aria-label="Swap from and to assets"
          className="touch-target mx-auto flex items-center justify-center rounded-full border border-border bg-surface text-text-secondary hover:bg-surface-hover"
        >
          <ArrowDown className="h-4 w-4" />
        </button>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="to-asset" className="text-sm font-medium text-text-primary">
            To
          </label>
          <select
            id="to-asset"
            value={toAsset}
            onChange={(e) => onToChange(e.target.value)}
            className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-text-primary"
          >
            {ALL_ASSETS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        )}

        {!quote && (
          <Button size="lg" disabled={!amount || loadingQuote} onClick={getQuote}>
            {loadingQuote ? "Getting quote..." : "Get quote"}
          </Button>
        )}

        {quote && (
          <div className="flex flex-col gap-3 rounded-md border border-border p-3">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">You receive</span>
              <span className="financial-value font-medium text-text-primary">
                {quote.toAmount} {quote.toAsset}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Rate</span>
              <span className="financial-value text-text-primary">
                1 {quote.fromAsset} = {Number(quote.rate).toFixed(8)} {quote.toAsset}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Fee</span>
              <span className="financial-value text-text-primary">
                {quote.feeAmount} {quote.toAsset}
              </span>
            </div>
            <div className="flex justify-between text-body-sm text-text-tertiary">
              <span>Quote expires in</span>
              <span className="financial-value">{secondsLeft}s</span>
            </div>
            <Button size="lg" disabled={confirming} onClick={confirmConversion}>
              {confirming ? "Converting..." : "Confirm conversion"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
