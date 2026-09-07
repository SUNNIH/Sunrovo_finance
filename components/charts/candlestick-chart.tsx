"use client";

import * as React from "react";
import type { Candle } from "@/lib/bybit/types";

interface CandlestickChartProps {
  candles: Candle[];
  height?: number;
}

/**
 * A hand-rolled SVG candlestick chart — deliberately not built on a
 * general-purpose charting library, since none of the ones already in
 * this stack (Recharts) have a native candlestick chart type, and
 * fighting a bar-chart API into an OHLC shape would end up more complex
 * than direct SVG here. Screen-reader users get a text summary instead
 * of trying to describe individual candles (accessibility memory:
 * "screen-reader descriptions for charts").
 */
export function CandlestickChart({ candles, height = 320 }: CandlestickChartProps) {
  const width = 800;
  const padding = { top: 16, right: 8, bottom: 8, left: 56 };

  if (candles.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-text-secondary">
        No chart data available.
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
  const candleWidth = Math.max(candleSlot * 0.6, 1);

  function yFor(price: number): number {
    return padding.top + ((maxPrice - price) / priceRange) * chartHeight;
  }

  const first = candles[0];
  const last = candles[candles.length - 1];
  const summary =
    first && last
      ? `Price chart from ${Number(first.open).toFixed(2)} to ${Number(last.close).toFixed(2)} over ${candles.length} periods, ranging between ${minPrice.toFixed(2)} and ${maxPrice.toFixed(2)}.`
      : "Price chart.";

  const gridLines = 4;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={summary}>
        {Array.from({ length: gridLines + 1 }, (_, i) => {
          const price = minPrice + (priceRange * i) / gridLines;
          const y = yFor(price);
          return (
            <g key={i}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                className="stroke-border"
                strokeWidth={1}
              />
              <text x={4} y={y + 4} className="fill-current text-text-tertiary" fontSize={10}>
                {price.toFixed(price < 10 ? 4 : 2)}
              </text>
            </g>
          );
        })}

        {candles.map((candle, i) => {
          const open = Number(candle.open);
          const close = Number(candle.close);
          const high = Number(candle.high);
          const low = Number(candle.low);
          const isUp = close >= open;
          const x = padding.left + i * candleSlot + candleSlot / 2;
          const bodyTop = yFor(Math.max(open, close));
          const bodyBottom = yFor(Math.min(open, close));

          return (
            <g key={candle.openTime} className={isUp ? "text-success" : "text-danger"}>
              <line x1={x} x2={x} y1={yFor(high)} y2={yFor(low)} stroke="currentColor" strokeWidth={1} />
              <rect
                x={x - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={Math.max(bodyBottom - bodyTop, 1)}
                fill="currentColor"
              />
            </g>
          );
        })}
      </svg>
      <p className="sr-only">{summary}</p>
    </div>
  );
}
