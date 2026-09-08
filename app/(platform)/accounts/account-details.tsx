"use client";

import * as React from "react";
import { Check, Copy, FileText, Landmark, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { accountDisplayName, BANK_ACCOUNT_TYPE_LABELS } from "@/lib/utilities/format-account";
import { cn } from "@/lib/utilities/cn";

interface AccountDetailsProps {
  nickname: string | null;
  type: string;
  holderName: string;
  accountNumber: string;
  currency: string;
}

function DetailRow({
  label,
  children,
  highlight = false,
}: {
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg px-3 py-2.5 transition-colors",
        highlight ? "border border-border/80 bg-surface" : "bg-surface/40"
      )}
    >
      <dt className="text-label uppercase tracking-wider text-text-tertiary font-medium">
        {label}
      </dt>
      <dd className="text-sm font-medium text-text-primary">{children}</dd>
    </div>
  );
}

export function AccountDetails({
  nickname,
  type,
  holderName,
  accountNumber,
  currency,
}: AccountDetailsProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const copyResetRef = React.useRef<number | undefined>(undefined);
  const titleId = React.useId();
  const [copied, setCopied] = React.useState(false);
  const accountName = accountDisplayName(nickname, type);
  const typeLabel = BANK_ACCOUNT_TYPE_LABELS[type] ?? type;

  React.useEffect(() => {
    return () => {
      if (copyResetRef.current !== undefined) {
        window.clearTimeout(copyResetRef.current);
      }
    };
  }, []);

  function openDetails() {
    setCopied(false);
    dialogRef.current?.showModal();
  }

  function closeDetails() {
    dialogRef.current?.close();
  }

  async function copyAccountNumber() {
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopied(true);
      if (copyResetRef.current !== undefined) {
        window.clearTimeout(copyResetRef.current);
      }
      copyResetRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={openDetails}
        aria-haspopup="dialog"
        aria-label={`Show account details for ${accountName}`}
        className="w-full gap-1.5 font-medium transition-colors hover:border-primary/40 hover:text-primary"
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        <span>Details</span>
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="mx-auto w-[min(calc(100%-2rem),28rem)] rounded-2xl border border-border bg-surface-elevated p-0 text-text-primary shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-xs animate-fade-in"
        onClose={() => setCopied(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeDetails();
        }}
      >
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary shadow-xs">
                <Landmark className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 id={titleId} className="text-base font-semibold tracking-tight text-text-primary">
                  Account Details
                </h2>
                <p className="text-xs text-text-secondary">
                  Official PLT fiat account specifications
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeDetails}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Details list */}
          <dl className="flex flex-col gap-2.5">
            <DetailRow label="Account Name">{accountName}</DetailRow>
            <DetailRow label="Account Type">{typeLabel}</DetailRow>
            <DetailRow label="Account Holder">{holderName}</DetailRow>
            <DetailRow label="PLT Account Number" highlight>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm tracking-wider financial-value select-all font-semibold text-text-primary">
                  {accountNumber}
                </span>
                <button
                  type="button"
                  onClick={() => void copyAccountNumber()}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={copied ? "Copied" : "Copy account number"}
                  title={copied ? "Copied!" : "Copy account number"}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </DetailRow>
            <DetailRow label="Currency">{currency}</DetailRow>
          </dl>

          {/* Dialog actions */}
          <div className="flex items-center gap-2 border-t border-border/60 pt-4">
            <Button
              type="button"
              variant={copied ? "secondary" : "outline"}
              size="sm"
              className="flex-1 gap-1.5 font-medium"
              onClick={() => void copyAccountNumber()}
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{copied ? "Copied to Clipboard" : "Copy Account Number"}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={closeDetails}
            >
              Close
            </Button>
          </div>

          <p role="status" aria-live="polite" className="sr-only">
            {copied ? "Account number copied to clipboard" : ""}
          </p>
        </div>
      </dialog>
    </>
  );
}
