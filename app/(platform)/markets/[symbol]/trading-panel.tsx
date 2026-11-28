"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { placeOrderAction } from "./actions";

import type {
  MarketDataStatus,
} from "@/lib/market/types";

import {
  CRYPTO_TRADING_ENABLED,
} from "@/lib/feature-flags";

interface TradingPanelProps {
  symbol: string;

  ticker: {
    lastPrice: string;
    status: MarketDataStatus;
  } | null;

  baseAsset: string;
  quoteAsset: string;
}

type OrderSide = "BUY" | "SELL";

type OrderType = "MARKET" | "LIMIT";

export function TradingPanel({
  symbol,
  ticker,
  baseAsset,
  quoteAsset,
}: TradingPanelProps) {
  const [side, setSide] =
    useState<OrderSide>("BUY");

  const [type, setType] =
    useState<OrderType>("MARKET");

  const [quantity, setQuantity] =
    useState("");

  const [limitPrice, setLimitPrice] =
    useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [toastMessage, setToastMessage] =
    useState<string | null>(null);

  const currentPrice = ticker?.lastPrice ?? "—";

  const isPriceAvailable =
    ticker?.status === "live";

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!CRYPTO_TRADING_ENABLED) {
      setToastMessage(
        "Simulated cryptocurrency trading is currently disabled."
      );
      return;
    }

    if (
      !quantity ||
      parseFloat(quantity) <= 0
    ) {
      setToastMessage(
        "Please enter a valid quantity"
      );
      return;
    }

    if (
      type === "LIMIT" &&
      (!limitPrice || parseFloat(limitPrice) <= 0)
    ) {
      setToastMessage(
        "Please enter a valid limit price"
      );
      return;
    }

    if (
      type === "MARKET" &&
      !isPriceAvailable
    ) {
      setToastMessage(
        "Cannot place market order without live price data"
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const idempotencyKey =
        `${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const result = await placeOrderAction({
        symbol,
        side,
        type,
        quantity,
        limitPrice:
          type === "LIMIT"
            ? limitPrice
            : undefined,
        idempotencyKey,
      });

      if (result.success) {
        const successMsg =
          type === "MARKET"
            ? `${side} ${quantity} ${baseAsset} at ${result.filledPrice} ${quoteAsset}`
            : `${side} limit order for ${quantity} ${baseAsset} at ${limitPrice} ${quoteAsset}`;

        setToastMessage(
          `✓ Order placed: ${successMsg}`
        );

        setQuantity("");
        setLimitPrice("");
      } else {
        setToastMessage(
          `✗ Order failed: ${result.error || "Unknown error"}`
        );
      }
    } catch (error) {
      console.error(
        "Order submission error:",
        error
      );

      setToastMessage(
        "✗ An unexpected error occurred"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">

        {/* Notification */}
        {toastMessage && (
          <div className="p-3 bg-muted rounded-md text-sm border">
            {toastMessage}

            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="ml-2 text-muted-foreground hover:text-text-primary"
            >
              ×
            </button>
          </div>
        )}

        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold">
            Trade {symbol}
          </h2>

          <p className="text-sm text-muted-foreground mt-1">
            Current price:{" "}

            <span className="font-medium">
              {currentPrice} {quoteAsset}
            </span>

            {ticker && (
              <span
                className={`ml-2 text-xs ${
                  ticker.status === "live"
                    ? "text-green-600 dark:text-green-400"
                    : ticker.status === "stale"
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-gray-500"
                }`}
              >
                {ticker.status === "live"
                  ? "● Live"
                  : ticker.status === "stale"
                  ? "● Stale"
                  : "● Unavailable"}
              </span>
            )}
          </p>
        </div>

        {/* Feature disabled notice */}
        {!CRYPTO_TRADING_ENABLED && (
          <p
            role="status"
            className="rounded-md border p-3 text-sm text-muted-foreground"
          >
            Simulated trading is not enabled yet.
            Charts and order history remain available.
          </p>
        )}

        {/* Buy / Sell selector */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={
              side === "BUY"
                ? "primary"
                : "outline"
            }
            className={
              side === "BUY"
                ? "flex-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                : "flex-1"
            }
            onClick={() => setSide("BUY")}
            disabled={!CRYPTO_TRADING_ENABLED}
          >
            Buy
          </Button>

          <Button
            type="button"
            variant={
              side === "SELL"
                ? "primary"
                : "outline"
            }
            className={
              side === "SELL"
                ? "flex-1 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                : "flex-1"
            }
            onClick={() => setSide("SELL")}
            disabled={!CRYPTO_TRADING_ENABLED}
          >
            Sell
          </Button>
        </div>

        {/* Market / Limit selector */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={
              type === "MARKET"
                ? "primary"
                : "outline"
            }
            size="sm"
            className="flex-1"
            onClick={() => setType("MARKET")}
            disabled={!CRYPTO_TRADING_ENABLED}
          >
            Market
          </Button>

          <Button
            type="button"
            variant={
              type === "LIMIT"
                ? "primary"
                : "outline"
            }
            size="sm"
            className="flex-1"
            onClick={() => setType("LIMIT")}
            disabled={!CRYPTO_TRADING_ENABLED}
          >
            Limit
          </Button>
        </div>

        {/* Order form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >

          {/* Quantity */}
          <div>
            <label
              htmlFor="quantity"
              className="block text-sm font-medium mb-1"
            >
              Quantity ({baseAsset})
            </label>

            <input
              id="quantity"
              type="number"
              step="any"
              placeholder="0.00"
              value={quantity}
              onChange={(e) =>
                setQuantity(e.target.value)
              }
              disabled={
                isSubmitting ||
                !CRYPTO_TRADING_ENABLED
              }
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          {/* Limit Price */}
          {type === "LIMIT" && (
            <div>
              <label
                htmlFor="limitPrice"
                className="block text-sm font-medium mb-1"
              >
                Limit Price ({quoteAsset})
              </label>

              <input
                id="limitPrice"
                type="number"
                step="any"
                placeholder="0.00"
                value={limitPrice}
                onChange={(e) =>
                  setLimitPrice(e.target.value)
                }
                disabled={
                  isSubmitting ||
                  !CRYPTO_TRADING_ENABLED
                }
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          )}

          {/* Estimated cost / proceeds */}
          {quantity && (
            <div className="p-3 bg-muted rounded-md text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {side === "BUY"
                    ? "Estimated Cost"
                    : "Estimated Proceeds"}
                </span>

                <span className="font-medium">
                  {(() => {
                    const qty = parseFloat(quantity);

                    if (
                      isNaN(qty) ||
                      qty <= 0
                    ) {
                      return "—";
                    }

                    const price =
                      type === "MARKET"
                        ? parseFloat(currentPrice)
                        : parseFloat(limitPrice);

                    if (
                      isNaN(price) ||
                      price <= 0
                    ) {
                      return "—";
                    }

                    const total = qty * price;

                    const fee =
                      total *
                      (type === "LIMIT"
                        ? 0.0005
                        : 0.001);

                    // Display estimate only.
                    const net =
                      side === "BUY"
                        ? total
                        : total - fee;

                    return `${net.toFixed(2)} ${quoteAsset}`;
                  })()}
                </span>
              </div>

              <p className="text-xs text-muted-foreground mt-1">
                Fee:{" "}
                {type === "LIMIT"
                  ? "0.05%"
                  : "0.1%"}
                {" • "}
                Simulated execution only
              </p>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            className={`w-full ${
              side === "BUY"
                ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                : "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
            }`}
            disabled={
              !CRYPTO_TRADING_ENABLED ||
              isSubmitting ||
              (
                type === "MARKET" &&
                !isPriceAvailable
              )
            }
          >
            {isSubmitting
              ? "Placing Order..."
              : `${side === "BUY" ? "Buy" : "Sell"} ${baseAsset}`}
          </Button>
        </form>

        {/* Disclaimer */}
        <div className="text-xs text-muted-foreground border-t pt-4">
          <p className="font-medium mb-1">
            ⚠️ Simulated Trading Only
          </p>

          <p>
            Orders are executed using simulated
            settlement within your Sunrovo Finance
            wallet. No real cryptocurrency orders
            are submitted to external exchanges.
          </p>
        </div>
      </div>
    </Card>
  );
}