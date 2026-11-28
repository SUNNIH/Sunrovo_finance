"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

export function MarketsSearch({ initialSearch }: { initialSearch: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);

  const handleSearch = (value: string) => {
    setSearch(value);

    startTransition(() => {
      const params = new URLSearchParams();
      if (value) {
        params.set("search", value);
      }
      const query = params.toString();
      router.push(`/markets${query ? `?${query}` : ""}`);
    });
  };

  const clearSearch = () => {
    handleSearch("");
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          placeholder="Search markets (e.g., BTC, ETH, USDT)..."
          value={search}
          onChange={(e) => handleSearch(e.target.value.toUpperCase())}
          className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-10 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {search && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {isPending && (
        <p className="mt-2 text-xs text-text-tertiary">Searching...</p>
      )}
    </div>
  );
}
