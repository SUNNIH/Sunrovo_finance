"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { FiseLogo } from "@/components/brand/fise-logo";
import { cn } from "@/lib/utilities/cn";
import { SIDEBAR_NAV, SUPPORT_NAV_ITEM } from "./nav-config";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Hidden below lg; shown as a drawer instead (see mobile-nav-drawer.tsx). */
  className?: string;
}

/**
 * Persistent left sidebar for desktop / large tablet layouts. Collapses to
 * an icon rail for smaller laptop screens (design memory: "Collapsible
 * sidebar for smaller laptop screens").
 */
export function Sidebar({ collapsed, onToggleCollapsed, className }: SidebarProps) {
  const pathname = usePathname();
  const navScrollRef = React.useRef<HTMLElement>(null);

  // Reset navigation scroll position when route changes to prevent
  // partially clipped navigation items
  React.useEffect(() => {
    if (navScrollRef.current) {
      navScrollRef.current.scrollTop = 0;
    }
  }, [pathname]);

  return (
    <aside
      className={cn(
        "hidden lg:flex lg:flex-col",
        "border-r border-border bg-surface-elevated",
        "fixed left-0 top-0 bottom-0 shrink-0 transition-[width] duration-300 ease-out",
        /* Subtle cast on the right edge — matches auth page primary glow */
        "shadow-[1px_0_0_hsl(var(--primary)/0.06)]",
        collapsed ? "lg:w-[76px]" : "lg:w-[248px]",
        className
      )}
      aria-label="Primary"
    >
      {/* ── Logo / wordmark (fixed at top, aligns with TopNavigation h-16) ── */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-3 border-b border-border px-4",
          "glass-swirl-effect" /* premium swirling 3D glass effect */
        )}
      >
        <FiseLogo variant="mark" className="h-8 w-8 relative z-10" />
        {!collapsed && <FiseLogo className="h-9 w-auto max-w-[154px] relative z-10" />}
      </div>

      {/* ── Primary navigation (scrollable) ── */}
      <nav
        ref={navScrollRef}
        aria-label="Main"
        className="flex flex-1 min-h-0 flex-col overflow-y-auto px-3 py-4"
      >
        {SIDEBAR_NAV.map((group, groupIndex) => (
          <div key={group.label}>
            {/* Hairline section divider between groups */}
            {groupIndex > 0 && (
              <div className="my-3 border-t border-border/50" aria-hidden="true" />
            )}
            {!collapsed && (
              <p className="mb-1.5 px-3 text-label uppercase tracking-[0.14em] text-text-tertiary">
                {group.label}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "touch-target flex items-center gap-3 rounded-md px-2.5 text-sm font-medium",
                        /*
                         * Option A active indicator: border-l-2 is applied to ALL
                         * items — active gets border-primary, inactive gets
                         * border-transparent. This reserves the 2 px width on both
                         * states so there is no layout shift on activation.
                         */
                        "border-l-2 transition-colors duration-200 ease-out",
                        isActive
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                      )}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── Footer: support link + collapse toggle (fixed at bottom) ── */}
      <div className="shrink-0 border-t border-border px-3 pb-4 pt-3">
        <Link
          href={SUPPORT_NAV_ITEM.href}
          className={cn(
            "touch-target flex items-center gap-3 rounded-md px-2.5 text-sm font-medium",
            "border-l-2 border-transparent text-text-secondary",
            "transition-colors duration-200 ease-out hover:bg-surface-hover hover:text-text-primary"
          )}
        >
          <SUPPORT_NAV_ITEM.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          {!collapsed && <span>{SUPPORT_NAV_ITEM.label}</span>}
        </Link>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "touch-target mt-1 flex w-full items-center gap-3 rounded-md px-2.5 text-sm font-medium",
            "border-l-2 border-transparent text-text-secondary",
            "transition-colors duration-200 ease-out hover:bg-surface-hover hover:text-text-primary"
          )}
        >
          {collapsed ? (
            <ChevronsRight className="h-[18px] w-[18px]" aria-hidden="true" />
          ) : (
            <ChevronsLeft className="h-[18px] w-[18px]" aria-hidden="true" />
          )}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
