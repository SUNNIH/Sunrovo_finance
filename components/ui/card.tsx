import * as React from "react";
import { cn } from "@/lib/utilities/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        /* Base structure with strong elevation */
        "rounded-lg border border-border bg-surface-elevated relative",
        /* Pronounced multi-layer shadows for clear visible depth */
        "shadow-[0_2px_4px_hsl(var(--border)/0.6),0_4px_12px_hsl(var(--border)/0.35),0_8px_24px_hsl(var(--border)/0.18),0_12px_40px_hsl(var(--border)/0.08),0_0_0_1px_hsl(var(--primary)/0.05)]",
        /* Directional gradient for dimensional depth */
        "bg-gradient-to-br from-surface-elevated/100 via-surface-elevated/95 to-surface/90",
        /* Stronger top edge highlight */
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[2px]",
        "before:rounded-t-lg before:bg-gradient-to-r before:from-transparent before:via-border-strong/40 before:to-transparent",
        /* Subtle bottom edge shadow for lift effect */
        "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px",
        "after:rounded-b-lg after:bg-gradient-to-r after:from-transparent after:via-border/30 after:to-transparent",
        /* Smooth transitions */
        "transition-[border-color,box-shadow,transform] duration-300 ease-out",
        /* Hover lift effect - 5px elevation with enhanced depth */
        "hover:border-border-strong hover:-translate-y-[5px]",
        "hover:shadow-[0_4px_8px_hsl(var(--border)/0.7),0_8px_20px_hsl(var(--border)/0.45),0_16px_40px_hsl(var(--border)/0.25),0_24px_60px_hsl(var(--border)/0.12),0_0_0_1px_hsl(var(--primary)/0.08)]",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-4 sm:p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-card-title text-text-primary", className)} {...props} />
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-body-sm text-text-secondary", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-0 sm:p-5 sm:pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-4 pt-0 sm:p-5 sm:pt-0", className)} {...props} />;
}
