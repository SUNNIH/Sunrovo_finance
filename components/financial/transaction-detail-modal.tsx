"use client";

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, Check, Copy, X } from "lucide-react";
import Decimal from "decimal.js";
import { Button } from "@/components/ui/button";
import { TransactionStatusBadge } from "./transaction-status-badge";
import { formatMoney } from "@/lib/money/format";
import { cn } from "@/lib/utilities/cn";

export interface TransactionView {
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

interface TransactionDetailModalProps {
  transaction: TransactionView | null;
  onClose: () => void;
}

const TYPE_DISPLAY_NAMES: Record<string, string> = {
  TRANSFER: "Transfer",
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  TRADE: "Trade",
  CONVERSION: "Conversion",
  FEE: "Fee",
  CARD_PAYMENT: "Card Payment",
};

export function TransactionDetailModal({
  transaction,
  onClose,
}: TransactionDetailModalProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const copyResetRef = React.useRef<number | undefined>(undefined);
  const titleId = React.useId();
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (transaction) {
      setCopied(false);
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [transaction]);

  React.useEffect(() => {
    return () => {
      if (copyResetRef.current !== undefined) {
        window.clearTimeout(copyResetRef.current);
      }
    };
  }, []);

  if (!transaction) return null;

  async function copyReference() {
    if (!transaction) return;
    try {
      await navigator.clipboard.writeText(transaction.id);
      setCopied(true);
      if (copyResetRef.current !== undefined) {
        window.clearTimeout(copyResetRef.current);
      }
      copyResetRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const isCredit = transaction.direction === "CREDIT";
  const typeLabel = TYPE_DISPLAY_NAMES[transaction.type] ?? transaction.type;

  let hasFee = false;
  try {
    hasFee = new Decimal(transaction.feeAmount).gt(0);
  } catch {
    hasFee = false;
  }

  const formattedDate = new Date(transaction.createdAt).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="mx-auto w-[min(calc(100%-2rem),30rem)] rounded-2xl border border-border bg-surface-elevated p-0 text-text-primary shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-xs animate-fade-in"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                isCredit
                  ? "bg-success-soft text-success"
                  : "bg-surface-hover text-text-secondary"
              )}
            >
              {isCredit ? (
                <ArrowDownLeft className="h-5 w-5" aria-hidden="true" />
              ) : (
                <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
            <div>
              <h2
                id={titleId}
                className="text-base font-semibold tracking-tight text-text-primary sm:text-lg"
              >
                {typeLabel}
              </h2>
              <p className="text-xs text-text-secondary">
                {isCredit ? "Incoming (Credit)" : "Outgoing (Debit)"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="touch-target inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Amount Hero Card */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/80 bg-surface/50 p-4 text-center">
          <span className="text-label uppercase tracking-wider text-text-tertiary font-medium">
            Amount
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span
              className={cn(
                "financial-value text-2xl font-bold tracking-tight sm:text-3xl",
                isCredit ? "text-success" : "text-text-primary"
              )}
            >
              {isCredit ? "+" : "−"}
              {formatMoney(transaction.amount, transaction.assetSymbol)}
            </span>
          </div>
          <div className="mt-2.5">
            <TransactionStatusBadge status={transaction.status} size="md" />
          </div>
        </div>

        {/* Details list */}
        <dl className="flex flex-col divide-y divide-border/60 text-sm">
          {/* Reference ID */}
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-text-secondary">Reference</dt>
            <dd className="flex items-center gap-1.5 font-mono text-xs text-text-primary">
              <span className="truncate max-w-[160px] sm:max-w-[220px]" title={transaction.id}>
                {transaction.id}
              </span>
              <button
                type="button"
                onClick={() => void copyReference()}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={copied ? "Copied" : "Copy reference"}
                title={copied ? "Copied!" : "Copy reference"}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </button>
            </dd>
          </div>

          {/* Fee (only if fee > 0) */}
          {hasFee && (
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-text-secondary">Fee</dt>
              <dd className="financial-value font-medium text-text-primary">
                {formatMoney(transaction.feeAmount, transaction.assetSymbol)}
              </dd>
            </div>
          )}

          {/* Counterparty (only if present) */}
          {transaction.counterparty && transaction.counterparty.trim() !== "" && (
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-text-secondary">Counterparty</dt>
              <dd className="font-medium text-text-primary text-right max-w-[200px] truncate" title={transaction.counterparty}>
                {transaction.counterparty}
              </dd>
            </div>
          )}

          {/* Narration (only if present) */}
          {transaction.narration && transaction.narration.trim() !== "" && (
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-text-secondary">Note / Description</dt>
              <dd className="font-medium text-text-primary text-right max-w-[200px] truncate" title={transaction.narration}>
                {transaction.narration}
              </dd>
            </div>
          )}

          {/* Asset */}
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-text-secondary">Asset</dt>
            <dd className="font-medium text-text-primary">
              {transaction.assetSymbol}
            </dd>
          </div>

          {/* Timestamp */}
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-text-secondary">Timestamp</dt>
            <dd className="font-medium text-text-primary">
              {formattedDate}
            </dd>
          </div>
        </dl>

        {/* Demo Indicator (only if isDemo === true) */}
        {transaction.isDemo && (
          <div className="rounded-lg border border-warning/30 bg-warning-soft/40 p-3 text-center">
            <p className="text-xs text-text-secondary">
              <span className="font-semibold text-warning">Demo Environment:</span> This transaction is simulated. No real funds were involved.
            </p>
          </div>
        )}

        {/* Dialog footer action */}
        <div className="flex items-center gap-2 border-t border-border/60 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="w-full font-medium"
          >
            Close
          </Button>
        </div>

        <p role="status" aria-live="polite" className="sr-only">
          {copied ? "Transaction reference copied to clipboard" : ""}
        </p>
      </div>
    </dialog>
  );
}
