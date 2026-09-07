import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utilities/cn";
import { formatMoney } from "@/lib/money/format";
import type { Money } from "@/lib/money/money";

interface CurrencyValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: Money | string;
  assetSymbol: string;
  showSymbol?: boolean;
}

/**
 * Renders a monetary amount with tabular numerals (design memory:
 * "Financial values must use tabular numerals"). Always route balances,
 * prices, and transaction amounts through this component instead of
 * formatting inline.
 */
export function CurrencyValue({
  amount,
  assetSymbol,
  showSymbol = true,
  className,
  ...props
}: CurrencyValueProps) {
  return (
    <span className={cn("financial-value", className)} {...props}>
      {formatMoney(amount, assetSymbol, { showSymbol })}
    </span>
  );
}

interface PercentChangeProps {
  value: number;
  className?: string;
}

/**
 * Positive/negative indicator that never relies on colour alone
 * (accessibility memory): pairs colour with an arrow icon AND a
 * plus/minus-signed text label.
 */
export function PercentChange({ value, className }: PercentChangeProps) {
  const isPositive = value >= 0;
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "financial-value inline-flex items-center gap-0.5 text-sm font-medium",
        isPositive ? "text-success" : "text-danger",
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>
        {isPositive ? "+" : ""}
        {value.toFixed(2)}%
      </span>
      <span className="sr-only">{isPositive ? "increase" : "decrease"}</span>
    </span>
  );
}
