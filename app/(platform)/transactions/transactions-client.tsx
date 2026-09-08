"use client";

import * as React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Download,
  FilterX,
  History,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TransactionStatusBadge } from "@/components/financial/transaction-status-badge";
import {
  TransactionDetailModal,
  type TransactionView,
} from "@/components/financial/transaction-detail-modal";
import {
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
} from "@/lib/validation/banking";
import { formatMoney } from "@/lib/money/format";
import { cn } from "@/lib/utilities/cn";
import { SkeletonTable } from "@/components/ui/skeleton";

interface TransactionsClientProps {
  initialItems: TransactionView[];
  initialCursor: string | null;
}

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  TRANSFER: "Transfer",
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  TRADE: "Trade",
  CONVERSION: "Conversion",
  FEE: "Fee",
  CARD_PAYMENT: "Card Payment",
};

const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  COMPLETED: "Completed",
  FAILED: "Failed",
  REVERSED: "Reversed",
};

export function TransactionsClient({
  initialItems,
  initialCursor,
}: TransactionsClientProps) {
  const [items, setItems] = React.useState<TransactionView[]>(initialItems);
  const [cursor, setCursor] = React.useState<string | null>(initialCursor);
  const [search, setSearch] = React.useState("");
  const [type, setType] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [selected, setSelected] = React.useState<TransactionView | null>(null);

  // Track initial mount so we don't refetch on first render
  const isInitialMount = React.useRef(true);

  function buildParams(cursorValue?: string) {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    if (cursorValue) params.set("cursor", cursorValue);
    return params;
  }

  async function applyFilters() {
    setLoading(true);
    try {
      const response = await fetch(`/api/transactions?${buildParams().toString()}`);
      if (!response.ok) throw new Error("Failed to fetch transactions");
      const payload = await response.json();
      setItems(payload.data.items);
      setCursor(payload.data.nextCursor);
    } catch {
      // Preserve existing items on network error
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(
        `/api/transactions?${buildParams(cursor).toString()}`
      );
      if (!response.ok) throw new Error("Failed to fetch next transactions page");
      const payload = await response.json();
      setItems((prev) => [...prev, ...payload.data.items]);
      setCursor(payload.data.nextCursor);
    } catch {
      // Silent catch to preserve UX on intermittent network error
    } finally {
      setLoadingMore(false);
    }
  }

  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timeout = setTimeout(() => {
      applyFilters();
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, type, status]);

  const hasActiveFilters = Boolean(search.trim() || type || status);

  function clearAllFilters() {
    setSearch("");
    setType("");
    setStatus("");
  }

  return (
    <div className="flex flex-col gap-5" aria-busy={loading}>
      {/* ── Filter Toolbar ─────────────────────────────────────────────────── */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Search counterparty or narration..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search transactions by counterparty or narration"
                className="h-10 w-full rounded-lg border border-border bg-surface pl-10 pr-9 text-sm text-text-primary placeholder:text-text-tertiary transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-text-tertiary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Clear search query"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Select Filters & Export */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Type Select */}
              <div className="min-w-[135px] flex-1 sm:flex-initial">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  aria-label="Filter by transaction type"
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text-primary transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All Types</option>
                  {TRANSACTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TRANSACTION_TYPE_LABELS[t] ?? t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Select */}
              <div className="min-w-[135px] flex-1 sm:flex-initial">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  aria-label="Filter by transaction status"
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text-primary transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All Statuses</option>
                  {TRANSACTION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {TRANSACTION_STATUS_LABELS[s] ?? s}
                    </option>
                  ))}
                </select>
              </div>

              {/* CSV Export */}
              <a
                href={`/api/transactions/export?${buildParams().toString()}`}
                download
                aria-label="Export transactions to CSV"
                className="touch-target inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-sm font-medium text-text-primary shadow-xs transition-colors hover:border-border-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Download className="h-4 w-4 text-text-secondary" aria-hidden="true" />
                <span>Export CSV</span>
              </a>
            </div>
          </div>

          {/* Active Filter Chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
              <span className="text-xs font-medium text-text-tertiary">Active filters:</span>
              {search.trim() && (
                <Badge
                  variant="neutral"
                  className="gap-1.5 pl-2 pr-1.5 py-0.5 text-xs text-text-primary"
                >
                  <span>Query: &quot;{search.trim()}&quot;</span>
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="rounded p-0.5 hover:bg-surface-hover"
                    aria-label="Remove search filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {type && (
                <Badge
                  variant="neutral"
                  className="gap-1.5 pl-2 pr-1.5 py-0.5 text-xs text-text-primary"
                >
                  <span>Type: {TRANSACTION_TYPE_LABELS[type] ?? type}</span>
                  <button
                    type="button"
                    onClick={() => setType("")}
                    className="rounded p-0.5 hover:bg-surface-hover"
                    aria-label="Remove type filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {status && (
                <Badge
                  variant="neutral"
                  className="gap-1.5 pl-2 pr-1.5 py-0.5 text-xs text-text-primary"
                >
                  <span>Status: {TRANSACTION_STATUS_LABELS[status] ?? status}</span>
                  <button
                    type="button"
                    onClick={() => setStatus("")}
                    className="rounded p-0.5 hover:bg-surface-hover"
                    aria-label="Remove status filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-medium text-primary hover:underline ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Transaction Content ────────────────────────────────────────────── */}
      {loading && items.length === 0 ? (
        <SkeletonTable rows={8} columns={5} />
      ) : items.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-elevated/50 p-8 text-center sm:p-12">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary shadow-xs">
            {hasActiveFilters ? (
              <FilterX className="h-7 w-7" aria-hidden="true" />
            ) : (
              <History className="h-7 w-7" aria-hidden="true" />
            )}
          </div>
          <h2 className="text-base font-semibold text-text-primary sm:text-lg">
            {hasActiveFilters ? "No Matching Transactions" : "No Transactions Yet"}
          </h2>
          <p className="mt-1.5 max-w-sm text-sm text-text-secondary">
            {hasActiveFilters
              ? "We couldn't find any transactions matching your active filter criteria. Try adjusting your query or resetting filters."
              : "Your banking transfers, deposits, withdrawals, trades, and currency conversions will appear here once executed."}
          </p>
          {hasActiveFilters && (
            <div className="mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="gap-1.5 font-medium"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Reset Filters
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ── Desktop & Tablet Semantic Table (>= 768px) ────────────────────── */}
          <Card className="hidden overflow-hidden md:block shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">List of your account transactions</caption>
                <thead className="border-b border-border bg-surface/70 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  <tr>
                    <th scope="col" className="px-4 py-3 sm:px-5">
                      Date &amp; Time
                    </th>
                    <th scope="col" className="px-4 py-3 sm:px-5">
                      Type &amp; Direction
                    </th>
                    <th scope="col" className="px-4 py-3 sm:px-5">
                      Description / Counterparty
                    </th>
                    <th scope="col" className="px-4 py-3 sm:px-5">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right sm:px-5">
                      Amount
                    </th>
                    <th scope="col" className="px-4 py-3 text-right sm:px-5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70 bg-surface-elevated">
                  {items.map((txn) => {
                    const isCredit = txn.direction === "CREDIT";
                    const typeName = TRANSACTION_TYPE_LABELS[txn.type] ?? txn.type;
                    const dateObj = new Date(txn.createdAt);
                    const dateStr = dateObj.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                    const timeStr = dateObj.toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    const displayDescription =
                      txn.counterparty || txn.narration || "—";
                    const secondaryText =
                      txn.counterparty && txn.narration ? txn.narration : null;

                    return (
                      <tr
                        key={txn.id}
                        className="transition-colors hover:bg-surface-hover/50"
                      >
                        {/* Date & Time */}
                        <td className="whitespace-nowrap px-4 py-3.5 sm:px-5">
                          <div className="font-medium text-text-primary">{dateStr}</div>
                          <div className="text-xs text-text-tertiary">{timeStr}</div>
                        </td>

                        {/* Type & Direction */}
                        <td className="whitespace-nowrap px-4 py-3.5 sm:px-5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                                isCredit
                                  ? "bg-success-soft text-success"
                                  : "bg-surface-hover text-text-secondary"
                              )}
                              aria-hidden="true"
                            >
                              {isCredit ? (
                                <ArrowDownLeft className="h-4 w-4" />
                              ) : (
                                <ArrowUpRight className="h-4 w-4" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-text-primary">
                                {typeName}
                              </div>
                              <div className="text-xs text-text-secondary">
                                {isCredit ? "Incoming" : "Outgoing"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Description / Counterparty */}
                        <td className="px-4 py-3.5 sm:px-5 max-w-[240px]">
                          <div
                            className="truncate font-medium text-text-primary"
                            title={displayDescription}
                          >
                            {displayDescription}
                          </div>
                          {secondaryText && (
                            <div
                              className="truncate text-xs text-text-secondary"
                              title={secondaryText}
                            >
                              {secondaryText}
                            </div>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="whitespace-nowrap px-4 py-3.5 sm:px-5">
                          <TransactionStatusBadge status={txn.status} />
                        </td>

                        {/* Amount */}
                        <td
                          className={cn(
                            "whitespace-nowrap px-4 py-3.5 text-right font-medium sm:px-5",
                            isCredit ? "text-success" : "text-text-primary"
                          )}
                        >
                          <span className="financial-value text-sm font-semibold">
                            {isCredit ? "+" : "−"}
                            {formatMoney(txn.amount, txn.assetSymbol)}
                          </span>
                        </td>

                        {/* View Details Action Button */}
                        <td className="whitespace-nowrap px-4 py-3.5 text-right sm:px-5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelected(txn)}
                            className="h-8 px-2.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary hover:bg-surface-hover"
                            aria-label={`View details for ${typeName} transaction ${txn.id}`}
                          >
                            <span>Details</span>
                            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ── Mobile Dedicated Cards (< 768px) ────────────────────────────── */}
          <div className="flex flex-col gap-2.5 md:hidden" role="feed" aria-label="Transactions list">
            {items.map((txn) => {
              const isCredit = txn.direction === "CREDIT";
              const typeName = TRANSACTION_TYPE_LABELS[txn.type] ?? txn.type;
              const dateObj = new Date(txn.createdAt);
              const dateStr = dateObj.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              });
              const timeStr = dateObj.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              });

              const primaryText = txn.counterparty || txn.narration || typeName;

              return (
                <div
                  key={txn.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(txn)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(txn);
                    }
                  }}
                  className="group relative flex flex-col gap-3 rounded-xl border border-border bg-surface-elevated p-4 shadow-xs transition-all active:scale-[0.99] hover:border-border-strong cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`View details for ${typeName} transaction, ${primaryText}`}
                >
                  {/* Top line: Icon + Type & Counterparty + Amount */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                          isCredit
                            ? "bg-success-soft text-success"
                            : "bg-surface-hover text-text-secondary"
                        )}
                        aria-hidden="true"
                      >
                        {isCredit ? (
                          <ArrowDownLeft className="h-5 w-5" />
                        ) : (
                          <ArrowUpRight className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text-primary">
                          {primaryText}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {typeName} • {isCredit ? "Incoming" : "Outgoing"}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span
                        className={cn(
                          "financial-value block text-sm font-bold",
                          isCredit ? "text-success" : "text-text-primary"
                        )}
                      >
                        {isCredit ? "+" : "−"}
                        {formatMoney(txn.amount, txn.assetSymbol)}
                      </span>
                    </div>
                  </div>

                  {/* Bottom line: Date & Time + Status Badge */}
                  <div className="flex items-center justify-between border-t border-border/50 pt-2.5 text-xs text-text-secondary">
                    <span>
                      {dateStr}, {timeStr}
                    </span>
                    <TransactionStatusBadge status={txn.status} size="sm" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Pagination ("Load more") ───────────────────────────────────── */}
          {cursor && (
            <div className="mt-2 flex justify-center pb-4">
              <Button
                variant="outline"
                size="md"
                onClick={loadMore}
                disabled={loadingMore}
                className="gap-2 font-medium min-w-[160px] shadow-xs"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <span>Load more transactions</span>
                )}
              </Button>
            </div>
          )}
        </>
      )}

      {/* ── Transaction Details Modal ───────────────────────────────────────── */}
      <TransactionDetailModal
        transaction={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
