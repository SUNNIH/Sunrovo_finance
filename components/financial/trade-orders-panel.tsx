"use client";

import * as React from "react";
import { Loader2, X, Clock, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utilities/cn";

export interface OpenOrderView {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: string;
  quantity: string;
  limitPrice: string | null;
  createdAt: string;
}

export interface OrderHistoryView {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: string;
  quantity: string;
  filledPrice: string | null;
  feeAmount: string;
  filledAt: string | null;
}

interface TradeOrdersPanelProps {
  openOrders: OpenOrderView[];
  orderHistory: OrderHistoryView[];
  cancellingOrderId: string | null;
  onCancelOrder: (orderId: string) => Promise<void>;
}

export function TradeOrdersPanel({
  openOrders,
  orderHistory,
  cancellingOrderId,
  onCancelOrder,
}: TradeOrdersPanelProps) {
  const [activeTab, setActiveTab] = React.useState<"open" | "history">("open");

  return (
    <Card className="rounded-xl border-border bg-surface shadow-xs">
      <CardContent className="p-4 sm:p-5">
        {/* Tab Headers */}
        <div
          role="tablist"
          aria-label="Order views"
          className="mb-4 flex items-center gap-6 border-b border-border text-sm"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "open"}
            onClick={() => setActiveTab("open")}
            className={cn(
              "touch-target flex items-center gap-2 pb-2.5 font-semibold transition-colors cursor-pointer border-b-2 -mb-px",
              activeTab === "open"
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            <span>Open Orders</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-mono",
                activeTab === "open"
                  ? "bg-primary-soft text-primary"
                  : "bg-surface-elevated text-text-tertiary"
              )}
            >
              {openOrders.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            className={cn(
              "touch-target flex items-center gap-2 pb-2.5 font-semibold transition-colors cursor-pointer border-b-2 -mb-px",
              activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            <span>Order History</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-mono",
                activeTab === "history"
                  ? "bg-primary-soft text-primary"
                  : "bg-surface-elevated text-text-tertiary"
              )}
            >
              {orderHistory.length}
            </span>
          </button>
        </div>

        {/* ── Open Orders Tab ──────────────────────────────────────────────── */}
        {activeTab === "open" && (
          <div>
            {openOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Clock className="h-8 w-8 text-text-tertiary/60 mb-2" aria-hidden="true" />
                <p className="text-sm font-medium text-text-secondary">No open orders</p>
                <p className="text-xs text-text-tertiary mt-1 max-w-xs">
                  Limit orders will appear here until filled or cancelled.
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {openOrders.map((order) => {
                  const isCancelling = cancellingOrderId === order.id;

                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between py-3 text-xs sm:text-sm hover:bg-surface-hover/40 transition-colors px-1 rounded-sm"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={order.side === "BUY" ? "success" : "danger"}
                            className="px-1.5 py-0.2 text-[10px] font-bold uppercase"
                          >
                            {order.side}
                          </Badge>
                          <span className="font-semibold text-text-primary">
                            {order.symbol}
                          </span>
                          <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium text-text-tertiary">
                            {order.type}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 text-xs text-text-secondary">
                          <span>
                            Qty:{" "}
                            <strong className="font-mono financial-value text-text-primary font-normal">
                              {order.quantity}
                            </strong>
                          </span>
                          <span>
                            Price:{" "}
                            <strong className="font-mono financial-value text-text-primary font-normal">
                              {order.limitPrice ?? "—"}
                            </strong>
                          </span>
                          <span className="text-text-tertiary">
                            {new Date(order.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onCancelOrder(order.id)}
                        disabled={isCancelling || cancellingOrderId !== null}
                        aria-label={`Cancel ${order.side} order for ${order.quantity} ${order.symbol}`}
                        className="touch-target inline-flex items-center justify-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-danger hover:border-danger/30 hover:bg-danger-soft transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isCancelling ? (
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Cancelling...</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Cancel</span>
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Order History Tab ────────────────────────────────────────────── */}
        {activeTab === "history" && (
          <div>
            {orderHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CheckCircle2 className="h-8 w-8 text-text-tertiary/60 mb-2" aria-hidden="true" />
                <p className="text-sm font-medium text-text-secondary">No filled orders yet</p>
                <p className="text-xs text-text-tertiary mt-1 max-w-xs">
                  Your filled market and limit orders will appear here.
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {orderHistory.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between py-3 text-xs sm:text-sm hover:bg-surface-hover/40 transition-colors px-1 rounded-sm"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={order.side === "BUY" ? "success" : "danger"}
                          className="px-1.5 py-0.2 text-[10px] font-bold uppercase"
                        >
                          {order.side}
                        </Badge>
                        <span className="font-semibold text-text-primary">
                          {order.symbol}
                        </span>
                        <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium text-text-tertiary">
                          {order.type}
                        </span>
                        <Badge variant="neutral" className="text-[10px]">
                          Filled
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 text-xs text-text-secondary">
                        <span>
                          Qty:{" "}
                          <strong className="font-mono financial-value text-text-primary font-normal">
                            {order.quantity}
                          </strong>
                        </span>
                        <span>
                          Filled:{" "}
                          <strong className="font-mono financial-value text-text-primary font-normal">
                            {order.filledPrice ?? "—"}
                          </strong>
                        </span>
                        <span>
                          Fee:{" "}
                          <strong className="font-mono financial-value text-text-tertiary font-normal">
                            {order.feeAmount}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <span className="text-xs text-text-tertiary font-mono">
                      {order.filledAt
                        ? new Date(order.filledAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
