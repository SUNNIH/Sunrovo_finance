"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { maskAccountNumber } from "@/lib/utilities/format-account";
import { cn } from "@/lib/utilities/cn";

interface AccountNumberDisplayProps {
  accountNumber: string;
  className?: string;
}

export function AccountNumberDisplay({
  accountNumber,
  className,
}: AccountNumberDisplayProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== undefined) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopied(true);
      if (copyTimeoutRef.current !== undefined) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <span
        className="select-all font-mono text-sm font-medium tracking-wider text-text-primary financial-value"
        aria-label={
          visible
            ? `Account number: ${accountNumber}`
            : `Masked account number ending in ${accountNumber.slice(-4)}`
        }
      >
        {visible ? accountNumber : maskAccountNumber(accountNumber)}
      </span>

      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
          aria-label={
            visible
              ? "Hide account number"
              : "Show full account number"
          }
          title={visible ? "Hide account number" : "Show full account number"}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={() => void copyToClipboard()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
          aria-label={copied ? "Account number copied" : "Copy account number"}
          title={copied ? "Copied to clipboard" : "Copy account number"}
        >
          {copied ? (
            <Check className="h-4 w-4 text-success" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Account number copied to clipboard" : ""}
      </span>
    </div>
  );
}