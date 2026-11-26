"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { useTheme } from "next-themes";

import {

  createChart,

  createSeriesMarkers,

  CandlestickSeries,

  HistogramSeries,

  ColorType,

  CrosshairMode,

  LineStyle,

  type IChartApi,

  type ISeriesApi,

  type ISeriesMarkersPluginApi,

  type CandlestickData,

  type HistogramData,

  type SeriesMarker,

  type Time,

  type UTCTimestamp,

} from "lightweight-charts";

import type { CandlestickInterval } from "@/lib/market/types";

import { cn } from "@/lib/utilities/cn";

import { useBybitWebSocket } from "../markets/[symbol]/use-bybit-websocket";

const INTERVALS: { value: CandlestickInterval; label: string }[] = [

  { value: "1m", label: "1m" },

  { value: "5m", label: "5m" },

  { value: "15m", label: "15m" },

  { value: "1h", label: "1h" },

  { value: "4h", label: "4h" },

  { value: "1d", label: "1d" },

];

// The preference is display-only and is shared across chart intervals/markets.
const PREVIOUS_TRADES_VISIBILITY_KEY = "sunrovo:trade-chart:previous-trades-visible";

const INTERVAL_SECONDS: Record<string, number> = {

  "1m": 60,

  "5m": 300,

  "15m": 900,

  "1h": 3600,

  "4h": 14400,

  "1d": 86400,

};

type ChartCandle = {

  openTime: string;

  open: string;

  high: string;

  low: string;

  close: string;

  volume: string;

};

type LiveTicker = {

  lastPrice: string;

  status: "live" | "stale" | "unavailable";

} | null;

type OrderOverlay = {

  id: string;

  symbol: string; // Required: do not render another market's orders

  type: "LIMIT_OPEN" | "STOP_OPEN" | "TAKE_PROFIT_OPEN" | "ENTRY_ACTIVE" | "FILLED";

  side: "BUY" | "SELL";

  price: number;

  time?: number; // Actual fill time, Unix seconds

};

type PriceLine = ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]>;

type TrackedOrderLine = { line: PriceLine; signature: string };

type TradeChartProps = {

  symbol: string;

  candles: ChartCandle[];

  currentInterval: string;

  pricePrecision: number;

  liveTicker?: LiveTicker;

  orders?: OrderOverlay[];

};

// Locate the actual candle containing a trade. Markers must use a candle's

// timestamp, not the trade's arbitrary execution timestamp.

function findMarkerCandleTime(

  tradeTime: number,

  candleTimes: number[],

  intervalSeconds: number,

): UTCTimestamp | null {

  if (!Number.isFinite(tradeTime) || candleTimes.length === 0) return null;

  let left = 0;

  let right = candleTimes.length - 1;

  let matchingIndex = -1;

  while (left <= right) {

    const middle = Math.floor((left + right) / 2);

    if (candleTimes[middle]! <= tradeTime) {

      matchingIndex = middle;

      left = middle + 1;

    } else {

      right = middle - 1;

    }

  }

  if (matchingIndex < 0) return null;

  const candleTime = candleTimes[matchingIndex]!;

  if (tradeTime >= candleTime + intervalSeconds) return null;

  return candleTime as UTCTimestamp;

}

