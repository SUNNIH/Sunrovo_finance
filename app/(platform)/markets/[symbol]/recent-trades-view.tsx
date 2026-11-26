"use client";

import { Decimal } from "decimal.js";
import { cn } from "@/lib/utilities/cn";

export function RecentTradesView({
  trades,
  pricePrecision,
  quantityPrecision,
}: {
  trades: {
    id: string;
    price: string;
    quantity: string;
    side: "buy" | "sell";
    timestamp: string;
  }[];
  pricePrecision: number;
  quantityPrecision: number;
}) {
  const displayTrades = trades.slice(0, 20);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-medium text-text-tertiary px-2">
        <span>Price</span>
        <span>Amount</span>
        <span>Time</span>
      </div>
      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {displayTrades.map((trade) => {
          const time = new Date(trade.timestamp);
          const timeStr = time.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });

          return (
            <div key={trade.id} className="flex justify-between text-sm px-2 py-1 hover:bg-surface-hover rounded">
              <span
                className={cn(
                  "tabular-nums",
                  trade.side === "buy" ? "text-success" : "text-danger"
                )}
              >
                {new Decimal(trade.price).toFixed(pricePrecision)}
              </span>
              <span className="text-text-tertiary tabular-nums">
                {new Decimal(trade.quantity).toFixed(quantityPrecision)}
              </span>
              <span className="text-text-tertiary text-xs">
                {timeStr}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
