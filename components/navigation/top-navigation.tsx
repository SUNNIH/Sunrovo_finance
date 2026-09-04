"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Bell, LogOut, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { DemoEnvironmentBadge } from "@/components/layout/demo-environment-badge";
import { cn } from "@/lib/utilities/cn";

interface TopNavigationProps {
  onOpenMobileMenu: () => void;
  userName?: string;
  userInitials?: string;
}

export function TopNavigation({ onOpenMobileMenu, userName, userInitials = "U" }: TopNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [signingOut, setSigningOut] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((payload) => {
        if (!cancelled) setUnreadCount(payload.data?.unreadCount ?? 0);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function handleSignOut() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface-elevated/95 px-4 backdrop-blur safe-area-top sm:px-6">
      <button
        type="button"
        onClick={onOpenMobileMenu}
        aria-label="Open menu"
        className="touch-target -ml-2 inline-flex items-center justify-center rounded-md text-text-secondary hover:bg-surface-hover hover:text-text-primary lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative hidden max-w-sm flex-1 md:block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search accounts, coins, pairs..."
          aria-label="Search"
          className={cn(
            "h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text-primary",
            "placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        />
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <DemoEnvironmentBadge />
        <ThemeToggle />
        <Link
          href="/notifications"
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
          className="touch-target relative inline-flex items-center justify-center rounded-md border border-border bg-surface text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className="absolute right-1 top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-danger px-0.5 text-[9px] font-semibold text-white"
              aria-hidden="true"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
        <Link href="/deposit">
          <Button variant="primary" size="sm" className="hidden sm:inline-flex">
            Deposit
          </Button>
        </Link>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account menu"
            title={userName}
            className="touch-target flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary transition-colors duration-150 hover:bg-primary-soft/80"
          >
            {userInitials}
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-hidden="true"
                tabIndex={-1}
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div
                role="menu"
                className="absolute right-0 z-50 mt-2 w-48 rounded-md border border-border bg-surface-elevated py-1 shadow-lg"
              >
                {userName && (
                  <p className="truncate border-b border-border px-3 py-2 text-body-sm text-text-secondary">
                    {userName}
                  </p>
                )}
                <Link
                  href="/profile"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-sm text-text-primary hover:bg-surface-hover"
                >
                  Profile
                </Link>
                <Link
                  href="/security"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-sm text-text-primary hover:bg-surface-hover"
                >
                  Security
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-surface-hover"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {signingOut ? "Signing out..." : "Sign out"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
