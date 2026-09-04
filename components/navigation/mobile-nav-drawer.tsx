"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Diamond, X } from "lucide-react";
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
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-black/40 animate-fade-in"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className="absolute inset-y-0 left-0 flex w-[86%] max-w-xs flex-col bg-surface-elevated shadow-xl animate-slide-up safe-area-top safe-area-bottom"
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Diamond className="h-4 w-4" aria-hidden="true" />
            </div>
            <span className="text-sm font-semibold text-text-primary">PLATINUM TRUST BANK</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="touch-target inline-flex items-center justify-center rounded-md text-text-secondary hover:bg-surface-hover"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {SIDEBAR_NAV.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="mb-1.5 px-2 text-label uppercase tracking-wide text-text-tertiary">
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
                          "touch-target flex items-center gap-3 rounded-md px-2.5 text-sm font-medium transition-colors duration-150",
                          isActive
                            ? "bg-primary-soft text-primary"
                            : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
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
          <Link
            href={SUPPORT_NAV_ITEM.href}
            onClick={onClose}
            className="touch-target flex items-center gap-3 rounded-md px-2.5 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            <SUPPORT_NAV_ITEM.icon className="h-[18px] w-[18px]" aria-hidden="true" />
            {SUPPORT_NAV_ITEM.label}
          </Link>
        </nav>
      </div>
    </div>
  );
}
