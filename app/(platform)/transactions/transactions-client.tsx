"use client";

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, Download, Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TransactionStatusBadge } from "@/components/financial/transaction-status-badge";
import { TRANSACTION_TYPES, TRANSACTION_STATUSES } from "@/lib/validation/banking";
import { cn } from "@/lib/utilities/cn";
import { SkeletonTable } from "@/components/ui/skeleton";

interface TransactionView {
  id: string;
  type: string;
  direction: "CREDIT" | "DEBIT";
  status: string;
  assetSymbol: string;
  amount: string;
  feeAmount: string;
  counterparty: string | null;
  narration: string | null;
  isDemo: boolean;
  createdAt: string;
}

interface TransactionsClientProps {
  initialItems: TransactionView[];
  initialCursor: string | null;
}

export function TransactionsClient({ initialItems, initialCursor }: TransactionsClientProps) {
  const [items, setItems] = React.useState(initialItems);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [search, setSearch] = React.useState("");
  const [type, setType] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<TransactionView | null>(null);

  function buildParams(cursorValue?: string) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    if (cursorValue) params.set("cursor", cursorValue);
    return params;
  }

  async function applyFilters() {
    setLoading(true);
    try {
      const response = await fetch(`/api/transactions?${buildParams().toString()}`);
      const payload = await response.json();
      setItems(payload.data.items);
      setCursor(payload.data.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/transactions?${buildParams(cursor).toString()}`);
      const payload = await response.json();
      setItems((prev) => [...prev, ...payload.data.items]);
      setCursor(payload.data.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      applyFilters();
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, type, status]);

  return (
    <div className="flex flex-col gap-4" aria-busy={loading}>
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="search"
              placeholder="Search narration or counterparty"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search transactions"
              className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Filter by type"
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-text-primary"
          >
            <option value="">All types</option>
            {TRANSACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-text-primary"
          >
            <option value="">All statuses</option>
            {TRANSACTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <a
            href={`/api/transactions/export?${buildParams().toString()}`}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-primary hover:bg-surface-hover"
          >
            <Download className="h-4 w-4" /> Export CSV
          </a>
        </CardContent>
      </Card>

      {loading && items.length === 0 ? (
        <SkeletonTable rows={8} columns={5} />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-text-secondary">
            No transactions yet. Your transfers, deposits and trades will appear here.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface text-left text-label uppercase text-text-tertiary">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Counterparty</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((txn) => (
                  <tr
                    key={txn.id}
                    onClick={() => setSelected(txn)}
                    className="cursor-pointer transition-colors duration-150 hover:bg-surface-hover"
                  >
                    <td className="px-4 py-3 text-text-secondary">
                      {new Date(txn.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-text-primary">{txn.type}</td>
                    <td className="px-4 py-3 text-text-primary">{txn.counterparty ?? "—"}</td>
                    <td className="px-4 py-3">
                      <TransactionStatusBadge status={txn.status} />
                    </td>
                    <td
                      className={cn(
                        "financial-value px-4 py-3 text-right font-medium",
                        txn.direction === "CREDIT" ? "text-success" : "text-text-primary"
                      )}
                    >
                      {txn.direction === "CREDIT" ? "+" : "−"}
                      {txn.amount} {txn.assetSymbol}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {items.map((txn) => (
              <Card
                key={txn.id}
                onClick={() => setSelected(txn)}
                className="cursor-pointer hover:border-border-strong hover:shadow-md"
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      txn.direction === "CREDIT" ? "bg-success-soft text-success" : "bg-surface-hover text-text-secondary"
                    )}
                  >
                    {txn.direction === "CREDIT" ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {txn.counterparty ?? txn.type}
                    </p>
                    <p className="text-body-sm text-text-secondary">
                      {new Date(txn.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "financial-value text-sm font-medium",
                      txn.direction === "CREDIT" ? "text-success" : "text-text-primary"
                    )}
                  >
                    {txn.direction === "CREDIT" ? "+" : "−"}
                    {txn.amount}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>

          {cursor && (
            <Button variant="outline" onClick={loadMore} disabled={loading} className="mx-auto w-fit">
              {loading ? "Loading..." : "Load more"}
            </Button>
          )}
        </>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelected(null)}
          />
          <div className="relative flex h-full w-full max-w-sm flex-col bg-surface-elevated p-5 shadow-xl animate-slide-up safe-area-top safe-area-bottom">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-section-title text-text-primary">Transaction details</h2>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="touch-target inline-flex items-center justify-center rounded-md text-text-secondary hover:bg-surface-hover"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col divide-y divide-border">
              {[
                ["Type", selected.type],
                ["Status", <TransactionStatusBadge key="s" status={selected.status} />],
                ["Amount", `${selected.direction === "CREDIT" ? "+" : "−"}${selected.amount} ${selected.assetSymbol}`],
                ["Fee", `${selected.feeAmount} ${selected.assetSymbol}`],
                ["Counterparty", selected.counterparty ?? "—"],
                ["Narration", selected.narration ?? "—"],
                ["Date", new Date(selected.createdAt).toLocaleString()],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-text-secondary">{label}</span>
                  <span className="financial-value font-medium text-text-primary">{value}</span>
                </div>
              ))}
            </div>
            {selected.isDemo && (
              <p className="mt-4 text-body-sm text-text-tertiary">
                This is a demo transaction. No real funds were involved.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
