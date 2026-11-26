"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cancelTradeOrderAction } from "./actions";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

interface SerializedOrder {
  id: string;
  userId: string;
  symbol: string;
  side: string;
  type: string;
  quantity: string;
  limitPrice: string | null;
  stopPrice?: string | null;
  filledPrice: string | null;
  feeAmount: string | null;
  status: string;
  idempotencyKey: string;
  ledgerGroupId: string | null;
  createdAt: string;
  filledAt: string | null;
  cancelledAt: string | null;
}

interface OrdersClientProps {
  orders: SerializedOrder[];
  isOpenOrders?: boolean;
  onOrderCancel?: () => void;
}

export function OrdersClient({
  orders,
  isOpenOrders = false,
  onOrderCancel,
}: OrdersClientProps) {
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleCancelOrder = async (orderId: string) => {
    setCancellingOrderId(orderId);

    try {
      const result = await cancelTradeOrderAction(orderId);

      if (result.success) {
        setToastMessage("✓ Order cancelled successfully");
        // Notify parent to refresh data
        if (onOrderCancel) {
          onOrderCancel();
        }
      } else {
        setToastMessage(`✗ Cancellation failed: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error cancelling order:", error);
      setToastMessage("✗ An unexpected error occurred");
    } finally {
      setCancellingOrderId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.toLocaleString("default", { month: "short" });
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${month} ${day}, ${hours}:${minutes}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Badge variant="warning">Open</Badge>;
      case "FILLED":
        return <Badge variant="success">Filled</Badge>;
      case "CANCELLED":
        return <Badge variant="neutral">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getSideBadge = (side: string) => {
    return side === "BUY" ? (
      <Badge className="bg-green-600 dark:bg-green-700">Buy</Badge>
    ) : (
      <Badge className="bg-red-600 dark:bg-red-700">Sell</Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Toast message */}
      {toastMessage && (
        <div className="p-3 bg-muted rounded-md text-sm border">
          {toastMessage}
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-muted-foreground hover:text-text-primary"
          >
            ×
          </button>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr className="text-left text-text-tertiary">
              <th className="pb-3 font-medium">Market</th>
              <th className="pb-3 font-medium">Side</th>
              <th className="pb-3 font-medium">Type</th>
              <th className="pb-3 font-medium">Quantity</th>
              <th className="pb-3 font-medium">Price</th>
              <th className="pb-3 font-medium">Fee</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium">Date</th>
              {isOpenOrders && <th className="pb-3 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b last:border-0">
                <td className="py-3">
                  <Link
                    href={`/markets/${order.symbol}`}
                    className="text-primary hover:text-primary-hover inline-flex items-center gap-1"
                  >
                    {order.symbol}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </td>
                <td className="py-3">{getSideBadge(order.side)}</td>
                <td className="py-3">{order.type}</td>
                <td className="py-3 tabular-nums">
                  {parseFloat(order.quantity).toFixed(6)}
                </td>
                <td className="py-3 tabular-nums">
                  {order.filledPrice
                    ? parseFloat(order.filledPrice).toFixed(2)
                    : order.limitPrice
                    ? parseFloat(order.limitPrice).toFixed(2)
                    : order.stopPrice
                    ? parseFloat(order.stopPrice).toFixed(2)
                    : "—"}
                </td>
                <td className="py-3 tabular-nums">
                  {order.feeAmount ? parseFloat(order.feeAmount).toFixed(6) : "—"}
                </td>
                <td className="py-3">{getStatusBadge(order.status)}</td>
                <td className="py-3 text-text-tertiary">
                  {formatDate(order.createdAt)}
                </td>
                {isOpenOrders && (
                  <td className="py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancelOrder(order.id)}
                      disabled={cancellingOrderId === order.id}
                    >
                      {cancellingOrderId === order.id ? "Cancelling..." : "Cancel"}
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <Link
                  href={`/markets/${order.symbol}`}
                  className="font-medium text-primary hover:text-primary-hover inline-flex items-center gap-1"
                >
                  {order.symbol}
                  <ExternalLink className="h-3 w-3" />
                </Link>
                <div className="flex items-center gap-2 mt-1">
                  {getSideBadge(order.side)}
                  <span className="text-xs text-text-tertiary">{order.type}</span>
                </div>
              </div>
              <div>{getStatusBadge(order.status)}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-text-tertiary">Quantity</p>
                <p className="font-medium tabular-nums">
                  {parseFloat(order.quantity).toFixed(6)}
                </p>
              </div>
              <div>
                <p className="text-text-tertiary">Price</p>
                <p className="font-medium tabular-nums">
                  {order.filledPrice
                    ? parseFloat(order.filledPrice).toFixed(2)
                    : order.limitPrice
                    ? parseFloat(order.limitPrice).toFixed(2)
                    : order.stopPrice
                    ? parseFloat(order.stopPrice).toFixed(2)
                    : "—"}
                </p>
              </div>
              {order.feeAmount && (
                <div>
                  <p className="text-text-tertiary">Fee</p>
                  <p className="font-medium tabular-nums">
                    {parseFloat(order.feeAmount).toFixed(6)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-text-tertiary">Date</p>
                <p className="font-medium">{formatDate(order.createdAt)}</p>
              </div>
            </div>

            {isOpenOrders && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => handleCancelOrder(order.id)}
                disabled={cancellingOrderId === order.id}
              >
                {cancellingOrderId === order.id
                  ? "Cancelling..."
                  : "Cancel Order"}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
