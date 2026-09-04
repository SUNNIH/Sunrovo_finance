"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { maskAccountNumber } from "@/lib/utilities/format-account";

interface AccountNumberDisplayProps {
  accountNumber: string;
}

export function AccountNumberDisplay({
  accountNumber,
}: AccountNumberDisplayProps) {
  const [visible, setVisible] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setVisible((current) => !current)}
      className="inline-flex min-h-touch items-center gap-2 rounded-md px-1.5 py-1 text-body-sm text-text-secondary financial-value transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary"
      aria-label={
        visible
          ? "Hide account number"
          : "Show full account number"
      }
    >
      <span>
        {visible ? accountNumber : maskAccountNumber(accountNumber)}
      </span>

      {visible ? (
        <EyeOff className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Eye className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}