import { Badge, type BadgeProps } from "@/components/ui/badge";

const STATUS_VARIANTS: Record<string, NonNullable<BadgeProps["variant"]>> = {
  COMPLETED: "success",
  PENDING: "warning",
  FAILED: "danger",
  REVERSED: "neutral",
};

export function TransactionStatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANTS[status] ?? "neutral"}>{status}</Badge>;
}
