"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useLiveTicker } from "@/lib/bybit/use-live-ticker";
import { SUPPORTED_PAIRS, type SupportedPair } from "@/lib/bybit/instruments";
import type { MarketTicker, Candle, OrderBookSnapshot, RecentTrade } from "@/lib/bybit/types";
import { CandlestickChart } from "@/components/charts/candlestick-chart";
import { OrderBookDisplay } from "@/components/financial/order-book-display";
import { CurrencyValue, PercentChange } from "@/components/financial/currency-value";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { postJsonIdempotent, deleteJson, ApiRequestError } from "@/lib/utilities/api-client";
import { generateClientId } from "@/lib/utilities/id";

interface WalletAssetView {
  assetSymbol: string;
  available: string;
  locked: string;
  usdValue: string;
}

interface OpenOrderView {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: string;
  quantity: string;
  limitPrice: string | null;
  createdAt: string;
}

interface OrderHistoryView {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: string;
  quantity: string;
  filledPrice: string | null;
  feeAmount: string;
  filledAt: string | null;
}

interface TradeClientProps {
  pair: SupportedPair;
  initialTicker: MarketTicker;
  candles: Candle[];
  orderBook: OrderBookSnapshot;
  trades: RecentTrade[];
  wallet: { assets: WalletAssetView[] } | null;
  initialSide: "BUY" | "SELL";
  openOrders: OpenOrderView[];
  orderHistory: OrderHistoryView[];
}

type MobilePanel = "chart" | "book" | "trades";

