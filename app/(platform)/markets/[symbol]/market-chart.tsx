"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
} from "lightweight-charts";
import type { CandlestickInterval } from "@/lib/market/types";
import { cn } from "@/lib/utilities/cn";
import { useBybitWebSocket } from "./use-bybit-websocket";

const INTERVALS: { value: CandlestickInterval; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
  { value: "4h", label: "4h" },
  { value: "1d", label: "1d" },
];

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

export function MarketChart({
  symbol,
  candles,
  currentInterval,
  pricePrecision,
  liveTicker,
}: {
  symbol: string;
  candles: ChartCandle[];
  currentInterval: string;
  pricePrecision: number;
  liveTicker?: LiveTicker;
}) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLineRef = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]> | null>(null);
  const [mounted, setMounted] = useState(false);
  const [livePrice, setLivePrice] = useState<string | null>(
    liveTicker?.lastPrice || null
  );
  const [connectionStatus, setConnectionStatus] = useState<
    "live" | "stale" | "unavailable"
  >(liveTicker?.status || "unavailable");

  // WebSocket connection for real-time updates
  const { isConnected } = useBybitWebSocket({
    symbol,
    interval: currentInterval,
    enabled: mounted,
    onTickerUpdate: useCallback((data: { lastPrice: string }) => {
      setLivePrice(data.lastPrice);
      setConnectionStatus("live");
    }, []),
    onKlineUpdate: useCallback(
      (data: {
        start: number;
        open: string;
        high: string;
        low: string;
        close: string;
      }) => {
        if (!candlestickSeriesRef.current) return;

        const candleData: CandlestickData = {
          time: Math.floor(data.start / 1000) as CandlestickData["time"],
          open: parseFloat(data.open),
          high: parseFloat(data.high),
          low: parseFloat(data.low),
          close: parseFloat(data.close),
        };

        // Update the chart with new candle data
        candlestickSeriesRef.current.update(candleData);
      },
      []
    ),
  });

  const handleIntervalChange = (interval: CandlestickInterval) => {
    router.push(`/markets/${symbol}?interval=${interval}`);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !chartContainerRef.current || candles.length === 0) {
      return;
    }

    const isDark = resolvedTheme === "dark";

    // Theme colors matching Sunrovo design system
    // Use surface colors, not pure black/white
    const colors = {
      background: isDark ? "#171717" : "#fafaf9", // neutral-900 : stone-50
      surface: isDark ? "#262626" : "#f5f5f4", // neutral-800 : stone-100
      text: isDark ? "#e5e5e5" : "#1c1917", // neutral-200 : stone-900
      textSecondary: isDark ? "#a3a3a3" : "#78716c", // neutral-400 : stone-500
      grid: isDark ? "#404040" : "#e7e5e4", // neutral-700 : stone-200
      upColor: isDark ? "#22c55e" : "#16a34a", // green-500 : green-600
      downColor: isDark ? "#ef4444" : "#dc2626", // red-500 : red-600
      borderColor: isDark ? "#404040" : "#d6d3d1", // neutral-700 : stone-300
      wickUpColor: isDark ? "#22c55e" : "#16a34a",
      wickDownColor: isDark ? "#ef4444" : "#dc2626",
      volumeUp: isDark ? "#22c55e40" : "#16a34a40", // 25% opacity
      volumeDown: isDark ? "#ef444440" : "#dc262640",
    };

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
        fontSize: 12,
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: colors.textSecondary,
          width: 1,
          style: 3,
          labelBackgroundColor: colors.textSecondary,
        },
        horzLine: {
          color: colors.textSecondary,
          width: 1,
          style: 3,
          labelBackgroundColor: colors.textSecondary,
        },
      },
      grid: {
        vertLines: {
          color: colors.grid,
          style: 1,
        },
        horzLines: {
          color: colors.grid,
          style: 1,
        },
      },
      rightPriceScale: {
        borderColor: colors.borderColor,
        textColor: colors.text,
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: colors.borderColor,
        timeVisible: true,
        secondsVisible: false,
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

    // Add candlestick series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: colors.upColor,
      downColor: colors.downColor,
      borderUpColor: colors.upColor,
      borderDownColor: colors.downColor,
      wickUpColor: colors.wickUpColor,
      wickDownColor: colors.wickDownColor,
      lastValueVisible: false,
  priceLineVisible: false,
      priceFormat: {
        type: "price" as const,
        precision: pricePrecision,
        minMove: Math.pow(10, -pricePrecision),
      },
    });

    candlestickSeriesRef.current = candlestickSeries;

    // Add volume series with improved spacing
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: colors.textSecondary,
      priceFormat: {
        type: "volume" as const,
      },
      priceScaleId: "", // Empty string = overlay, doesn't create separate axis
      lastValueVisible: false, // Hide confusing volume price labels
      priceLineVisible: false,
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.85, // Push volume to bottom 15% of chart
        bottom: 0,
      },
    });

    // Convert and set data
    const candlestickData: CandlestickData[] = candles.map((candle) => ({
      time: Math.floor(new Date(candle.openTime).getTime() / 1000) as CandlestickData["time"],
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
    }));

    const volumeData: HistogramData[] = candles.map((candle) => {
      const open = parseFloat(candle.open);
      const close = parseFloat(candle.close);
      return {
        time: Math.floor(new Date(candle.openTime).getTime() / 1000) as HistogramData["time"],
        value: parseFloat(candle.volume),
        color: close >= open ? colors.volumeUp : colors.volumeDown,
      };
    });

    candlestickSeries.setData(candlestickData);
    volumeSeries.setData(volumeData);

    // Fit content
    chart.timeScale().fitContent();

    chartRef.current = chart;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      if (priceLineRef.current && candlestickSeriesRef.current) {
        candlestickSeriesRef.current.removePriceLine(priceLineRef.current);
        priceLineRef.current = null;
      }
      if (chart) {
        chart.remove();
      }
      candlestickSeriesRef.current = null;
    };
  }, [candles, mounted, resolvedTheme, pricePrecision, symbol]);

  // Update price marker when live price changes
  useEffect(() => {
    if (!candlestickSeriesRef.current || !mounted) return;

    const candlestickSeries = candlestickSeriesRef.current;
    const isDark = resolvedTheme === "dark";
    const colors = {
      upColor: isDark ? "#22c55e" : "#16a34a",
      downColor: isDark ? "#ef4444" : "#dc2626",
    };

    // Remove old price line if exists
    if (priceLineRef.current) {
      candlestickSeries.removePriceLine(priceLineRef.current);
      priceLineRef.current = null;
    }

    // Add new price line with live or last price
    if (livePrice && connectionStatus === "live") {
      const price = parseFloat(livePrice);
      const lastCandle = candles[candles.length - 1];
      
      if (lastCandle) {
        const lastOpen = parseFloat(lastCandle.open);
        const isUp = price >= lastOpen;
        
        priceLineRef.current = candlestickSeries.createPriceLine({
          price: price,
          color: isUp ? colors.upColor : colors.downColor,
          lineWidth: 1,
          lineStyle: 2, // dashed
          axisLabelVisible: true,
          title: "Live",
        });
      }
    } else if (candles.length > 0) {
      // Fallback to last candle close
      const lastCandle = candles[candles.length - 1];
      if (lastCandle) {
        const close = parseFloat(lastCandle.close);
        const open = parseFloat(lastCandle.open);
        const isUp = close >= open;
        
        priceLineRef.current = candlestickSeries.createPriceLine({
          price: close,
          color: isUp ? colors.upColor : colors.downColor,
          lineWidth: 1,
          lineStyle: 2, // dashed
          axisLabelVisible: true,
          title: connectionStatus === "stale" ? "Stale" : "Last",
        });
      }
    }
  }, [livePrice, connectionStatus, candles, mounted, resolvedTheme]);

  if (candles.length === 0) {
    return (
      <div className="space-y-4">
        {/* Interval Selector */}
        <div className="flex flex-wrap gap-2">
          {INTERVALS.map((interval) => (
            <button
              key={interval.value}
              type="button"
              onClick={() => handleIntervalChange(interval.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                currentInterval === interval.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-elevated text-text-secondary hover:bg-surface-hover"
              )}
            >
              {interval.label}
            </button>
          ))}
        </div>

        <div className="flex h-[500px] items-center justify-center rounded-lg bg-surface">
          <p className="text-sm text-text-tertiary">Chart data unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Interval Selector */}
      <div className="flex flex-wrap gap-2">
        {INTERVALS.map((interval) => (
          <button
            key={interval.value}
            type="button"
            onClick={() => handleIntervalChange(interval.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              currentInterval === interval.value
                ? "bg-primary text-primary-foreground"
                : "bg-surface-elevated text-text-secondary hover:bg-surface-hover"
            )}
          >
            {interval.label}
          </button>
        ))}
      </div>

      {/* Professional Trading Chart */}
      <div
        ref={chartContainerRef}
        className="rounded-lg bg-surface overflow-hidden"
        style={{ minHeight: "500px" }}
      />

      <p className="text-center text-xs text-text-tertiary">
        {candles.length} candles • Interactive chart with zoom/pan
        {isConnected && (
          <span className="ml-2 inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="text-success">Live</span>
          </span>
        )}
        {!isConnected && connectionStatus === "stale" && (
          <span className="ml-2 text-warning">• Reconnecting...</span>
        )}
      </p>
    </div>
  );
}