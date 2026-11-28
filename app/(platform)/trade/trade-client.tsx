"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utilities/cn";
import { TradeChart } from "./trade-chart";
import { TradingPanel } from "./trading-panel-client";
import { OrdersClient } from "./orders-client";

type SerializedOrder = {
  id: string;
  userId: string;
  symbol: string;
  side: string;
  type: string;
  quantity: string;
  limitPrice: string | null;
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
}: {
  initialSymbol: string;
  initialInterval: string;
  initialCandles: ChartCandle[];
  initialTicker: MarketTicker | null;
  initialOpenOrders: SerializedOrder[];
  initialOrderHistory: SerializedOrder[];
  instrument: TradingInstrument;
  allInstruments: TradingInstrument[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [symbol, setSymbol] = useState(initialSymbol);
  const [openOrders, setOpenOrders] = useState(initialOpenOrders);
  const [orderHistory, setOrderHistory] = useState(initialOrderHistory);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

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
      setSymbol(newSymbol);
      setIsDropdownOpen(false);
      setSearchQuery("");
      
      // Navigate with new symbol, preserve interval
      const currentInterval = searchParams.get("interval") || initialInterval;
      router.push(`/trade?symbol=${newSymbol}&interval=${currentInterval}`);
    },
    [router, searchParams, initialInterval]
  );

  const handleOrderSuccess = useCallback(async () => {
    // Trigger refresh by updating key and fetching new data
    setRefreshKey((prev) => prev + 1);
    
    // Fetch updated orders
    try {
      const response = await fetch(`/api/trade/orders?symbol=${symbol}`);
      if (response.ok) {
        const data = await response.json();
        setOpenOrders(data.openOrders || []);
        setOrderHistory(data.orderHistory || []);
      }
    } catch (error) {
      console.error("Failed to refresh orders:", error);
    }
  }, [symbol]);

  const handleOrderCancel = useCallback(async () => {
    // Refresh orders after cancellation
    setRefreshKey((prev) => prev + 1);
    
    try {
      const response = await fetch(`/api/trade/orders?symbol=${symbol}`);
      if (response.ok) {
        const data = await response.json();
        setOpenOrders(data.openOrders || []);
        setOrderHistory(data.orderHistory || []);
      }
    } catch (error) {
      console.error("Failed to refresh orders:", error);
    }
  }, [symbol]);

  // Prepare order overlays for chart
  const orderOverlays = [
    // Open limit orders as horizontal lines
    ...openOrders
      .filter((o) => o.type === "LIMIT" && o.limitPrice)
      .map((o) => ({
        id: o.id,
        symbol: o.symbol,
        type: "LIMIT_OPEN" as const,
        side: o.side as "BUY" | "SELL",
        price: parseFloat(o.limitPrice!),
      })),
    // Filled orders as markers
    ...orderHistory
      .filter((o) => o.status === "FILLED" && o.filledAt && o.filledPrice)
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
            Place orders and manage your cryptocurrency trades
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
            key={`${symbol}-${initialInterval}-${refreshKey}`}
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
        <TradingPanel
          symbol={symbol}
          ticker={initialTicker}
          baseAsset={instrument.baseAsset}
          quoteAsset={instrument.quoteAsset}
          onOrderSuccess={handleOrderSuccess}
        />
      )}

      {/* Open Orders */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Current Orders</CardTitle>
            <Badge variant={openOrders.length > 0 ? "primary" : "neutral"}>
              {openOrders.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {openOrders.length === 0 ? (
            <p className="text-sm text-text-tertiary text-center py-8">
              No open orders for {symbol}
            </p>
          ) : (
            <OrdersClient
              orders={openOrders}
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
          {orderHistory.length === 0 ? (
            <p className="text-sm text-text-tertiary text-center py-8">
              No order history for {symbol}
            </p>
          ) : (
            <OrdersClient orders={orderHistory} onOrderCancel={handleOrderCancel} />
          )}
        </CardContent>
      </Card>

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
