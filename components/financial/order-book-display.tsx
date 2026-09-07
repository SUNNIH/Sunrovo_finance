import type { OrderBookSnapshot } from "@/lib/bybit/types";

interface OrderBookDisplayProps {
  orderBook: OrderBookSnapshot;
  pricePrecision: number;
  quantityPrecision: number;
}

export function OrderBookDisplay({ orderBook, pricePrecision, quantityPrecision }: OrderBookDisplayProps) {
  const maxQty = Math.max(
    ...orderBook.bids.map((b) => Number(b.quantity)),
    ...orderBook.asks.map((a) => Number(a.quantity)),
    1
  );

  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <div className="mb-1 flex justify-between text-label uppercase text-text-tertiary">
          <span>Bid</span>
          <span>Qty</span>
        </div>
        <div className="flex flex-col-reverse gap-0.5">
          {orderBook.bids.slice(0, 10).map((level) => (
            <div key={level.price} className="relative flex justify-between px-1 py-0.5">
              <div
                className="absolute inset-y-0 right-0 bg-success-soft"
                style={{ width: `${(Number(level.quantity) / maxQty) * 100}%` }}
                aria-hidden="true"
              />
              <span className="financial-value relative text-success">{Number(level.price).toFixed(pricePrecision)}</span>
              <span className="financial-value relative text-text-secondary">
                {Number(level.quantity).toFixed(quantityPrecision)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 flex justify-between text-label uppercase text-text-tertiary">
          <span>Ask</span>
          <span>Qty</span>
        </div>
        <div className="flex flex-col gap-0.5">
          {orderBook.asks.slice(0, 10).map((level) => (
            <div key={level.price} className="relative flex justify-between px-1 py-0.5">
              <div
                className="absolute inset-y-0 right-0 bg-danger-soft"
                style={{ width: `${(Number(level.quantity) / maxQty) * 100}%` }}
                aria-hidden="true"
              />
              <span className="financial-value relative text-danger">{Number(level.price).toFixed(pricePrecision)}</span>
              <span className="financial-value relative text-text-secondary">
                {Number(level.quantity).toFixed(quantityPrecision)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {orderBook.isStale && (
        <p className="col-span-2 text-body-sm text-text-tertiary">
          Market data temporarily delayed — showing the most recent cached prices.
        </p>
      )}
    </div>
  );
}
