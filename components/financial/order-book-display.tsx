import type { OrderBookSnapshot } from "@/lib/bybit/types";

interface OrderBookDisplayProps {
  orderBook: OrderBookSnapshot;
  pricePrecision: number;
  quantityPrecision: number;
}

/**
 * High-density presentation of order book depth with presentation-only spread calculation.
 * Note: Spread calculation is purely for visual market depth inspection and is NEVER used for
 * execution, fee estimation, or ledger postings.
 */
export function OrderBookDisplay({
  orderBook,
  pricePrecision,
  quantityPrecision,
}: OrderBookDisplayProps) {
  const maxQty = Math.max(
    ...orderBook.bids.map((b) => Number(b.quantity)),
    ...orderBook.asks.map((a) => Number(a.quantity)),
    1
  );

  // Presentation-only spread derivation: best ask - best bid
  const bestBid = orderBook.bids[0] ? Number(orderBook.bids[0].price) : null;
  const bestAsk = orderBook.asks[0] ? Number(orderBook.asks[0].price) : null;
  const spreadValue = bestBid !== null && bestAsk !== null && bestAsk >= bestBid ? bestAsk - bestBid : null;
  const spreadPercent = spreadValue !== null && bestAsk !== null && bestAsk > 0 ? (spreadValue / bestAsk) * 100 : null;

  return (
    <div className="flex flex-col gap-2 text-sm">
      {/* Presentation-only Spread Banner */}
      {spreadValue !== null && (
        <div className="flex items-center justify-between rounded-md bg-surface px-3 py-1.5 text-xs text-text-secondary border border-border">
          <span className="text-text-tertiary">Market Spread</span>
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium text-text-primary financial-value">
              {spreadValue.toFixed(pricePrecision)}
            </span>
            {spreadPercent !== null && (
              <span className="text-text-tertiary financial-value">
                ({spreadPercent.toFixed(2)}%)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Dual Column Bids and Asks */}
      <div className="grid grid-cols-2 gap-3">
        {/* Bids Column */}
        <div className="flex flex-col">
          <div className="mb-1.5 flex justify-between px-1 text-label uppercase text-text-tertiary">
            <span>Bid Price</span>
            <span>Quantity</span>
          </div>
          <div className="flex flex-col-reverse gap-0.5">
            {orderBook.bids.slice(0, 10).map((level) => (
              <div
                key={level.price}
                className="relative flex justify-between px-1.5 py-1 text-xs transition-colors hover:bg-surface-hover/70 rounded-xs"
              >
                <div
                  className="absolute inset-y-0 right-0 bg-success-soft/70 rounded-xs"
                  style={{ width: `${(Number(level.quantity) / maxQty) * 100}%` }}
                  aria-hidden="true"
                />
                <span className="financial-value relative font-medium text-success">
                  {Number(level.price).toFixed(pricePrecision)}
                </span>
                <span className="financial-value relative text-text-secondary">
                  {Number(level.quantity).toFixed(quantityPrecision)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Asks Column */}
        <div className="flex flex-col">
          <div className="mb-1.5 flex justify-between px-1 text-label uppercase text-text-tertiary">
            <span>Ask Price</span>
            <span>Quantity</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {orderBook.asks.slice(0, 10).map((level) => (
              <div
                key={level.price}
                className="relative flex justify-between px-1.5 py-1 text-xs transition-colors hover:bg-surface-hover/70 rounded-xs"
              >
                <div
                  className="absolute inset-y-0 right-0 bg-danger-soft/70 rounded-xs"
                  style={{ width: `${(Number(level.quantity) / maxQty) * 100}%` }}
                  aria-hidden="true"
                />
                <span className="financial-value relative font-medium text-danger">
                  {Number(level.price).toFixed(pricePrecision)}
                </span>
                <span className="financial-value relative text-text-secondary">
                  {Number(level.quantity).toFixed(quantityPrecision)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {orderBook.isStale && (
        <p className="text-body-sm text-text-tertiary text-center pt-1">
          Market depth temporarily using cached snapshot.
        </p>
      )}
    </div>
  );
}
