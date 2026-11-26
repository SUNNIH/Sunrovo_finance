"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { Card } from "@/components/ui/card";

import { CRYPTO_TRADING_ENABLED } from "@/lib/feature-flags";

import { placeTradeOrderAction } from "./actions";

import type { WalletView } from "@/features/crypto/wallets";

type OrderSide = "BUY" | "SELL";

type OrderType = "MARKET" | "LIMIT";

type MarketTicker = {

  lastPrice: string;

  status: "live" | "stale" | "unavailable";

};

export function TradingPanelWithStopLoss({

  symbol,

  ticker,

  baseAsset,

  quoteAsset,

  walletData,

  onOrderSuccess,

}: {

  symbol: string;

  ticker: MarketTicker;

  baseAsset: string;

  quoteAsset: string;

  walletData: WalletView | null;

  onOrderSuccess?: () => void;

}) {

  const [side, setSide] = useState<OrderSide>("BUY");

  const [type, setType] = useState<OrderType>("MARKET");

  // For BUY: use USDT amount mode by default

  // For SELL: use crypto quantity mode

  const [inputAmount, setInputAmount] = useState(""); // This can be USDT (for BUY) or crypto (for SELL)

  const [limitPrice, setLimitPrice] = useState("");

  const [enableStopLoss, setEnableStopLoss] = useState(false);

  const [stopLossPrice, setStopLossPrice] = useState("");
  const [enableTakeProfit, setEnableTakeProfit] = useState(false);
  const [takeProfitPrice, setTakeProfitPrice] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentPrice = ticker.lastPrice;

  const isPriceAvailable = ticker.status === "live";

  // Get available balances from wallet

  const getAvailableBalance = (asset: string): string => {

    if (!walletData) return "0";

    const assetBalance = walletData.assets.find(a => a.assetSymbol === asset);

    return assetBalance?.available || "0";

  };

  const availableQuote = getAvailableBalance(quoteAsset); // USDT for buying

  const availableBase = getAvailableBalance(baseAsset); // BTC for selling

  // Handle numeric input changes with validation

  const handleNumericInput = (value: string, setter: (val: string) => void) => {

    // Allow empty string, positive numbers, and decimals

    if (value === "" || /^\d*\.?\d*$/.test(value)) {

  setter(value);

}

  };

  // Calculate estimated values

  const getEstimates = () => {

    const amount = parseFloat(inputAmount);

    if (isNaN(amount) || amount <= 0) return null;

    const price =

      type === "MARKET"

        ? parseFloat(currentPrice)

        : parseFloat(limitPrice);

    if (isNaN(price) || price <= 0) return null;

    const feeRate = type === "LIMIT" ? 0.0005 : 0.001;

    if (side === "BUY") {

      // User enters USDT amount to spend

      const usdtSpending = amount;

      const estimatedQuantity = usdtSpending / price;

      const fee = estimatedQuantity * feeRate;

      const netQuantity = estimatedQuantity - fee;

      return {

        quantity: estimatedQuantity.toFixed(8),

        netQuantity: netQuantity.toFixed(8),

        fee: (usdtSpending * feeRate).toFixed(2),

        total: usdtSpending.toFixed(2),

      };

    } else {

      // User enters crypto quantity to sell

      const quantity = amount;

      const grossProceeds = quantity * price;

      const fee = grossProceeds * feeRate;

      const netProceeds = grossProceeds - fee;

      return {

        quantity: quantity.toFixed(8),

        netQuantity: quantity.toFixed(8),

        fee: fee.toFixed(2),

        total: netProceeds.toFixed(2),

      };

    }

  };

  const estimates = getEstimates();

  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault();

    if (!CRYPTO_TRADING_ENABLED) {

      setToastMessage("Simulated cryptocurrency trading is currently disabled.");

      return;

    }

    if (!inputAmount || parseFloat(inputAmount) <= 0) {

      setToastMessage(`Please enter a valid ${side === "BUY" ? "USDT amount" : "quantity"}`);

      return;

    }

    if (type === "LIMIT" && (!limitPrice || parseFloat(limitPrice) <= 0)) {

      setToastMessage("Please enter a valid limit price");

      return;

    }

    if (side === "SELL" && (enableStopLoss || enableTakeProfit)) {

      setToastMessage("Protective exits on a new order belong to BUY entries. Protect existing holdings separately.");

      return;

    }

    if (enableStopLoss && (!stopLossPrice || !Number.isFinite(Number(stopLossPrice)) || Number(stopLossPrice) <= 0)) {
      setToastMessage("Please enter a valid Stop Loss price or disable Stop Loss");
      return;
    }
    if (enableTakeProfit && (!takeProfitPrice || !Number.isFinite(Number(takeProfitPrice)) || Number(takeProfitPrice) <= 0)) {
      setToastMessage("Please enter a valid Take Profit price or disable Take Profit");
      return;
    }
    if (side === "BUY" && (enableStopLoss || enableTakeProfit)) {
      const referencePrice = type === "MARKET" ? Number(currentPrice) : Number(limitPrice);
      if (enableStopLoss && Number(stopLossPrice) >= referencePrice) {
        setToastMessage("Stop Loss must be below the BUY entry price");
        return;
      }
      if (enableTakeProfit && Number(takeProfitPrice) <= referencePrice) {
        setToastMessage("Take Profit must be above the BUY entry price");
        return;
      }
    }

    if (type === "MARKET" && !isPriceAvailable) {

      setToastMessage("Cannot place market order without live price data");

      return;

    }

    // Validate sufficient balance

    if (side === "BUY") {

      const usdtNeeded = parseFloat(inputAmount);

      const available = parseFloat(availableQuote);

      if (usdtNeeded > available) {

        setToastMessage(`Insufficient ${quoteAsset}. Available: ${availableQuote}`);

        return;

      }

    } else {

      const quantityNeeded = parseFloat(inputAmount);

      const available = parseFloat(availableBase);

      if (quantityNeeded > available) {

        setToastMessage(`Insufficient ${baseAsset}. Available: ${availableBase}`);

        return;

      }

    }

    setIsSubmitting(true);

    try {

      const idempotencyKey = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const result = await placeTradeOrderAction({

        symbol,

        side,

        type,

        // For BUY: send quoteAmount (USDT), For SELL: send quantity (crypto)

        quantity: side === "SELL" ? inputAmount : undefined,

        quoteAmount: side === "BUY" ? inputAmount : undefined,

        limitPrice: type === "LIMIT" ? limitPrice : undefined,

        stopPrice: side === "BUY" && enableStopLoss ? stopLossPrice : undefined,
        takeProfitPrice: side === "BUY" && enableTakeProfit ? takeProfitPrice : undefined,

        idempotencyKey,

      });

      if (result.success) {

        const orderDesc = side === "BUY" ? `${inputAmount} ${quoteAsset}` : `${inputAmount} ${baseAsset}`;

        const priceDesc = type === "MARKET" ? result.filledPrice : limitPrice;

        let successMsg =

          type === "MARKET"

            ? `${side} ${orderDesc} at ${priceDesc} ${quoteAsset}`

            : `${side} limit order for ${orderDesc} at ${priceDesc} ${quoteAsset}`;

        if (enableStopLoss || enableTakeProfit) {
          const conditions = [
            enableStopLoss && "Stop Loss",
            enableTakeProfit && "Take Profit",
          ].filter(Boolean).join(" + ");
          successMsg += type === "MARKET"
            ? ` (${conditions} active)`
            : ` (${conditions} pending until BUY fills)`;
        }

        setToastMessage(`✓ Order placed: ${successMsg}`);

        setInputAmount("");

        setLimitPrice("");

        setStopLossPrice("");

        setEnableStopLoss(false);
        setTakeProfitPrice("");
        setEnableTakeProfit(false);

        // Notify parent to refresh data

        if (onOrderSuccess) {

          onOrderSuccess();

        }

      } else {

        setToastMessage(`✗ Order failed: ${result.error || "Unknown error"}`);

      }

    } catch (error) {

      console.error("Order submission error:", error);

      setToastMessage("✗ An unexpected error occurred");

    } finally {

      setIsSubmitting(false);

    }

  };

  // Balance percentage buttons for SELL

  const handlePercentage = (percent: number) => {

    if (side === "SELL") {

      const available = parseFloat(availableBase);

      const amount = (available * percent).toFixed(8);

      setInputAmount(amount);

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

          <h2 className="text-lg font-semibold">Trade {symbol}</h2>

          <p className="text-sm text-muted-foreground mt-1">

            Current price: <span className="font-medium">{currentPrice} {quoteAsset}</span>

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

          </p>

        </div>

        {/* Feature disabled notice */}

        {!CRYPTO_TRADING_ENABLED && (

          <p role="status" className="rounded-md border p-3 text-sm text-muted-foreground">

            Simulated trading is not enabled yet. Charts and order history remain available.

          </p>

        )}

        {/* Buy / Sell selector */}

        <div className="flex gap-2">

          <Button

            type="button"

            variant={side === "BUY" ? "primary" : "outline"}

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

            variant={side === "SELL" ? "primary" : "outline"}

            className={

              side === "SELL"

                ? "flex-1 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"

                : "flex-1"

            }

            onClick={() => {

              setSide("SELL");

              setEnableStopLoss(false);
              setEnableTakeProfit(false);
              setTakeProfitPrice("");

              setStopLossPrice("");

            }}

            disabled={!CRYPTO_TRADING_ENABLED}

          >

            Sell

          </Button>

        </div>

        {/* Order Type selector - Only Market and Limit */}

        <div className="flex gap-2">

          <Button

            type="button"

            variant={type === "MARKET" ? "primary" : "outline"}

            size="sm"

            className="flex-1"

            onClick={() => setType("MARKET")}

            disabled={!CRYPTO_TRADING_ENABLED}

          >

            Market

          </Button>

          <Button

            type="button"

            variant={type === "LIMIT" ? "primary" : "outline"}

            size="sm"

            className="flex-1"

            onClick={() => setType("LIMIT")}

            disabled={!CRYPTO_TRADING_ENABLED}

          >

            Limit

          </Button>

        </div>

        {/* Order form */}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Available Balance */}

          <div className="text-sm">

            <span className="text-muted-foreground">Available: </span>

            <span className="font-medium">

              {side === "BUY" ? `${availableQuote} ${quoteAsset}` : `${availableBase} ${baseAsset}`}

            </span>

          </div>

          {/* Amount Input */}

          <div>

            <label htmlFor="inputAmount" className="block text-sm font-medium mb-1">

              {side === "BUY" ? `Amount (${quoteAsset})` : `Quantity (${baseAsset})`}

            </label>

            <input

              id="inputAmount"

              type="number"

              step="any"

              min="0"

              placeholder="0.00"

              value={inputAmount}

              onChange={(e) => handleNumericInput(e.target.value, setInputAmount)}

              disabled={isSubmitting || !CRYPTO_TRADING_ENABLED}

              className="w-full px-3 py-2 border rounded-md"

            />

            {side === "SELL" && (

              <div className="flex gap-2 mt-2">

                <Button

                  type="button"

                  size="sm"

                  variant="outline"

                  onClick={() => handlePercentage(0.25)}

                  disabled={isSubmitting || !CRYPTO_TRADING_ENABLED}

                  className="flex-1"

                >

                  25%

                </Button>

                <Button

                  type="button"

                  size="sm"

                  variant="outline"

                  onClick={() => handlePercentage(0.5)}

                  disabled={isSubmitting || !CRYPTO_TRADING_ENABLED}

                  className="flex-1"

                >

                  50%

                </Button>

                <Button

                  type="button"

                  size="sm"

                  variant="outline"

                  onClick={() => handlePercentage(0.75)}

                  disabled={isSubmitting || !CRYPTO_TRADING_ENABLED}

                  className="flex-1"

                >

                  75%

                </Button>

                <Button

                  type="button"

                  size="sm"

                  variant="outline"

                  onClick={() => handlePercentage(1.0)}

                  disabled={isSubmitting || !CRYPTO_TRADING_ENABLED}

                  className="flex-1"

                >

                  100%

                </Button>

              </div>

            )}

          </div>

          {/* Limit Price */}

          {type === "LIMIT" && (

            <div>

              <label htmlFor="limitPrice" className="block text-sm font-medium mb-1">

                Limit Price ({quoteAsset})

              </label>

              <input

                id="limitPrice"

                type="number"

                step="any"

                min="0"

                placeholder="0.00"

                value={limitPrice}

                onChange={(e) => handleNumericInput(e.target.value, setLimitPrice)}

                disabled={isSubmitting || !CRYPTO_TRADING_ENABLED}

                className="w-full px-3 py-2 border rounded-md"

              />

            </div>

          )}

          {/* Optional Stop Loss Protection */}

          {side === "BUY" && (

          <div className="border rounded-md p-4 space-y-3">

            <div className="flex items-center gap-2">

              <input

                type="checkbox"

                id="enableStopLoss"

                checked={enableStopLoss}

                onChange={(e) => setEnableStopLoss(e.target.checked)}

                disabled={isSubmitting || !CRYPTO_TRADING_ENABLED}

                className="w-4 h-4"

              />

              <label htmlFor="enableStopLoss" className="text-sm font-medium cursor-pointer">

                Add Stop Loss Protection

              </label>

            </div>

            {enableStopLoss && (

              <div>

                <label htmlFor="stopLossPrice" className="block text-sm font-medium mb-1">

                  Stop Loss Trigger Price ({quoteAsset})

                </label>

                <input

                  id="stopLossPrice"

                  type="number"

                  step="any"

                  min="0"

                  placeholder="0.00"

                  value={stopLossPrice}

                  onChange={(e) => handleNumericInput(e.target.value, setStopLossPrice)}

                  disabled={isSubmitting || !CRYPTO_TRADING_ENABLED}

                  className="w-full px-3 py-2 border rounded-md"

                />

                <p className="text-xs text-muted-foreground mt-1">

                  {side === "BUY"

                    ? "After your BUY fills, automatically sell if price falls to this level"

                    : "Automatically sell if price falls to this level"}

                </p>

              </div>

            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enableTakeProfit"
                checked={enableTakeProfit}
                onChange={(event) => setEnableTakeProfit(event.target.checked)}
                disabled={isSubmitting || !CRYPTO_TRADING_ENABLED}
                className="w-4 h-4"
              />
              <label htmlFor="enableTakeProfit" className="text-sm font-medium cursor-pointer">
                Add Take Profit Protection
              </label>
            </div>
            {enableTakeProfit && (
              <div>
                <label htmlFor="takeProfitPrice" className="block text-sm font-medium mb-1">
                  Take Profit Trigger Price ({quoteAsset})
                </label>
                <input
                  id="takeProfitPrice"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={takeProfitPrice}
                  onChange={(event) => handleNumericInput(event.target.value, setTakeProfitPrice)}
                  disabled={isSubmitting || !CRYPTO_TRADING_ENABLED}
                  className="w-full px-3 py-2 border rounded-md"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  After the BUY fills, sell the protected amount if price reaches or exceeds this target.
                </p>
              </div>
            )}
            {enableStopLoss && enableTakeProfit && (
              <p className="text-xs text-muted-foreground">
                OCO: whichever target triggers first closes the protected quantity; the other becomes inactive.
              </p>
            )}
          </div>
          )}

          {side === "SELL" && (

            <p className="text-xs text-muted-foreground">

              Spot SELL exits existing holdings. Set protective conditions

              separately for crypto you continue to own.

            </p>

          )}

          {/* Estimated details */}

          {estimates && (

            <div className="p-3 bg-muted rounded-md text-sm space-y-1">

              {side === "BUY" ? (

                <>

                  <div className="flex justify-between">

                    <span className="text-muted-foreground">Estimated {baseAsset}</span>

                    <span className="font-medium">{estimates.netQuantity}</span>

                  </div>

                  <div className="flex justify-between">

                    <span className="text-muted-foreground">Fee</span>

                    <span className="font-medium">{estimates.fee} {quoteAsset}</span>

                  </div>

                  <div className="flex justify-between">

                    <span className="text-muted-foreground">Total Spending</span>

                    <span className="font-medium">{estimates.total} {quoteAsset}</span>

                  </div>

                </>

              ) : (

                <>

                  <div className="flex justify-between">

                    <span className="text-muted-foreground">Estimated Proceeds</span>

                    <span className="font-medium">{estimates.total} {quoteAsset}</span>

                  </div>

                  <div className="flex justify-between">

                    <span className="text-muted-foreground">Fee</span>

                    <span className="font-medium">{estimates.fee} {quoteAsset}</span>

                  </div>

                </>

              )}

              <p className="text-xs text-muted-foreground mt-2">

                Fee: {type === "LIMIT" ? "0.05%" : "0.1%"} • Simulated execution only

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

              (type === "MARKET" && !isPriceAvailable)

            }

          >

            {isSubmitting ? "Placing Order..." : `${side === "BUY" ? "Buy" : "Sell"} ${baseAsset}`}

          </Button>

        </form>

        {/* Disclaimer */}

        <div className="text-xs text-muted-foreground border-t pt-4">

          <p className="font-medium mb-1">⚠️ Simulated Trading Only</p>

          <p>

            Orders are executed using simulated settlement within your Sunrovo Finance wallet. No

            real cryptocurrency orders are submitted to external exchanges.

          </p>

          {enableStopLoss && (

            <p className="mt-2">

              Stop Loss conditions are monitored automatically and trigger when the market price reaches your stop level.

            </p>

          )}

        </div>

      </div>

    </Card>

  );

}
