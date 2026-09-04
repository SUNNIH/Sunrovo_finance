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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-elevated/95 backdrop-blur lg:hidden safe-area-bottom"
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
                  "touch-target flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors duration-150",
                  isActive ? "text-primary" : "text-text-secondary"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
