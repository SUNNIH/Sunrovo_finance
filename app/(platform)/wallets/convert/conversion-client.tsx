"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, Loader2 } from "lucide-react";

/**
 * Phase 5: Cryptocurrency Conversion Client Component
 * 
 * Two-step flow:
 * 1. Get quote (30-second expiration)
 * 2. Execute conversion
 */

interface ConversionClientProps {
  userId: string;
}

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

const SUPPORTED_ASSETS = ["BTC", "ETH", "SOL", "XRP", "USDT",];

export const ConversionClient: React.FC<ConversionClientProps> = function ConversionClient() {
  const [fromAsset, setFromAsset] = useState("BTC");
  const [toAsset, setToAsset] = useState("USDT");
  const [fromAmount, setFromAmount] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const handleGetQuote = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setMessage({ type: "error", text: "Please enter a valid amount" });
      return;
    }

    if (fromAsset === toAsset) {
      setMessage({ type: "error", text: "Cannot convert an asset to itself" });
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
    <Card>
      <CardHeader>
        <CardTitle>Convert</CardTitle>
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
              placeholder="0.00"
              value={fromAmount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFromAmount(e.target.value)}
              disabled={isLoading || !!quote}
              className="flex-1 px-3 py-2 border border-border rounded-md bg-background"
            />
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowDown className="h-5 w-5 text-muted-foreground" />
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
            <Button onClick={handleGetQuote} disabled={isLoading} className="w-full">
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
              <Button variant="outline" onClick={() => setQuote(null)} disabled={isExecuting} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleExecute} disabled={isExecuting || countdown === 0} className="flex-1">
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

        <p className="text-xs text-muted-foreground">
  Supported pairs: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT
  and their inverses. All conversions are simulated.
</p>
      </CardContent>
    </Card>
  );
};
