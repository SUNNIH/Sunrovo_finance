"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Diamond } from "lucide-react";
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

  return (
    <aside
      className={cn(
        "hidden lg:flex lg:flex-col lg:justify-between",
        "border-r border-border bg-surface-elevated",
        "h-screen sticky top-0 shrink-0 transition-[width] duration-300 ease-out",
        /* Subtle blue cast on the right edge — matches auth page primary glow */
        "shadow-[1px_0_0_hsl(var(--primary)/0.06)]",
        collapsed ? "lg:w-[76px]" : "lg:w-[248px]",
        className
      )}
      aria-label="Primary"
    >
      <div>
        {/* ── Logo / wordmark ── */}
        <div
          className={cn(
            "flex h-16 items-center gap-3 border-b border-border px-4",
            "plt-grid-texture" /* subtle financial texture in header strip */
          )}
        >
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              "bg-gradient-to-br from-primary to-primary-hover text-primary-foreground",
              "shadow-[0_2px_8px_hsl(var(--primary)/0.30)]"
            )}
          >
            <Diamond className="h-4 w-4" aria-hidden="true" />
          </div>
          {!collapsed && (
            <span className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-text-primary">
              Platinum Trust Bank
            </span>
          )}
        </div>

        {/* ── Primary navigation ── */}
        <nav aria-label="Main" className="flex flex-col px-3 py-4">
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
      </div>

      {/* ── Footer: support link + collapse toggle ── */}
      <div className="border-t border-border px-3 pb-4 pt-3">
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
