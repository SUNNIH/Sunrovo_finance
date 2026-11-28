"use client";

import { useState, useCallback, useEffect, useRef } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import { TrendingUp, TrendingDown, ChevronDown, Search } from "lucide-react";

import { cn } from "@/lib/utilities/cn";

import { TradeChart } from "./trade-chart";

import { TradingPanelWithStopLoss } from "./trading-panel-with-stop-loss";

import { OrdersClient } from "./orders-client";

import { ConversionTab } from "./conversion-tab";
import { DirectionalTab } from "./directional-tab";

import type { WalletView } from "@/features/crypto/wallets";

type SerializedOrder = {

  id: string;

  userId: string;

  symbol: string;

  side: string;

  type: string;

  quantity: string;

  limitPrice: string | null;

  stopPrice?: string | null;
  takeProfitPrice?: string | null;
  parentOrderId?: string | null;
  exitTrigger?: string | null;

  filledPrice: string | null;

  feeAmount: string | null;

  status: string;

  idempotencyKey: string;

  ledgerGroupId: string | null;

  createdAt: string;

  filledAt: string | null;

  cancelledAt: string | null;

};

type ChartCandle = {

  openTime: string;

  open: string;

  high: string;

  low: string;

  close: string;

  volume: string;

};

type TradingInstrument = {

  symbol: string;

  baseAsset: string;

  quoteAsset: string;

  status: string;

  pricePrecision: number;

  quantityPrecision: number;

};

type MarketTicker = {

  lastPrice: string;

  priceChangePercent24h: string;

  status: "live" | "stale" | "unavailable";

};

