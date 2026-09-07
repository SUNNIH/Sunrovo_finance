"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utilities/cn";

interface ThemeToggleProps {
  className?: string;
}

/**
 * Light/dark theme toggle. Renders a neutral placeholder until mounted to
 * avoid a hydration mismatch (next-themes reads localStorage/OS
 * preference on the client only).
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={mounted ? (isDark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
      aria-pressed={mounted ? isDark : undefined}
      className={cn(
        "touch-target inline-flex items-center justify-center rounded-md border border-border",
        "bg-surface text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary",
        className
      )}
    >
      {mounted && isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
