import * as React from "react";
import { CheckCircle2, Clock, AlertCircle, RotateCcw } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utilities/cn";

const STATUS_VARIANTS: Record<string, NonNullable<BadgeProps["variant"]>> = {
  COMPLETED: "success",
  PENDING: "warning",
  FAILED: "danger",
  REVERSED: "neutral",
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>> = {
  COMPLETED: CheckCircle2,
  PENDING: Clock,
  FAILED: AlertCircle,
  REVERSED: RotateCcw,
};

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: "Completed",
  PENDING: "Pending",
  FAILED: "Failed",
  REVERSED: "Reversed",
};

export interface TransactionStatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  className?: string;
}

export function TransactionStatusBadge({
  status,
  size = "sm",
  className,
}: TransactionStatusBadgeProps) {
  const variant = STATUS_VARIANTS[status] ?? "neutral";
  const Icon = STATUS_ICONS[status];
  const label = STATUS_LABELS[status] ?? status;

  return (
    <Badge
      variant={variant}
      className={cn(
        "inline-flex items-center font-medium",
        size === "sm" ? "gap-1 px-2 py-0.5 text-xs" : "gap-1.5 px-2.5 py-1 text-xs",
        className
      )}
      aria-label={`Status: ${label}`}
    >
      {Icon && (
        <Icon
          className={cn("shrink-0", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")}
          aria-hidden="true"
        />
      )}
      <span>{label}</span>
    </Badge>
  );
}