export function TradeChart({

  symbol,

  candles,

  currentInterval,

  pricePrecision,

  liveTicker,

  orders = [],

}: TradeChartProps) {

  const router = useRouter();

  const { resolvedTheme } = useTheme();

  const chartContainerRef = useRef<HTMLDivElement>(null);

  const chartRef = useRef<IChartApi | null>(null);

  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const markersApiRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  const priceLineRef = useRef<PriceLine | null>(null);

  const orderLinesRef = useRef<Map<string, TrackedOrderLine>>(new Map());

  const initialRangeSetRef = useRef(false);

  const latestCandleTimeRef = useRef<number | null>(null);

  const candleTimesRef = useRef<number[]>([]);

  const [mounted, setMounted] = useState(false);

  const [candleVersion, setCandleVersion] = useState(0);

  // Historical fills are chart annotations, not active orders or ledger data.
  const [showPreviousTrades, setShowPreviousTrades] = useState(true);

  const [livePrice, setLivePrice] = useState<string | null>(

    liveTicker?.lastPrice ?? null,

  );

  const [connectionStatus, setConnectionStatus] = useState<

    "live" | "stale" | "unavailable"

  >(liveTicker?.status ?? "unavailable");

  useEffect(() => {

    setMounted(true);

    // Read the browser preference only after mounting to avoid SSR mismatch.
    try {
      if (window.localStorage.getItem(PREVIOUS_TRADES_VISIBILITY_KEY) === "false") {
        setShowPreviousTrades(false);
      }
    } catch {
      // A disabled storage API should not prevent the chart from rendering.
    }

  }, []);

  const togglePreviousTrades = () => {
    const nextValue = !showPreviousTrades;
    setShowPreviousTrades(nextValue);
    try {
      window.localStorage.setItem(PREVIOUS_TRADES_VISIBILITY_KEY, String(nextValue));
    } catch {
      // The toggle still works for this session when storage is unavailable.
    }
  };

  // Reset the price display when changing pairs; do not carry over the

  // previous pair's last traded price.

  useEffect(() => {

    setLivePrice(liveTicker?.lastPrice ?? null);

    setConnectionStatus(liveTicker?.status ?? "unavailable");

  }, [symbol, liveTicker?.lastPrice, liveTicker?.status]);

  const onTickerUpdate = useCallback((data: { lastPrice: string }) => {

    setLivePrice(data.lastPrice);

    setConnectionStatus("live");

  }, []);

  const onKlineUpdate = useCallback(

    (data: {

      start: number;

      open: string;

      high: string;

      low: string;

      close: string;

    }) => {

      const series = candlestickSeriesRef.current;

      if (!series) return;

      const candleTime = Math.floor(data.start / 1000);

      const open = Number(data.open);

      const high = Number(data.high);

      const low = Number(data.low);

      const close = Number(data.close);

      if (

        ![candleTime, open, high, low, close].every(Number.isFinite) ||

        (latestCandleTimeRef.current !== null &&

          candleTime < latestCandleTimeRef.current)

      ) {

        return;

      }

      const candleData: CandlestickData = {

        time: candleTime as UTCTimestamp,

        open,

        high,

        low,

        close,

      };

      const previousCandleTime = latestCandleTimeRef.current;

      series.update(candleData);

      if (previousCandleTime === null || candleTime > previousCandleTime) {

        candleTimesRef.current.push(candleTime);

        // Re-evaluate markers when the current candle history grows.

        setCandleVersion((version) => version + 1);

      }

      latestCandleTimeRef.current = candleTime;

    },

    [],

  );

  const { isConnected } = useBybitWebSocket({

    symbol,

    interval: currentInterval,

    enabled: mounted,

    onTickerUpdate,

    onKlineUpdate,

  });

  const handleIntervalChange = (interval: CandlestickInterval) => {

    router.push(`/trade?symbol=${encodeURIComponent(symbol)}&interval=${interval}`);

  };

  // Create the chart and marker plugin once per chart configuration.

  // Candle updates and order updates are handled by separate effects below.

  useEffect(() => {

    const container = chartContainerRef.current;

    if (!mounted || !container) return;

    const isDark = resolvedTheme === "dark";

    const colors = {

      background: isDark ? "#171717" : "#fafaf9",

      text: isDark ? "#e5e5e5" : "#1c1917",

      textSecondary: isDark ? "#a3a3a3" : "#78716c",

      grid: isDark ? "#404040" : "#e7e5e4",

      upColor: isDark ? "#22c55e" : "#16a34a",

      downColor: isDark ? "#ef4444" : "#dc2626",

      borderColor: isDark ? "#404040" : "#d6d3d1",

      volumeUp: isDark ? "#22c55e40" : "#16a34a40",

      volumeDown: isDark ? "#ef444440" : "#dc262640",

    };

    const chart = createChart(container, {

      width: container.clientWidth,

      height: 600,

      layout: {

        background: { type: ColorType.Solid, color: colors.background },

        textColor: colors.text,

        fontSize: 12,

      },

      crosshair: {

        mode: CrosshairMode.Normal,

        vertLine: {

          color: colors.textSecondary,

          width: 1,

          style: LineStyle.Dotted,

          labelBackgroundColor: colors.textSecondary,

        },

        horzLine: {

          color: colors.textSecondary,

          width: 1,

          style: LineStyle.Dotted,

          labelBackgroundColor: colors.textSecondary,

        },

      },

      grid: {

        vertLines: { color: colors.grid, style: LineStyle.Dotted },

        horzLines: { color: colors.grid, style: LineStyle.Dotted },

      },

      rightPriceScale: {

        borderColor: colors.borderColor,

        scaleMargins: { top: 0.1, bottom: 0.2 },

      },

      timeScale: {

        borderColor: colors.borderColor,

        timeVisible: true,

        secondsVisible: false,

        rightOffset: 5,

        barSpacing: 8,

      },

      handleScroll: {

        mouseWheel: true,

        pressedMouseMove: true,

        horzTouchDrag: true,

        vertTouchDrag: true,

      },

      handleScale: {

        axisPressedMouseMove: true,

        mouseWheel: true,

        pinch: true,

      },

    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {

      upColor: colors.upColor,

      downColor: colors.downColor,

      borderUpColor: colors.upColor,

      borderDownColor: colors.downColor,

      wickUpColor: colors.upColor,

      wickDownColor: colors.downColor,

      lastValueVisible: false,

      priceLineVisible: false,

      priceFormat: {

        type: "price",

        precision: pricePrecision,

        minMove: Math.pow(10, -pricePrecision),

      },

    });

    const volumeSeries = chart.addSeries(HistogramSeries, {

      color: colors.textSecondary,

      priceFormat: { type: "volume" },

      priceScaleId: "",

      lastValueVisible: false,

      priceLineVisible: false,

    });

    volumeSeries.priceScale().applyOptions({

      scaleMargins: { top: 0.85, bottom: 0 },

    });

    chartRef.current = chart;

    candlestickSeriesRef.current = candlestickSeries;

    volumeSeriesRef.current = volumeSeries;

    markersApiRef.current = createSeriesMarkers(candlestickSeries, []);

    priceLineRef.current = null;

    orderLinesRef.current.clear();

    initialRangeSetRef.current = false;

    latestCandleTimeRef.current = null;

    candleTimesRef.current = [];

    const resizeObserver = new ResizeObserver(() => {

      if (container.clientWidth > 0) {

        chart.applyOptions({ width: container.clientWidth });

      }

    });

    resizeObserver.observe(container);

    return () => {

      resizeObserver.disconnect();

      orderLinesRef.current.clear();

      markersApiRef.current = null;

      priceLineRef.current = null;

      candlestickSeriesRef.current = null;

      volumeSeriesRef.current = null;

      chartRef.current = null;

      candleTimesRef.current = [];

      latestCandleTimeRef.current = null;

      chart.remove();

    };

  }, [mounted, resolvedTheme, pricePrecision, symbol, currentInterval]);

  // Update the candle/volume data without recreating the chart or resetting

  // a user's zoom/pan. Reposition only on the first dataset for this chart.

  useEffect(() => {

    const chart = chartRef.current;

    const candleSeries = candlestickSeriesRef.current;

    const volumeSeries = volumeSeriesRef.current;

    if (!chart || !candleSeries || !volumeSeries) return;

    const isDark = resolvedTheme === "dark";

    const data = candles

      .map((candle) => ({

        time: Math.floor(new Date(candle.openTime).getTime() / 1000),

        open: Number(candle.open),

        high: Number(candle.high),

        low: Number(candle.low),

        close: Number(candle.close),

        volume: Number(candle.volume),

      }))

      .filter((item) =>

        [item.time, item.open, item.high, item.low, item.close, item.volume].every(

          Number.isFinite,

        ),

      )

      .sort((a, b) => a.time - b.time);

    // Lightweight Charts requires unique, ascending timestamps.

    const uniqueData = data.filter(

      (item, index) => index === 0 || item.time !== data[index - 1]!.time,

    );

    const candlestickData: CandlestickData[] = uniqueData.map((item) => ({

      time: item.time as UTCTimestamp,

      open: item.open,

      high: item.high,

      low: item.low,

      close: item.close,

    }));

    const volumeData: HistogramData[] = uniqueData.map((item) => ({

      time: item.time as UTCTimestamp,

      value: item.volume,

      color:

        item.close >= item.open

          ? isDark

            ? "#22c55e40"

            : "#16a34a40"

          : isDark

            ? "#ef444440"

            : "#dc262640",

    }));

    candleSeries.setData(candlestickData);

    volumeSeries.setData(volumeData);

    candleTimesRef.current = uniqueData.map((item) => item.time);

    latestCandleTimeRef.current =

      uniqueData.length > 0 ? uniqueData[uniqueData.length - 1]!.time : null;

    if (candlestickData.length > 0 && !initialRangeSetRef.current) {

      chart.timeScale().setVisibleLogicalRange({

        from: Math.max(0, candlestickData.length - 120),

        to: candlestickData.length + 5,

      });

      initialRangeSetRef.current = true;

    }

  }, [candles, mounted, resolvedTheme, pricePrecision, symbol, currentInterval]);

  // Active orders produce price lines; only actual fills produce historical markers.

  // Reconcile by order ID rather than rebuilding the chart or leaving old lines behind.

  useEffect(() => {

    const series = candlestickSeriesRef.current;

    const markerPlugin = markersApiRef.current;

    if (!series || !markerPlugin) return;

    // Defense in depth: the chart itself rejects unrelated symbols.

    const pairOrders = orders.filter((order) => order.symbol === symbol);

    const activeLines = pairOrders.filter(

      (order) =>

        (order.type === "LIMIT_OPEN" ||

          order.type === "STOP_OPEN" ||

          order.type === "TAKE_PROFIT_OPEN" ||
            order.type === "ENTRY_ACTIVE") &&

        Number.isFinite(order.price) &&

        order.price > 0,

    );

    const activeIds = new Set(activeLines.map((order) => order.id));

    for (const [id, tracked] of orderLinesRef.current) {

      if (!activeIds.has(id)) {

        series.removePriceLine(tracked.line);

        orderLinesRef.current.delete(id);

      }

    }

    const isDark = resolvedTheme === "dark";

    for (const order of activeLines) {

      const signature = `${order.type}:${order.side}:${order.price}:${isDark}`;

      const existing = orderLinesRef.current.get(order.id);

      if (existing?.signature === signature) continue;

      if (existing) series.removePriceLine(existing.line);

      const color =

        order.type === "ENTRY_ACTIVE"
          ? isDark ? "#60a5fa" : "#2563eb"
          : order.type === "STOP_OPEN"
          ? isDark ? "#ef4444" : "#dc2626"

          : order.type === "TAKE_PROFIT_OPEN"

            ? isDark ? "#22c55e" : "#16a34a"

            : order.side === "BUY"

              ? isDark ? "#22c55e" : "#16a34a"

              : isDark ? "#ef4444" : "#dc2626";

      const line = series.createPriceLine({

        price: order.price,

        color,

        lineWidth: 2,

        lineStyle: order.type === "ENTRY_ACTIVE"
          ? LineStyle.Solid
          : order.type === "STOP_OPEN"
            ? LineStyle.Dotted
            : LineStyle.Dashed,

        axisLabelVisible: true,

        title: order.type === "ENTRY_ACTIVE"
          ? "ENTRY"
          : order.type === "STOP_OPEN"
            ? "STOP LOSS"
            : order.type === "TAKE_PROFIT_OPEN"
              ? "TAKE PROFIT"
              : `LIMIT ${order.side}`,

      });

      orderLinesRef.current.set(order.id, { line, signature });

    }

    const intervalSeconds = INTERVAL_SECONDS[currentInterval] ?? 3600;

    const markers: SeriesMarker<Time>[] = pairOrders

      .filter(

        (order) =>

          showPreviousTrades &&

          order.type === "FILLED" &&

          order.time !== undefined &&

          Number.isFinite(order.time) &&

          Number.isFinite(order.price) &&

          order.price > 0,

      )

      .map((order): SeriesMarker<Time> | null => {

        const candleTime = findMarkerCandleTime(

          order.time!,

          candleTimesRef.current,

          intervalSeconds,

        );

        if (candleTime === null) return null;

        const visiblePrice = order.price.toFixed(pricePrecision);

        return {

          time: candleTime,

          position: order.side === "BUY" ? "belowBar" : "aboveBar",

          color: order.side === "BUY" ? "#22c55e" : "#ef4444",

          shape: order.side === "BUY" ? "arrowUp" : "arrowDown",

          // A marker anchors to a candle, not to an arbitrary execution price.

          // The price label makes the actual fill price identifiable.

          text: `${order.side} @ ${visiblePrice}`,

        };

      })

      .filter((marker): marker is SeriesMarker<Time> => marker !== null)

      .sort((a, b) => Number(a.time) - Number(b.time));

    // setMarkers([]) intentionally clears indicators from a prior order state.

    markerPlugin.setMarkers(markers);

  }, [orders, candles, mounted, resolvedTheme, pricePrecision, symbol, currentInterval, candleVersion, showPreviousTrades]);

  // Maintain a single live/last-price line.

  useEffect(() => {

    const series = candlestickSeriesRef.current;

    if (!series) return;

    if (priceLineRef.current) {

      series.removePriceLine(priceLineRef.current);

      priceLineRef.current = null;

    }

    const lastCandle = candles[candles.length - 1];

    if (!lastCandle) return;

    const isLive = connectionStatus === "live" && livePrice !== null;

    const price = isLive ? Number(livePrice) : Number(lastCandle.close);

    const candleOpen = Number(lastCandle.open);

    if (!Number.isFinite(price) || !Number.isFinite(candleOpen)) return;

    const isDark = resolvedTheme === "dark";

    const upColor = isDark ? "#22c55e" : "#16a34a";

    const downColor = isDark ? "#ef4444" : "#dc2626";

    priceLineRef.current = series.createPriceLine({

      price,

      color: price >= candleOpen ? upColor : downColor,

      lineWidth: 1,

      lineStyle: LineStyle.Dashed,

      axisLabelVisible: true,

      title: isLive ? "Live" : connectionStatus === "stale" ? "Stale" : "Last",

    });

  }, [livePrice, connectionStatus, candles, mounted, resolvedTheme, pricePrecision, symbol, currentInterval]);

  return (

    <div className="min-w-0 space-y-4">

      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">

        <div className="flex max-w-full flex-wrap items-center gap-2">

          {INTERVALS.map((interval) => (

            <button

              key={interval.value}

              type="button"

              onClick={() => handleIntervalChange(interval.value)}

              className={cn(

                "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",

                currentInterval === interval.value

                  ? "bg-primary text-primary-foreground"

                  : "bg-muted text-text-secondary hover:bg-muted-hover",

              )}

            >

              {interval.label}

            </button>

          ))}

        </div>

        <button
          type="button"
          role="switch"
          aria-checked={showPreviousTrades}
          aria-label="Show previous trades on chart"
          onClick={togglePreviousTrades}
          title="Show or hide past BUY and SELL markers. Active orders, TP and SL remain visible."
          className="inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span>Previous trades</span>
          <span
            aria-hidden="true"
            className={cn(
              "relative inline-flex h-5 w-9 rounded-full transition-colors",
              showPreviousTrades ? "bg-primary" : "bg-muted-hover",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                showPreviousTrades ? "translate-x-[18px]" : "translate-x-0.5",
              )}
            />
          </span>
          <span className="text-xs font-semibold">{showPreviousTrades ? "On" : "Off"}</span>
        </button>

      </div>

      <div className="relative min-w-0">

        <div

          ref={chartContainerRef}

          className="h-[600px] w-full min-w-0 rounded-lg border bg-surface"

        />

        {candles.length === 0 && (

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">

            <p className="text-text-tertiary">No chart data available</p>

          </div>

        )}

      </div>

      {mounted && (

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-tertiary">

          <span>{isConnected ? "● Live" : "○ Disconnected"}</span>

          <span>{candles.length} candles loaded</span>

        </div>

      )}

    </div>

  );

}