export function TradeClient({
  pair,
  initialTicker,
  candles,
  orderBook,
  trades,
  wallet,
  initialSide,
  openOrders: initialOpenOrders,
  orderHistory,
}: TradeClientProps) {
  const router = useRouter();
  const { ticker, isLive } = useLiveTicker(pair.symbol, initialTicker);

  const [side, setSide] = React.useState<"BUY" | "SELL">(initialSide);
  const [orderType, setOrderType] = React.useState<"MARKET" | "LIMIT">("MARKET");
  const [quantity, setQuantity] = React.useState("");
  const [limitPrice, setLimitPrice] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [openOrders, setOpenOrders] = React.useState(initialOpenOrders);
  const [mobilePanel, setMobilePanel] = React.useState<MobilePanel>("chart");
  const [ordersTab, setOrdersTab] = React.useState<"open" | "history">("open");

  const quoteBalance = wallet?.assets.find((a) => a.assetSymbol === pair.quoteAsset)?.available ?? "0";
  const baseBalance = wallet?.assets.find((a) => a.assetSymbol === pair.baseAsset)?.available ?? "0";
  const availableBalance = side === "BUY" ? quoteBalance : baseBalance;

  const estimatedPrice = orderType === "LIMIT" ? Number(limitPrice || 0) : Number(side === "BUY" ? ticker.bestAsk : ticker.bestBid);
  const estimatedTotal = quantity ? (Number(quantity) * estimatedPrice).toFixed(pair.pricePrecision) : "0";

  function onSymbolChange(newSymbol: string) {
    router.push(`/trade?symbol=${newSymbol}&side=${side}`);
  }

  async function submitOrder() {
    setError(null);
    setSuccessMessage(null);
    setSubmitting(true);
    try {
      const body =
        orderType === "MARKET"
          ? { symbol: pair.symbol, side, quantity, orderType: "MARKET" }
          : { symbol: pair.symbol, side, quantity, limitPrice, orderType: "LIMIT" };

      await postJsonIdempotent("/api/orders", body, generateClientId());
      setSuccessMessage(orderType === "MARKET" ? "Order filled." : "Limit order placed.");
      setQuantity("");
      setLimitPrice("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelOrder(orderId: string) {
    setOpenOrders((prev) => prev.filter((o) => o.id !== orderId));
    try {
      await deleteJson(`/api/orders/${orderId}`);
    } catch {
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <select
            value={pair.symbol}
            onChange={(e) => onSymbolChange(e.target.value)}
            aria-label="Select trading pair"
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-primary"
          >
            {SUPPORTED_PAIRS.map((p) => (
              <option key={p.symbol} value={p.symbol}>
                {p.baseAsset}/{p.quoteAsset}
              </option>
            ))}
          </select>
          <CurrencyValue amount={ticker.lastPrice} assetSymbol={pair.quoteAsset} className="text-lg font-semibold text-text-primary" />
          <PercentChange value={Number(ticker.change24hPercent)} />
          {isLive && (
            <Badge variant="success" className="items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live
            </Badge>
          )}
        </div>
      </div>

      {/* Mobile panel switcher */}
      <div className="flex gap-1 rounded-md border border-border bg-surface p-1 lg:hidden">
        {(["chart", "book", "trades"] as MobilePanel[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setMobilePanel(p)}
            className={`flex-1 rounded px-3 py-1.5 text-sm font-medium capitalize ${
              mobilePanel === p ? "bg-primary text-primary-foreground" : "text-text-secondary"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card className={mobilePanel === "chart" ? "block" : "hidden lg:block"}>
            <CardContent className="p-4">
              <CandlestickChart candles={candles} />
            </CardContent>
          </Card>

          <Card className={mobilePanel === "book" ? "block" : "hidden lg:block"}>
            <CardContent className="p-4">
              <h2 className="mb-3 text-card-title text-text-primary">Order book</h2>
              <OrderBookDisplay orderBook={orderBook} pricePrecision={pair.pricePrecision} quantityPrecision={pair.quantityPrecision} />
            </CardContent>
          </Card>

          <Card className={mobilePanel === "trades" ? "block" : "hidden lg:block"}>
            <CardContent className="p-4">
              <h2 className="mb-3 text-card-title text-text-primary">Recent trades</h2>
              <div className="flex flex-col gap-1">
                {trades.slice(0, 10).map((trade) => (
                  <div key={trade.id} className="flex justify-between text-sm">
                    <span className={`financial-value ${trade.side === "BUY" ? "text-success" : "text-danger"}`}>
                      {Number(trade.price).toFixed(pair.pricePrecision)}
                    </span>
                    <span className="financial-value text-text-secondary">
                      {Number(trade.quantity).toFixed(pair.quantityPrecision)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Open orders / history */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex gap-4 border-b border-border">
                <button
                  type="button"
                  onClick={() => setOrdersTab("open")}
                  className={`pb-2 text-sm font-medium ${ordersTab === "open" ? "border-b-2 border-primary text-primary" : "text-text-secondary"}`}
                >
                  Open orders ({openOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOrdersTab("history")}
                  className={`pb-2 text-sm font-medium ${ordersTab === "history" ? "border-b-2 border-primary text-primary" : "text-text-secondary"}`}
                >
                  Order history
                </button>
              </div>

              {ordersTab === "open" &&
                (openOrders.length === 0 ? (
                  <p className="py-6 text-center text-sm text-text-secondary">No open orders.</p>
                ) : (
                  <div className="flex flex-col divide-y divide-border">
                    {openOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between py-2 text-sm">
                        <div>
                          <span className={order.side === "BUY" ? "text-success" : "text-danger"}>{order.side}</span>{" "}
                          <span className="font-medium text-text-primary">{order.symbol}</span>
                          <p className="financial-value text-body-sm text-text-secondary">
                            {order.quantity} @ {order.limitPrice}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => cancelOrder(order.id)}
                          aria-label="Cancel order"
                          className="touch-target inline-flex items-center justify-center text-text-tertiary hover:text-danger"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}

              {ordersTab === "history" &&
                (orderHistory.length === 0 ? (
                  <p className="py-6 text-center text-sm text-text-secondary">No filled orders yet.</p>
                ) : (
                  <div className="flex flex-col divide-y divide-border">
                    {orderHistory.map((order) => (
                      <div key={order.id} className="flex items-center justify-between py-2 text-sm">
                        <div>
                          <span className={order.side === "BUY" ? "text-success" : "text-danger"}>{order.side}</span>{" "}
                          <span className="font-medium text-text-primary">{order.symbol}</span>
                          <p className="financial-value text-body-sm text-text-secondary">
                            {order.quantity} @ {order.filledPrice}
                          </p>
                        </div>
                        <span className="text-body-sm text-text-tertiary">
                          {order.filledAt ? new Date(order.filledAt).toLocaleDateString() : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>

        {/* Buy/sell panel */}
        <Card className="h-fit">
          <CardContent className="p-4">
            <div className="mb-3 grid grid-cols-2 gap-2">
              <Button variant={side === "BUY" ? "primary" : "outline"} onClick={() => setSide("BUY")}>
                Buy
              </Button>
              <Button variant={side === "SELL" ? "danger" : "outline"} onClick={() => setSide("SELL")}>
                Sell
              </Button>
            </div>

            <div className="mb-3 flex gap-1 rounded-md border border-border bg-surface p-1">
              {(["MARKET", "LIMIT"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOrderType(t)}
                  className={`flex-1 rounded px-2 py-1 text-sm font-medium capitalize ${
                    orderType === t ? "bg-primary text-primary-foreground" : "text-text-secondary"
                  }`}
                >
                  {t.toLowerCase()}
                </button>
              ))}
            </div>

            <p className="mb-3 text-body-sm text-text-secondary">
              Available: <span className="financial-value">{Number(availableBalance).toFixed(6)}</span>{" "}
              {side === "BUY" ? pair.quoteAsset : pair.baseAsset}
            </p>

            <div className="flex flex-col gap-3">
              {orderType === "LIMIT" && (
                <TextField
                  label={`Limit price (${pair.quoteAsset})`}
                  inputMode="decimal"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  className="financial-value"
                />
              )}
              <TextField
                label={`Quantity (${pair.baseAsset})`}
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="financial-value"
              />

              <p className="text-body-sm text-text-secondary">
                Est. {side === "BUY" ? "cost" : "receive"}:{" "}
                <span className="financial-value font-medium text-text-primary">
                  {estimatedTotal} {pair.quoteAsset}
                </span>
              </p>

              {error && (
                <p role="alert" className="text-body-sm text-danger">
                  {error}
                </p>
              )}
              {successMessage && <p className="text-body-sm text-success">{successMessage}</p>}

              <Button
                variant={side === "BUY" ? "primary" : "danger"}
                size="lg"
                disabled={submitting || !quantity || (orderType === "LIMIT" && !limitPrice)}
                onClick={submitOrder}
              >
                {submitting ? "Placing..." : `${side === "BUY" ? "Buy" : "Sell"} ${pair.baseAsset}`}
              </Button>

              <p className="text-body-sm text-text-tertiary">Simulated order — demo funds only.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
