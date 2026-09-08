"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Check, Laptop, Moon, Palette, Sun } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utilities/cn";

export function ThemePreferenceCard() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const themeOptions = [
    {
      id: "system",
      label: "System Default",
      description: "Automatically match your operating system theme settings.",
      icon: Laptop,
      previewBg: "bg-gradient-to-r from-surface to-background border-border",
    },
    {
      id: "light",
      label: "Light Mode",
      description: "Crisp white and navy design optimized for daytime readability.",
      icon: Sun,
      previewBg: "bg-white text-slate-900 border-slate-200",
    },
    {
      id: "dark",
      label: "Dark Mode",
      description: "Deep navy and black palette designed for low-light environments.",
      icon: Moon,
      previewBg: "bg-slate-950 text-slate-100 border-slate-800",
    },
  ];

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Palette className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-text-primary">Appearance &amp; Theme</CardTitle>
            <CardDescription className="text-xs text-text-secondary mt-0.5">
              Select your preferred visual style for the Platinum Trust Bank interface.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {themeOptions.map((opt) => {
            const isSelected = mounted && (theme === opt.id || (!theme && opt.id === "system"));
            const IconComponent = opt.icon;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                className={cn(
                  "group relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all cursor-pointer touch-target",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  isSelected
                    ? "border-primary bg-primary-soft/30 ring-1 ring-primary/40 shadow-xs"
                    : "border-border bg-surface hover:border-border-strong hover:bg-surface-hover/60"
                )}
                aria-pressed={isSelected}
                aria-label={`Select ${opt.label}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface-hover text-text-secondary group-hover:text-text-primary"
                      )}
                    >
                      <IconComponent className="h-4 w-4" aria-hidden="true" />
                    </div>
                    {isSelected && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-sm font-semibold text-text-primary">
                    {opt.label}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                    {opt.description}
                  </p>
                </div>

                {/* Miniature UI visual preview swatch */}
                <div
                  className={cn(
                    "mt-4 flex h-8 items-center gap-1.5 rounded-md border px-2.5 shadow-2xs",
                    opt.previewBg
                  )}
                  aria-hidden="true"
                >
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="h-1.5 w-12 rounded bg-current opacity-30" />
                  <span className="h-1.5 w-6 rounded bg-current opacity-20 ml-auto" />
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
