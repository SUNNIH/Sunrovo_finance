import { Skeleton } from "@/components/ui/skeleton";

export default function TradeLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-6" aria-busy="true" aria-label="Loading trade">
      {/* Spot Trading, Long / Short and Convert tabs */}
      <div className="flex items-center gap-4 border-b border-border">
        {["w-24", "w-28", "w-14"].map((width) => (
          <div key={width} className="min-w-0 flex-1 px-2 py-3 sm:flex-none sm:px-4">
            <Skeleton className={`h-5 max-w-full ${width}`} />
          </div>
        ))}
      </div>

      {/* Pair selector and current price */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-40 sm:h-9" />
            <Skeleton className="h-5 w-5 shrink-0" />
          </div>
          <Skeleton className="mt-1 h-4 w-72 max-w-full" />
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex items-baseline gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-4 w-10" />
          </div>
          <Skeleton className="h-5 w-28" />
        </div>
      </div>

      {/* Price chart: match the live chart's 600px canvas */}
      <div className="min-w-0 rounded-lg border border-border bg-surface-elevated shadow-sm">
        <div className="p-4 sm:p-5">
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="min-w-0 space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
            <div className="flex max-w-full flex-wrap items-center gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-10 shrink-0 sm:w-12" />
              ))}
            </div>
            <Skeleton className="h-8 w-44" />
          </div>
          <Skeleton className="h-[600px] w-full rounded-lg" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      </div>

      {/* Default spot order form */}
      <div className="space-y-6 rounded-lg border border-border bg-surface-elevated p-6 shadow-sm">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
          </div>
        ))}
        <div className="space-y-4">
          <Skeleton className="h-4 w-44 max-w-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-3 rounded-md border border-border p-4">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 shrink-0" />
                <Skeleton className="h-4 w-44 max-w-full" />
              </div>
            ))}
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2 border-t border-border pt-4">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-3 w-full max-w-lg" />
        </div>
      </div>

      {/* Current Orders and Order History */}
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="rounded-lg border border-border bg-surface-elevated shadow-sm">
          <div className="flex items-center justify-between p-4 sm:p-5">
            <Skeleton className="h-5 w-32" />
            {index === 0 && <Skeleton className="h-5 w-8 rounded-full" />}
          </div>
          <div className="p-4 pt-0 sm:p-5 sm:pt-0">
            <div className="flex justify-center py-8">
              <Skeleton className="h-4 w-56 max-w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
