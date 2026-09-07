"use client";

import * as React from "react";
import { Sidebar } from "@/components/navigation/sidebar";
import { TopNavigation } from "@/components/navigation/top-navigation";
import { MobileBottomNavigation } from "@/components/navigation/mobile-bottom-navigation";
import { MobileNavDrawer } from "@/components/navigation/mobile-nav-drawer";

interface AppShellProps {
  children: React.ReactNode;
  userName?: string;
  userInitials?: string;
}

/**
 * Authenticated application shell: persistent sidebar + top bar on
 * desktop/tablet, bottom tab bar + slide-out drawer on mobile. See
 * design memory: "desktop/tablet/mobile" and "do not merely shrink the
 * desktop application."
 */
export function AppShell({ children, userName, userInitials }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((v) => !v)} />
      <MobileNavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavigation onOpenMobileMenu={() => setDrawerOpen(true)} userName={userName} userInitials={userInitials} />
        <main id="main-content" className="flex-1 px-4 pb-24 pt-5 sm:px-6 lg:pb-8">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
        <MobileBottomNavigation />
      </div>
    </div>
  );
}
