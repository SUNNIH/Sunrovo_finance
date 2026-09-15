"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utilities/cn";

const CATEGORIES = [
  { id: "all", label: "All Topics" },
  { id: "accounts", label: "Accounts" },
  { id: "transfers", label: "Transfers" },
  { id: "deposits-withdrawals", label: "Deposits & Withdrawals" },
  { id: "wallets", label: "Wallets" },
  { id: "security", label: "Security" },
  { id: "profile", label: "Profile" },
] as const;

export function HelpSearchFilter() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState<string>("all");

  // Filter sections based on search and category
  React.useEffect(() => {
    // Get all FAQ sections
    const sections = document.querySelectorAll<HTMLElement>("[data-category]");

    sections.forEach((section) => {
      const category = section.dataset.category ?? "";
      const categoryMatch = activeCategory === "all" || category === activeCategory;

      if (!searchQuery.trim()) {
        // No search: show if category matches
        section.style.display = categoryMatch ? "" : "none";
        // Show all FAQ items within visible sections
        const items = section.querySelectorAll<HTMLElement>("details");
        items.forEach((item) => {
          item.style.display = "";
        });
      } else {
        // Search active: filter items within category
        const items = section.querySelectorAll<HTMLElement>("details");
        let visibleCount = 0;

        items.forEach((item) => {
          const text = item.textContent?.toLowerCase() ?? "";
          const matches = text.includes(searchQuery.toLowerCase());
          if (matches && categoryMatch) {
            item.style.display = "";
            visibleCount++;
          } else {
            item.style.display = "none";
          }
        });

        // Show section if it has visible items
        section.style.display = visibleCount > 0 ? "" : "none";
      }
    });
  }, [searchQuery, activeCategory]);

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search Input */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search help topics..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-11 pl-10 pr-10 rounded-lg border border-border bg-surface-elevated text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
          style={{ fontSize: "16px" }} // Prevent zoom on mobile
        />
        {searchQuery && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
              activeCategory === cat.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-surface border-border text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
}
