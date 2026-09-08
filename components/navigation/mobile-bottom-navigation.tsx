"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utilities/cn";
import { MOBILE_NAV } from "./nav-config";

/**
 * Bottom tab bar shown below `lg`. Respects safe-area insets on iOS
 * devices with a home indicator (browser memory: safe-area handling).
 */
export function MobileBottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 safe-area-bottom lg:hidden",
        "border-t border-border/80 bg-surface-elevated/[0.97] backdrop-blur-md",
        /* Subtle blue upward shadow — mirrors the header's downward cast */
        "shadow-[0_-1px_0_hsl(var(--primary)/0.05)]"
      )}
    >
      <ul className="grid grid-cols-5">
        {MOBILE_NAV.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "touch-target flex flex-col items-center justify-center gap-0.5 py-2",
                  "text-[11px] font-medium tracking-tight",
                  "transition-colors duration-200 ease-out",
                  isActive ? "text-primary" : "text-text-secondary hover:text-text-primary"
                )}
              >
                {/*
                 * Active pip: a short horizontal bar above the icon.
                 * Both states render the span — active gets bg-primary,
                 * inactive gets bg-transparent — so there is no height jump.
                 */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "mb-0.5 h-0.5 w-5 rounded-full transition-colors duration-200",
                    isActive ? "bg-primary" : "bg-transparent"
                  )}
                />
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-200 ease-out",
                    isActive && "scale-105"
                  )}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
