import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utilities/cn";

/**
 * Persistent, unobtrusive notice required by the product's safety
 * boundaries: "Demo Environment — No real funds are held or transferred."
 * Shown in the top navigation on every authenticated screen until real
 * licensed providers are connected.
 */
export function DemoEnvironmentBadge({ className }: { className?: string }) {
  return (
    <Badge variant="warning" className={cn("hidden items-center sm:inline-flex", className)}>
      <Info className="h-3 w-3" aria-hidden="true" />
      Demo Environment — no real funds
    </Badge>
  );
}
