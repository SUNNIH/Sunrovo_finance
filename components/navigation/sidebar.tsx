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
        "hidden lg:flex lg:flex-col lg:justify-between border-r border-border bg-surface-elevated",
        "h-screen sticky top-0 shrink-0 transition-[width] duration-200",
        collapsed ? "lg:w-[76px]" : "lg:w-[248px]",
        className
      )}
      aria-label="Primary"
    >
      <div>
        <div className="flex h-16 items-center gap-2 border-b border-border px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Diamond className="h-4 w-4" aria-hidden="true" />
          </div>
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight text-text-primary">
              PLATINUM TRUST BANK
            </span>
          )}
        </div>

        <nav className="flex flex-col gap-5 px-3 py-4">
          {SIDEBAR_NAV.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="mb-1.5 px-2 text-label uppercase tracking-wide text-text-tertiary">
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
                          "touch-target flex items-center gap-3 rounded-md px-2.5 text-sm font-medium transition-colors duration-150",
                          isActive
                            ? "bg-primary-soft text-primary"
                            : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
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

      <div className="border-t border-border p-3">
        <Link
          href={SUPPORT_NAV_ITEM.href}
          className="touch-target flex items-center gap-3 rounded-md px-2.5 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        >
          <SUPPORT_NAV_ITEM.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          {!collapsed && <span>{SUPPORT_NAV_ITEM.label}</span>}
        </Link>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="touch-target mt-1 flex w-full items-center gap-3 rounded-md px-2.5 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary"
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
