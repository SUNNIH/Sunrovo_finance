"use client";

import { Decimal } from "decimal.js";
import type { MarketDataStatus } from "@/lib/market/types";

export function OrderBookView({
  orderBook,
  pricePrecision,
  quantityPrecision,
}: {
  orderBook: {
    asks: { price: string; quantity: string }[];
    bids: { price: string; quantity: string }[];
    status: MarketDataStatus;
  };
  pricePrecision: number;
  quantityPrecision: number;
}) {
  // Display the 10 best asks and bids.
  // Asks are reversed for visual presentation only.
  const displayAsks = orderBook.asks.slice(0, 10).reverse();
  const displayBids = orderBook.bids.slice(0, 10);

  // Convert quantities to numbers ONLY for visual bar widths.
  // Financial values remain strings and use Decimal for formatting.
  const maxAskQty = Math.max(
    0,
    ...displayAsks.map((ask) => Number(ask.quantity))
  );

  const maxBidQty = Math.max(
    0,
    ...displayBids.map((bid) => Number(bid.quantity))
  );

  // Best prices must come from the original order book,
  // not the reversed display arrays.
  const bestAsk = orderBook.asks[0];
  const bestBid = orderBook.bids[0];

  return (
    <div className="space-y-4">
      {/* Asks (Sell Orders) */}
      <div>
        <div className="mb-2 flex justify-between px-2 text-xs font-medium text-text-tertiary">
          <span>Price</span>
          <span>Amount</span>
        </div>

        <div className="space-y-1">
          {displayAsks.map((ask, index) => {
            const qty = Number(ask.quantity);

            const widthPct =
              maxAskQty > 0
                ? Math.min(100, Math.max(0, (qty / maxAskQty) * 100))
                : 0;

            return (
              <div key={index} className="relative px-2 py-1">
                {/* Ask depth background */}
                <div
                  className="absolute bottom-0 right-0 top-0 bg-danger/10"
                  style={{ width: `${widthPct}%` }}
                />

                <div className="relative flex justify-between text-sm">
                  <span className="text-danger tabular-nums">
                    {new Decimal(ask.price).toFixed(pricePrecision)}
                  </span>

                  <span className="text-text-tertiary tabular-nums">
                    {new Decimal(ask.quantity).toFixed(
                      quantityPrecision
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Spread */}
      {bestAsk && bestBid && (
        <div className="border-y border-border py-2 text-center">
          <p className="text-xs text-text-tertiary">
            Spread
          </p>

          <p className="text-sm font-semibold text-text-primary tabular-nums">
            {new Decimal(bestAsk.price)
              .minus(new Decimal(bestBid.price))
              .toFixed(pricePrecision)}
          </p>
        </div>
      )}

      {/* Bids (Buy Orders) */}
      <div>
        <div className="space-y-1">
          {displayBids.map((bid, index) => {
            const qty = Number(bid.quantity);

            const widthPct =
              maxBidQty > 0
                ? Math.min(100, Math.max(0, (qty / maxBidQty) * 100))
                : 0;

            return (
              <div key={index} className="relative px-2 py-1">
                {/* Bid depth background */}
                <div
                  className="absolute bottom-0 right-0 top-0 bg-success/10"
                  style={{ width: `${widthPct}%` }}
                />

                <div className="relative flex justify-between text-sm">
                  <span className="text-success tabular-nums">
                    {new Decimal(bid.price).toFixed(pricePrecision)}
                  </span>

                  <span className="text-text-tertiary tabular-nums">
                    {new Decimal(bid.quantity).toFixed(
                      quantityPrecision
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stale market-data warning */}
      {orderBook.status === "stale" && (
        <p className="text-center text-xs text-warning">
          Data may be stale
        </p>
      )}
    </div>
  );
}