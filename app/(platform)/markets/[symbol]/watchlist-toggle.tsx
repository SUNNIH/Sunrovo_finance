"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utilities/cn";
import { toggleWatchlist } from "../actions";

export function WatchlistToggle({
  baseAsset,
  initialWatchlisted,
}: {
  baseAsset: string;
  initialWatchlisted: boolean;
}) {
  const [isWatchlisted, setIsWatchlisted] = useState(initialWatchlisted);
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    setIsToggling(true);

    // Optimistic update
    const newState = !isWatchlisted;
    setIsWatchlisted(newState);

    try {
      const result = await toggleWatchlist(baseAsset, newState);
      if (!result.success) {
        // Revert on error
        setIsWatchlisted(isWatchlisted);
      }
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isToggling}
      className={cn(
        "transition-colors",
        isWatchlisted ? "text-warning" : "text-text-tertiary hover:text-warning"
      )}
      aria-label={isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}
    >
      <Star className="h-6 w-6" fill={isWatchlisted ? "currentColor" : "none"} />
    </button>
  );
}