export function TradeClient({

  initialSymbol,

  initialInterval,

  initialCandles,

  initialTicker,

  initialOpenOrders,

  initialOrderHistory,

  instrument,

  allInstruments,

  initialTab,

  userId,

  walletData,

}: {

  initialSymbol: string;

  initialInterval: string;

  initialCandles: ChartCandle[];

  initialTicker: MarketTicker | null;

  initialOpenOrders: SerializedOrder[];

  initialOrderHistory: SerializedOrder[];

  instrument: TradingInstrument;

  allInstruments: TradingInstrument[];

  initialTab: string;

  userId: string;

  walletData: WalletView | null;

}) {

  const router = useRouter();

  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<"spot" | "convert" | "directional">(

    initialTab === "convert" ? "convert" : initialTab === "directional" ? "directional" : "spot"

  );

  const symbol = initialSymbol;

  const [openOrders, setOpenOrders] = useState(initialOpenOrders);

  const [orderHistory, setOrderHistory] = useState(initialOrderHistory);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  const priceChange = initialTicker

    ? parseFloat(initialTicker.priceChangePercent24h)

    : 0;

  // Filter tradable instruments (active status)

  const tradableInstruments = allInstruments.filter(

    (i) => i.status === "active"

  );

  // Filter instruments by search query

  const filteredInstruments = searchQuery.trim()

    ? tradableInstruments.filter((i) =>

        i.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||

        i.baseAsset.toLowerCase().includes(searchQuery.toLowerCase()) ||

        i.quoteAsset.toLowerCase().includes(searchQuery.toLowerCase())

      )

    : tradableInstruments;

  const handleSymbolChange = useCallback(

    (newSymbol: string) => {

      setIsDropdownOpen(false);

      setSearchQuery("");

      // Navigate with new symbol, preserve interval and tab

      const currentInterval = searchParams.get("interval") || initialInterval;

      router.push(`/trade?symbol=${encodeURIComponent(newSymbol)}&interval=${currentInterval}&tab=${activeTab}`);

    },

    [router, searchParams, initialInterval, activeTab]

  );

  const handleTabChange = useCallback(

    (tab: "spot" | "convert" | "directional") => {

      setActiveTab(tab);

      const currentInterval = searchParams.get("interval") || initialInterval;

      router.push(`/trade?symbol=${symbol}&interval=${currentInterval}&tab=${tab}`);

    },

    [router, searchParams, initialInterval, symbol]

  );

  // Keep local order state in sync when the server provides fresh props.

  useEffect(() => {

    setOpenOrders(initialOpenOrders);

    setOrderHistory(initialOrderHistory);

  }, [initialOpenOrders, initialOrderHistory]);

  useEffect(() => {

    setActiveTab(initialTab === "convert" ? "convert" : initialTab === "directional" ? "directional" : "spot");

  }, [initialTab]);

  // Ignore earlier responses if multiple refreshes finish out of order.

  const latestOrderRequest = useRef(0);

  const refreshOrders = useCallback(async () => {

    const requestId = ++latestOrderRequest.current;

    try {

      const response = await fetch(

        `/api/trade/orders?symbol=${encodeURIComponent(symbol)}`,

        { cache: "no-store" }

      );

      if (!response.ok) {

        throw new Error(`Order refresh failed (HTTP ${response.status})`);

      }

      const data = await response.json();

      if (requestId !== latestOrderRequest.current) return;

      const nextOpenOrders: SerializedOrder[] = Array.isArray(data.openOrders)

        ? data.openOrders

        : [];

      const nextHistory: SerializedOrder[] = Array.isArray(data.orderHistory)

        ? data.orderHistory

        : [];

      setOpenOrders(nextOpenOrders.filter((order) => order.symbol === symbol));

      setOrderHistory(nextHistory.filter((order) => order.symbol === symbol));

    } catch (error) {

      console.error("Failed to refresh trade orders:", error);

    }

  }, [symbol]);

  const handleOrderSuccess = refreshOrders;

  const handleOrderCancel = refreshOrders;

  // Automatic order refresh for server-side Stop Loss/Take Profit triggers.
  // Does not remount the chart or reset the user's zoom/pan.
  useEffect(() => {
    if (activeTab !== "spot") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshOrders();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [refreshOrders, activeTab]);

  // Defense in depth: never send another pair's orders to this chart or table.

  const pairOpenOrders = openOrders.filter((order) => order.symbol === symbol);

  const pairOrderHistory = orderHistory.filter((order) => order.symbol === symbol);
  const filledParents = new Map(
    pairOrderHistory
      .filter((order) => order.status === "FILLED" && order.side === "BUY" && order.filledPrice)
      .map((order) => [order.id, order] as const)
  );

  // Prepare order overlays for chart

  const orderOverlays = [

    // Open limit orders as horizontal lines - only OPEN status

    ...pairOpenOrders

      .filter((o) => o.status === "OPEN" && o.type === "LIMIT" && o.limitPrice && Number.isFinite(Number(o.limitPrice)) && Number(o.limitPrice) > 0)

      .map((o) => ({

        id: o.id,

        symbol: o.symbol,

        type: "LIMIT_OPEN" as const,

        side: o.side as "BUY" | "SELL",

        price: parseFloat(o.limitPrice!),

      })),

    // Open stop-loss orders as horizontal lines - only OPEN status

    ...pairOpenOrders

      .filter((o) => o.status === "OPEN" && (o.type === "STOP_LOSS" || o.type === "TAKE_PROFIT") && o.stopPrice && Number.isFinite(Number(o.stopPrice)) && Number(o.stopPrice) > 0)

      .map((o) => ({

        id: `${o.id}:SL`,

        symbol: o.symbol,

        type: "STOP_OPEN" as const,

        side: o.side as "BUY" | "SELL",

        price: parseFloat(o.stopPrice!),

      })),

    // Take Profit has its own green line even when SL shares the same bracket.
    ...pairOpenOrders
      .filter((o) =>
        o.status === "OPEN" &&
        (o.type === "STOP_LOSS" || o.type === "TAKE_PROFIT") &&
        o.takeProfitPrice != null && Number.isFinite(Number(o.takeProfitPrice)) && Number(o.takeProfitPrice) > 0
      )
      .map((o) => ({
        id: `${o.id}:TP`,
        symbol: o.symbol,
        type: "TAKE_PROFIT_OPEN" as const,
        side: "SELL" as const,
        price: Number(o.takeProfitPrice),
      })),

    // Active entry lines exist only while a linked protective bracket is OPEN.
    ...pairOpenOrders
      .filter((o) =>
        o.status === "OPEN" &&
        (o.type === "STOP_LOSS" || o.type === "TAKE_PROFIT") &&
        o.parentOrderId &&
        filledParents.has(o.parentOrderId)
      )
      .map((o) => {
        const entry = filledParents.get(o.parentOrderId!)!;
        return {
          id: `${o.id}:ENTRY`,
          symbol: o.symbol,
          type: "ENTRY_ACTIVE" as const,
          side: "BUY" as const,
          price: Number(entry.filledPrice),
        };
      })
      .filter((o) => Number.isFinite(o.price) && o.price > 0),

    // Filled orders as markers

    ...pairOrderHistory

      .filter((o) => o.status === "FILLED" && o.filledAt && o.filledPrice && Number.isFinite(Number(o.filledPrice)) && Number(o.filledPrice) > 0 && Number.isFinite(Date.parse(o.filledAt)))

      .map((o) => ({

        id: o.id,

        symbol: o.symbol,

        type: "FILLED" as const,

        side: o.side as "BUY" | "SELL",

        price: parseFloat(o.filledPrice!),

        time: Math.floor(new Date(o.filledAt!).getTime() / 1000),

      })),

  ];

  return (

    <div className="flex flex-col gap-6">

      {/* Tabs */}

      <div className="flex items-center gap-4 border-b">

        <button

          type="button"

          onClick={() => handleTabChange("spot")}

          className={cn(

            "px-4 py-3 font-medium border-b-2 transition-colors",

            activeTab === "spot"

              ? "border-primary text-primary"

              : "border-transparent text-text-tertiary hover:text-text-primary"

          )}

        >

          Spot Trading

        </button>

        <button
          type="button"
          onClick={() => handleTabChange("directional")}
          className={cn("px-4 py-3 font-medium border-b-2 transition-colors",
            activeTab === "directional" ? "border-primary text-primary" : "border-transparent text-text-tertiary hover:text-text-primary")}
        >
          Long / Short (1×)
        </button>

        <button

          type="button"

          onClick={() => handleTabChange("convert")}

          className={cn(

            "px-4 py-3 font-medium border-b-2 transition-colors",

            activeTab === "convert"

              ? "border-primary text-primary"

              : "border-transparent text-text-tertiary hover:text-text-primary"

          )}

        >

          Convert

        </button>

      </div>

      {/* Spot Trading Tab */}

      {activeTab === "spot" && (

        <>

          {/* Header with Symbol Selector */}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

            <div className="flex-1">

              {/* Symbol Dropdown */}

              <div className="relative inline-block">

                <button

                  type="button"

                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}

                  className="flex items-center gap-2 text-page-title-mobile sm:text-page-title text-text-primary hover:text-primary transition-colors"

                >

                  <span>

                    {instrument.baseAsset}/{instrument.quoteAsset}

                  </span>

                  <ChevronDown

                    className={cn(

                      "h-5 w-5 transition-transform",

                      isDropdownOpen && "rotate-180"

                    )}

                  />

                </button>

                {/* Dropdown Menu */}

                {isDropdownOpen && (

                  <div className="absolute z-50 mt-2 w-80 bg-surface border rounded-lg shadow-lg">

                    {/* Search */}

                    <div className="p-3 border-b">

                      <div className="relative">

                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />

                        <input

                          type="text"

                          placeholder="Search markets..."

                          value={searchQuery}

                          onChange={(e) => setSearchQuery(e.target.value)}

                          className="w-full pl-9 pr-3 py-2 border rounded-md text-sm"

                          autoFocus

                        />

                      </div>

                    </div>

                    {/* Market List */}

                    <div className="max-h-96 overflow-y-auto">

                      {filteredInstruments.length === 0 ? (

                        <div className="p-4 text-center text-sm text-text-tertiary">

                          No markets found

                        </div>

                      ) : (

                        filteredInstruments.map((inst) => (

                          <button

                            key={inst.symbol}

                            type="button"

                            onClick={() => handleSymbolChange(inst.symbol)}

                            className={cn(

                              "w-full px-4 py-3 text-left hover:bg-surface-hover transition-colors flex items-center justify-between",

                              inst.symbol === symbol && "bg-surface-hover"

                            )}

                          >

                            <div>

                              <div className="font-medium text-text-primary">

                                {inst.baseAsset}/{inst.quoteAsset}

                              </div>

                              <div className="text-xs text-text-tertiary">

                                {inst.symbol}

                              </div>

                            </div>

                            {inst.symbol === symbol && (

                              <Badge variant="primary">Current</Badge>

                            )}

                          </button>

                        ))

                      )}

                    </div>

                  </div>

                )}

              </div>

              <p className="mt-1 text-sm text-text-tertiary">

                Place Market, Limit, and Stop-Loss orders

              </p>

            </div>

            {/* Current Price */}

            <div className="flex flex-col items-start sm:items-end gap-2">

              {initialTicker ? (

                <>

                  <div className="flex items-baseline gap-2">

                    <span className="text-3xl font-bold text-text-primary tabular-nums">

                      {parseFloat(initialTicker.lastPrice).toFixed(

                        instrument.pricePrecision

                      )}

                    </span>

                    <span className="text-sm text-text-tertiary">

                      {instrument.quoteAsset}

                    </span>

                  </div>

                  <div className="flex items-center gap-2">

                    {priceChange > 0 ? (

                      <TrendingUp className="h-4 w-4 text-success" />

                    ) : priceChange < 0 ? (

                      <TrendingDown className="h-4 w-4 text-danger" />

                    ) : null}

                    <span

                      className={cn(

                        "text-sm font-medium tabular-nums",

                        priceChange > 0

                          ? "text-success"

                          : priceChange < 0

                          ? "text-danger"

                          : "text-text-tertiary"

                      )}

                    >

                      {priceChange > 0 ? "+" : ""}

                      {(priceChange * 100).toFixed(2)}% (24h)

                    </span>

                  </div>

                </>

              ) : (

                <Badge variant="danger">Price Unavailable</Badge>

              )}

            </div>

          </div>

          {/* Chart */}

          <Card>

            <CardHeader>

              <CardTitle>Price Chart</CardTitle>

            </CardHeader>

            <CardContent>

              <TradeChart

                key={`${symbol}-${initialInterval}`}

                symbol={symbol}

                candles={initialCandles}

                currentInterval={initialInterval}

                pricePrecision={instrument.pricePrecision}

                liveTicker={initialTicker}

                orders={orderOverlays}

              />

            </CardContent>

          </Card>

          {/* Trading Panel */}

          {initialTicker && (

            <TradingPanelWithStopLoss

              symbol={symbol}

              ticker={initialTicker}

              baseAsset={instrument.baseAsset}

              quoteAsset={instrument.quoteAsset}

              walletData={walletData}

              onOrderSuccess={handleOrderSuccess}

            />

          )}

          {/* Open Orders */}

          <Card>

            <CardHeader>

              <div className="flex items-center justify-between">

                <CardTitle>Current Orders</CardTitle>

                <Badge variant={pairOpenOrders.length > 0 ? "primary" : "neutral"}>

                  {pairOpenOrders.length}

                </Badge>

              </div>

            </CardHeader>

            <CardContent>

              {pairOpenOrders.length === 0 ? (

                <p className="text-sm text-text-tertiary text-center py-8">

                  No open orders for {symbol}

                </p>

              ) : (

                <OrdersClient

                  orders={pairOpenOrders}

                  isOpenOrders

                  onOrderCancel={handleOrderCancel}

                />

              )}

            </CardContent>

          </Card>

          {/* Order History */}

          <Card>

            <CardHeader>

              <CardTitle>Order History</CardTitle>

            </CardHeader>

            <CardContent>

              {pairOrderHistory.length === 0 ? (

                <p className="text-sm text-text-tertiary text-center py-8">

                  No order history for {symbol}

                </p>

              ) : (

                <OrdersClient orders={pairOrderHistory} onOrderCancel={handleOrderCancel} />

              )}

            </CardContent>

          </Card>

        </>

      )}

      {/* Independent synthetic 1x position engine (not spot orders). */}
      {activeTab === "directional" && <DirectionalTab
        key={`${symbol}:directional`}
        symbol={symbol}
        interval={initialInterval}
        candles={initialCandles}
        ticker={initialTicker}
        pricePrecision={instrument.pricePrecision}
        quantityPrecision={instrument.quantityPrecision}
        instruments={allInstruments}
        walletData={walletData}
      />}

      {/* Convert Tab */}

      {activeTab === "convert" && <ConversionTab userId={userId} />}

      {/* Click outside to close dropdown */}

      {isDropdownOpen && (

        <div

          className="fixed inset-0 z-40"

          onClick={() => {

            setIsDropdownOpen(false);

            setSearchQuery("");

          }}

        />

      )}

    </div>

  );

}
