"use client";

import * as React from "react";
import type { Candle } from "@/lib/bybit/types";
import { cn } from "@/lib/utilities/cn";

interface CandlestickChartProps {
  candles: Candle[];
  height?: number;
}

/**
 * A hand-rolled SVG candlestick chart with crosshair inspection and
 * accessible screen-reader summary. Uses strictly the provided Candle data.
 */
export function CandlestickChart({ candles, height = 340 }: CandlestickChartProps) {
  const width = 800;
  const padding = { top: 28, right: 12, bottom: 24, left: 60 };
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  if (candles.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashed border-border bg-surface text-sm text-text-secondary">
        No chart data available for this timeframe.
      </div>
    );
  }

  const highs = candles.map((c) => Number(c.high));
  const lows = candles.map((c) => Number(c.low));
  const maxPrice = Math.max(...highs);
  const minPrice = Math.min(...lows);
  const priceRange = maxPrice - minPrice || 1;

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const candleSlot = chartWidth / candles.length;
  const candleWidth = Math.max(candleSlot * 0.65, 1.5);

  function yFor(price: number): number {
    return padding.top + ((maxPrice - price) / priceRange) * chartHeight;
  }

  // Candle to inspect: hovered candle if active, otherwise the latest candle
  const activeIndex = hoveredIndex !== null && candles[hoveredIndex] ? hoveredIndex : candles.length - 1;
  const activeCandle = candles[activeIndex]!;
  const activeOpen = Number(activeCandle.open);
  const activeClose = Number(activeCandle.close);
  const activeHigh = Number(activeCandle.high);
  const activeLow = Number(activeCandle.low);
  const activeIsUp = activeClose >= activeOpen;
  const activeChangePercent = activeOpen > 0 ? ((activeClose - activeOpen) / activeOpen) * 100 : 0;

  const first = candles[0];
  const last = candles[candles.length - 1];
  const summary =
    first && last
      ? `Price chart from ${Number(first.open).toFixed(2)} to ${Number(last.close).toFixed(2)} over ${candles.length} periods, ranging between ${minPrice.toFixed(2)} and ${maxPrice.toFixed(2)}.`
      : "Price chart.";

  const gridLines = 4;

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!svgRef.current || candles.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = width / rect.width;
    const clientXInSvg = (e.clientX - rect.left) * scaleX;
    const chartX = clientXInSvg - padding.left;
    if (chartX >= 0 && chartX <= chartWidth) {
      const idx = Math.min(Math.max(0, Math.floor(chartX / candleSlot)), candles.length - 1);
      setHoveredIndex(idx);
    }
  }

  function handlePointerLeave() {
    setHoveredIndex(null);
  }

  // Format date concisely
  const activeDate = new Date(activeCandle.openTime).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col gap-2 select-none">
      {/* Interactive OHLC Readout Bar */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md bg-surface px-3 py-1.5 text-xs text-text-secondary border border-border">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-text-tertiary">Time: <span className="font-medium text-text-primary">{activeDate}</span></span>
          <span>O: <span className="financial-value font-medium text-text-primary">{activeOpen.toFixed(2)}</span></span>
          <span>H: <span className="financial-value font-medium text-text-primary">{activeHigh.toFixed(2)}</span></span>
          <span>L: <span className="financial-value font-medium text-text-primary">{activeLow.toFixed(2)}</span></span>
          <span>C: <span className="financial-value font-medium text-text-primary">{activeClose.toFixed(2)}</span></span>
        </div>
        <div className="flex items-center gap-1.5 font-medium">
          <span className={activeIsUp ? "text-success" : "text-danger"}>
            {activeIsUp ? "+" : ""}{activeChangePercent.toFixed(2)}%
          </span>
          {hoveredIndex !== null && (
            <span className="text-[10px] text-text-tertiary">(Inspecting)</span>
          )}
        </div>
      </div>

      {/* SVG Chart Area */}
      <div className="relative overflow-hidden rounded-lg bg-surface-elevated">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full cursor-crosshair touch-none"
          role="img"
          aria-label={summary}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          {/* Horizontal Grid lines and Price Axis labels */}
          {Array.from({ length: gridLines + 1 }, (_, i) => {
            const price = minPrice + (priceRange * (gridLines - i)) / gridLines;
            const y = yFor(price);
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y}
                  y2={y}
                  className="stroke-border/70"
                  strokeWidth={1}
                />
                <text
                  x={4}
                  y={y + 4}
                  className="fill-current text-[11px] font-mono tabular-nums text-text-tertiary"
                >
                  {price.toFixed(price < 10 ? 4 : 2)}
                </text>
              </g>
            );
          })}

          {/* Vertical Time Labels along Bottom Axis */}
          {candles.length > 3 && [0, Math.floor(candles.length / 2), candles.length - 1].map((idx) => {
            const c = candles[idx]!;
            const x = padding.left + idx * candleSlot + candleSlot / 2;
            const timeLabel = new Date(c.openTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <text
                key={idx}
                x={x}
                y={height - 6}
                textAnchor="middle"
                className="fill-current text-[10px] text-text-tertiary"
              >
                {timeLabel}
              </text>
            );
          })}

          {/* Candlesticks (wicks and bodies) */}
          {candles.map((candle, i) => {
            const open = Number(candle.open);
            const close = Number(candle.close);
            const high = Number(candle.high);
            const low = Number(candle.low);
            const isUp = close >= open;
            const x = padding.left + i * candleSlot + candleSlot / 2;
            const bodyTop = yFor(Math.max(open, close));
            const bodyBottom = yFor(Math.min(open, close));
            const isCurrentHover = hoveredIndex === i;

            return (
              <g
                key={candle.openTime}
                className={cn(
                  isUp ? "text-success" : "text-danger",
                  isCurrentHover && "brightness-125"
                )}
              >
                {/* Wick */}
                <line
                  x1={x}
                  x2={x}
                  y1={yFor(high)}
                  y2={yFor(low)}
                  stroke="currentColor"
                  strokeWidth={isCurrentHover ? 1.5 : 1}
                />
                {/* Body */}
                <rect
                  x={x - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={Math.max(bodyBottom - bodyTop, 1.5)}
                  fill="currentColor"
                  rx={0.5}
                />
              </g>
            );
          })}

          {/* Crosshair Guides when Hovered */}
          {hoveredIndex !== null && (
            <g className="pointer-events-none">
              {/* Vertical line through hovered candle */}
              <line
                x1={padding.left + hoveredIndex * candleSlot + candleSlot / 2}
                x2={padding.left + hoveredIndex * candleSlot + candleSlot / 2}
                y1={padding.top}
                y2={height - padding.bottom}
                className="stroke-text-tertiary"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              {/* Horizontal line through close price */}
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={yFor(activeClose)}
                y2={yFor(activeClose)}
                className="stroke-text-tertiary"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              {/* Price marker pill on y-axis */}
              <rect
                x={0}
                y={yFor(activeClose) - 9}
                width={padding.left - 4}
                height={18}
                className="fill-surface-hover stroke-border"
                strokeWidth={1}
                rx={3}
              />
              <text
                x={4}
                y={yFor(activeClose) + 3.5}
                className="fill-current text-[10px] font-mono font-medium text-text-primary"
              >
                {activeClose.toFixed(activeClose < 10 ? 4 : 2)}
              </text>
            </g>
          )}
        </svg>
      </div>

      <p className="sr-only">{summary}</p>
    </div>
  );
}
