"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLiveTicker } from "@/lib/bybit/use-live-ticker";
import type { SupportedPair } from "@/lib/bybit/instruments";
import type { MarketTicker, Candle, OrderBookSnapshot, RecentTrade } from "@/lib/bybit/types";
import { CandlestickChart } from "@/components/charts/candlestick-chart";
import { OrderBookDisplay } from "@/components/financial/order-book-display";
import { TradeHeader } from "@/components/financial/trade-header";
import { TradeOrderTicket } from "@/components/financial/trade-order-ticket";
import {
  TradeOrdersPanel,
  type OpenOrderView,
  type OrderHistoryView,
} from "@/components/financial/trade-orders-panel";
import { Card, CardContent } from "@/components/ui/card";
import { postJsonIdempotent, deleteJson, ApiRequestError } from "@/lib/utilities/api-client";
import { generateClientId } from "@/lib/utilities/id";
import { cn } from "@/lib/utilities/cn";

interface WalletAssetView {
  assetSymbol: string;
  available: string;
  locked: string;
  usdValue: string;
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

type MobilePanel = "chart" | "book" | "trades" | "orders";

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

  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = React.useState<string | null>(null);

  const [openOrders, setOpenOrders] = React.useState(initialOpenOrders);
  const [cancellingOrderId, setCancellingOrderId] = React.useState<string | null>(null);
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  const [mobilePanel, setMobilePanel] = React.useState<MobilePanel>("chart");

  // Keep open orders in sync when server props refresh
  React.useEffect(() => {
    setOpenOrders(initialOpenOrders);
  }, [initialOpenOrders]);

  function handlePairChange(newSymbol: string) {
    router.push(`/trade?symbol=${newSymbol}&side=${initialSide}`);
  }

  async function handleSubmitOrder(params: {
    side: "BUY" | "SELL";
    orderType: "MARKET" | "LIMIT";
    quantity: string;
    limitPrice?: string;
  }) {
    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitting(true);

    try {
      const body =
        params.orderType === "MARKET"
          ? { symbol: pair.symbol, side: params.side, quantity: params.quantity, orderType: "MARKET" }
          : {
              symbol: pair.symbol,
              side: params.side,
              quantity: params.quantity,
              limitPrice: params.limitPrice,
              orderType: "LIMIT",
            };

      await postJsonIdempotent("/api/orders", body, generateClientId());

      setSubmitSuccess(
        params.orderType === "MARKET"
          ? `Market ${params.side} order filled.`
          : `Limit ${params.side} order placed.`
      );
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelOrder(orderId: string) {
    setCancellingOrderId(orderId);
    setCancelError(null);

    try {
      await deleteJson(`/api/orders/${orderId}`);
      // Only remove after backend confirmation!
      setOpenOrders((prev) => prev.filter((o) => o.id !== orderId));
      router.refresh();
    } catch (err) {
      setCancelError(err instanceof ApiRequestError ? err.message : "Failed to cancel order.");
    } finally {
      setCancellingOrderId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-12 overflow-x-hidden">
      {/* ── Top Trading Header ────────────────────────────────────────────── */}
      <TradeHeader
        pair={pair}
        ticker={ticker}
        isLive={isLive}
        onPairChange={handlePairChange}
      />

      {/* ── Mobile Viewport Panel Switcher (<1024px) ───────────────────────── */}
      <div
        role="tablist"
        aria-label="Trading panels"
        className="flex gap-1 rounded-lg border border-border bg-surface p-1 lg:hidden"
      >
        {(
          [
            { id: "chart", label: "Chart" },
            { id: "book", label: "Order Book" },
            { id: "trades", label: "Trades" },
            { id: "orders", label: `Orders (${openOrders.length})` },
          ] as const
        ).map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={mobilePanel === p.id}
            onClick={() => setMobilePanel(p.id)}
            className={cn(
              "touch-target flex-1 rounded-md px-2 py-2 text-xs font-semibold transition-all cursor-pointer",
              mobilePanel === p.id
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {cancelError && (
        <div role="alert" className="rounded-lg bg-danger-soft p-3 text-xs text-danger">
          {cancelError}
        </div>
      )}

      {/* ── Main Trading Workspace Grid ───────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* ── Left / Main Content Column (8 cols on desktop) ─────────────── */}
        <div className="flex flex-col gap-4 lg:col-span-8">
          {/* Chart Panel */}
          <Card
            className={cn(
              "rounded-xl border-border bg-surface shadow-xs",
              mobilePanel === "chart" ? "block" : "hidden lg:block"
            )}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-card-title text-text-primary">
                  {pair.baseAsset}/{pair.quoteAsset} Price Chart
                </h2>
                <span className="text-xs text-text-tertiary">
                  Interval: 1h · Candles: {candles.length}
                </span>
              </div>
              <CandlestickChart candles={candles} />
            </CardContent>
          </Card>

          {/* Depth & Activity Subgrid (Order Book & Recent Trades) */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Order Book Panel */}
            <Card
              className={cn(
                "rounded-xl border-border bg-surface shadow-xs",
                mobilePanel === "book" ? "block" : "hidden lg:block"
              )}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-card-title text-text-primary">Order Book</h2>
                  <span className="text-xs text-text-tertiary">Market Depth</span>
                </div>
                <OrderBookDisplay
                  orderBook={orderBook}
                  pricePrecision={pair.pricePrecision}
                  quantityPrecision={pair.quantityPrecision}
                />
              </CardContent>
            </Card>

            {/* Recent Trades Panel */}
            <Card
              className={cn(
                "rounded-xl border-border bg-surface shadow-xs",
                mobilePanel === "trades" ? "block" : "hidden lg:block"
              )}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-card-title text-text-primary">Recent Trades</h2>
                  <span className="text-xs text-text-tertiary">Real-time Stream</span>
                </div>

                <div className="flex flex-col">
                  <div className="mb-1.5 flex justify-between px-1 text-label uppercase text-text-tertiary">
                    <span>Price ({pair.quoteAsset})</span>
                    <span>Quantity ({pair.baseAsset})</span>
                  </div>

                  <div className="flex flex-col divide-y divide-border/60">
                    {trades.slice(0, 12).map((trade) => (
                      <div
                        key={trade.id}
                        className="flex items-center justify-between py-1.5 px-1 text-xs hover:bg-surface-hover/50 transition-colors"
                      >
                        <span
                          className={cn(
                            "financial-value font-mono font-medium",
                            trade.side === "BUY" ? "text-success" : "text-danger"
                          )}
                        >
                          {Number(trade.price).toFixed(pair.pricePrecision)}
                        </span>
                        <span className="financial-value font-mono text-text-secondary">
                          {Number(trade.quantity).toFixed(pair.quantityPrecision)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Orders Panel (Desktop: below depth. Mobile: when 'orders' selected) */}
          <div className={cn(mobilePanel === "orders" ? "block" : "hidden lg:block")}>
            <TradeOrdersPanel
              openOrders={openOrders}
              orderHistory={orderHistory}
              cancellingOrderId={cancellingOrderId}
              onCancelOrder={handleCancelOrder}
            />
          </div>
        </div>

        {/* ── Right Column: Order Entry Ticket (4 cols on desktop) ────────── */}
        <div className="lg:col-span-4">
          <div className="sticky top-20 flex flex-col gap-4">
            <TradeOrderTicket
              pair={pair}
              ticker={ticker}
              wallet={wallet}
              initialSide={initialSide}
              submitting={submitting}
              submitError={submitError}
              submitSuccess={submitSuccess}
              onSubmit={handleSubmitOrder}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
