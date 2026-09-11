"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { FiseLogo } from "@/components/brand/fise-logo";
import { cn } from "@/lib/utilities/cn";
import { SIDEBAR_NAV, SUPPORT_NAV_ITEM } from "./nav-config";

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Secondary navigation for tablet/mobile (design memory: "Slide-out
 * secondary navigation"). Traps focus while open and restores focus to
 * the trigger on close, per accessibility memory (modal focus trapping,
 * keyboard support, logical tab order).
 */
export function MobileNavDrawer({ open, onClose }: MobileNavDrawerProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  React.useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop scrim */}
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-black/50 animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          "absolute inset-y-0 left-0 flex w-[86%] max-w-xs flex-col",
          "bg-surface-elevated shadow-xl animate-slide-up",
          "safe-area-top safe-area-bottom"
        )}
      >
        {/* ── Logo / wordmark — matches sidebar exactly ── */}
        <div
          className={cn(
            "flex h-16 items-center justify-between border-b border-border px-4",
            "plt-grid-texture"
          )}
        >
          <div className="flex items-center gap-3">
            <FiseLogo variant="mark" className="h-8 w-8" />
            <FiseLogo className="h-9 w-auto max-w-[154px]" />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className={cn(
              "touch-target inline-flex items-center justify-center rounded-lg",
              "text-text-secondary transition-colors duration-200 ease-out hover:bg-surface-hover"
            )}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {SIDEBAR_NAV.map((group, groupIndex) => (
            <div key={group.label} className="mb-1">
              {groupIndex > 0 && (
                <div className="my-3 border-t border-border/50" aria-hidden="true" />
              )}
              <p className="mb-1.5 px-3 text-label uppercase tracking-[0.14em] text-text-tertiary">
                {group.label}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "touch-target flex items-center gap-3 rounded-md px-2.5 text-sm font-medium",
                          /*
                           * Option A — same border-l-2 on all items:
                           * active → border-primary bg-primary-soft text-primary
                           * inactive → border-transparent (no layout shift)
                           */
                          "border-l-2 transition-colors duration-200 ease-out",
                          isActive
                            ? "border-primary bg-primary-soft text-primary"
                            : "border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {/* Support link */}
          <div className="mt-3 border-t border-border/50 pt-3">
            <Link
              href={SUPPORT_NAV_ITEM.href}
              onClick={onClose}
              className={cn(
                "touch-target flex items-center gap-3 rounded-md px-2.5 text-sm font-medium",
                "border-l-2 border-transparent text-text-secondary",
                "transition-colors duration-200 ease-out hover:bg-surface-hover hover:text-text-primary"
              )}
            >
              <SUPPORT_NAV_ITEM.icon className="h-[18px] w-[18px]" aria-hidden="true" />
              {SUPPORT_NAV_ITEM.label}
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
