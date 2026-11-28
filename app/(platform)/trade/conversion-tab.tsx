"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";

interface Quote {
  quoteId: string;
  fromAsset: string;
  toAsset: string;
  fromAmount: string;
  toAmount: string;
  rate: string;
  feeAmount: string;
  expiresAt: Date;
}

const SUPPORTED_ASSETS = ["BTC", "ETH", "SOL", "XRP", "USDT"];

// Valid conversion pairs
const VALID_PAIRS = new Set([
  "BTC-USDT", "USDT-BTC",
  "ETH-USDT", "USDT-ETH",
  "SOL-USDT", "USDT-SOL",
  "XRP-USDT", "USDT-XRP",
]);

export const ConversionTab: React.FC<{ userId: string }> = function ConversionTab() {
  const [fromAsset, setFromAsset] = useState("BTC");
  const [toAsset, setToAsset] = useState("USDT");
  const [fromAmount, setFromAmount] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Check if current pair is supported
  const isValidPair = VALID_PAIRS.has(`${fromAsset}-${toAsset}`);

  useEffect(() => {
    // Reset quote if pair becomes invalid
    if (!isValidPair && quote) {
      setQuote(null);
      setCountdown(null);
    }
  }, [fromAsset, toAsset, isValidPair, quote]);

  const handleSwapAssets = () => {
    const temp = fromAsset;
    setFromAsset(toAsset);
    setToAsset(temp);
    setQuote(null);
    setCountdown(null);
  };

  const handleGetQuote = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setMessage({ type: "error", text: "Please enter a valid amount" });
      return;
    }

    if (fromAsset === toAsset) {
      setMessage({ type: "error", text: "Cannot convert an asset to itself" });
      return;
    }

    if (!isValidPair) {
      setMessage({ type: "error", text: `${fromAsset}/${toAsset} conversion not supported` });
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setQuote(null);

    try {
      const response = await fetch("/api/crypto/conversion/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromAsset, toAsset, fromAmount }),
      });

      const result = await response.json();

      if (result.success) {
        const expiresAt = new Date(result.expiresAt);
        setQuote({
          quoteId: result.quoteId,
          fromAsset: result.fromAsset,
          toAsset: result.toAsset,
          fromAmount: result.fromAmount,
          toAmount: result.toAmount,
          rate: result.rate,
          feeAmount: result.feeAmount,
          expiresAt,
        });

        // Start countdown
        const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
        setCountdown(remaining);

        const interval = setInterval(() => {
          const now = Date.now();
          const secondsLeft = Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000));
          setCountdown(secondsLeft);

          if (secondsLeft === 0) {
            clearInterval(interval);
            setMessage({ type: "error", text: "Quote expired. Please request a new quote." });
            setQuote(null);
          }
        }, 1000);
      } else {
        setMessage({ type: "error", text: result.error || "Failed to get quote" });
      }
    } catch (error) {
      console.error("Quote error:", error);
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!quote) return;

    setIsExecuting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/crypto/conversion/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: quote.quoteId }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage({
          type: "success",
          text: `✓ Converted ${quote.fromAmount} ${quote.fromAsset} to ${quote.toAmount} ${quote.toAsset}`,
        });
        setQuote(null);
        setFromAmount("");
        setCountdown(null);
      } else {
        setMessage({ type: "error", text: result.error || "Conversion failed" });
      }
    } catch (error) {
      console.error("Execute error:", error);
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Convert Cryptocurrency</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Convert between supported cryptocurrency pairs instantly
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Message */}
          {message && (
            <div
              className={`p-3 rounded-md text-sm ${
                message.type === "success"
                  ? "bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800"
              }`}
            >
              {message.text}
              <button
                type="button"
                onClick={() => setMessage(null)}
                className="ml-2 font-bold"
              >
                ×
              </button>
            </div>
          )}

          {/* From Asset */}
          <div className="space-y-2">
            <label htmlFor="fromAsset" className="block text-sm font-medium">
              From
            </label>
            <div className="flex gap-2">
              <select
                id="fromAsset"
                value={fromAsset}
                onChange={(e) => setFromAsset(e.target.value)}
                disabled={!!quote}
                className="w-32 px-3 py-2 border border-border rounded-md bg-background"
              >
                {SUPPORTED_ASSETS.map((asset) => (
                  <option key={asset} value={asset}>
                    {asset}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={fromAmount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || /^\d*\.?\d*$/.test(value)) {
                    setFromAmount(value);
                  }
                }}
                disabled={isLoading || !!quote}
                className="flex-1 px-3 py-2 border border-border rounded-md bg-background"
              />
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleSwapAssets}
              disabled={!!quote}
              className="p-2 rounded-full hover:bg-muted transition-colors disabled:opacity-50"
              title="Swap assets"
            >
              <RefreshCw className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* To Asset */}
          <div className="space-y-2">
            <label htmlFor="toAsset" className="block text-sm font-medium">
              To
            </label>
            <div className="flex gap-2">
              <select
                id="toAsset"
                value={toAsset}
                onChange={(e) => setToAsset(e.target.value)}
                disabled={!!quote}
                className="w-32 px-3 py-2 border border-border rounded-md bg-background"
              >
                {SUPPORTED_ASSETS.map((asset) => (
                  <option key={asset} value={asset}>
                    {asset}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={quote ? quote.toAmount : ""}
                placeholder="0.00"
                disabled
                className="flex-1 font-mono px-3 py-2 border border-border rounded-md bg-muted"
              />
            </div>
          </div>

          {/* Supported Pair Notice */}
          {!isValidPair && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800 rounded-md text-sm">
              ⚠️ {fromAsset}/{toAsset} conversion is not supported. 
              Please select a valid pair (BTC, ETH, SOL, or XRP ↔ USDT).
            </div>
          )}

          {/* Quote Details */}
          {quote && (
            <div className="bg-muted p-4 rounded-md space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rate</span>
                <span className="font-mono">{quote.rate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee (0.1%)</span>
                <span className="font-mono">
                  {quote.feeAmount} {quote.toAsset}
                </span>
              </div>
              {countdown !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quote expires in</span>
                  <span className={`font-mono ${countdown <= 5 ? "text-red-600 dark:text-red-400" : ""}`}>
                    {countdown}s
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {!quote ? (
              <Button 
                onClick={handleGetQuote} 
                disabled={isLoading || !isValidPair} 
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Getting Quote...
                  </>
                ) : (
                  "Get Quote"
                )}
              </Button>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setQuote(null);
                    setCountdown(null);
                  }} 
                  disabled={isExecuting} 
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleExecute} 
                  disabled={isExecuting || countdown === 0} 
                  className="flex-1"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    "Confirm Conversion"
                  )}
                </Button>
              </>
            )}
          </div>

          {/* Info */}
          <div className="text-xs text-muted-foreground border-t pt-4">
            <p className="font-medium mb-1">Supported Conversion Pairs</p>
            <p>BTC ↔ USDT • ETH ↔ USDT • SOL ↔ USDT • XRP ↔ USDT</p>
            <p className="mt-2">
              All conversions are simulated within your Sunrovo Finance wallet. 
              Quotes expire after 30 seconds.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
