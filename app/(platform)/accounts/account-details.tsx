"use client";

import * as React from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { accountDisplayName, BANK_ACCOUNT_TYPE_LABELS } from "@/lib/utilities/format-account";

interface AccountDetailsProps {
  nickname: string | null;
  type: string;
  holderName: string;
  accountNumber: string;
  currency: string;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-body-sm text-text-secondary">{label}</dt>
      <dd className="text-sm text-text-primary">{children}</dd>
    </div>
  );
}

export function AccountDetails({ nickname, type, holderName, accountNumber, currency }: AccountDetailsProps) {
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
        aria-label={`Show account number for ${accountName}`}
      >
        Account details
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="mx-auto w-[min(calc(100%-2rem),24rem)] rounded-lg border border-border bg-surface-elevated p-0 text-text-primary shadow-lg backdrop:bg-black/50 animate-fade-in"
        onClose={() => setCopied(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeDetails();
        }}
      >
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <h2 id={titleId} className="text-card-title">
            Account details
          </h2>
          <dl className="flex flex-col gap-3">
            <DetailRow label="Account">{accountName}</DetailRow>
            <DetailRow label="Type">{typeLabel}</DetailRow>
            <DetailRow label="Account holder">{holderName}</DetailRow>
            <DetailRow label="PLT account number">
              <span className="break-all font-mono text-sm financial-value">{accountNumber}</span>
            </DetailRow>
            <DetailRow label="Currency">{currency}</DetailRow>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void copyAccountNumber()}>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              {copied ? "Copied" : "Copy account number"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={closeDetails}>
              Close
            </Button>
          </div>
          <p role="status" aria-live="polite" className="sr-only">
            {copied ? "Copied" : ""}
          </p>
        </div>
      </dialog>
    </>
  );
}
