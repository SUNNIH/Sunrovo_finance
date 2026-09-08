import { Skeleton } from "@/components/ui/skeleton";

export default function AccountsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading accounts">
      {/* Header Skeleton with Currency Summary Cards */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-7 w-36 sm:h-8" />
          <Skeleton className="h-4 w-60" />
        </div>
        <div className="flex flex-wrap gap-2.5 sm:gap-3">
          <div className="min-w-[9rem] flex-1 rounded-xl border border-border bg-surface-elevated px-4 py-2.5 sm:min-w-[10.5rem]">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-6 w-24" />
          </div>
          <div className="min-w-[9rem] flex-1 rounded-xl border border-border bg-surface-elevated px-4 py-2.5 sm:min-w-[10.5rem]">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-6 w-24" />
          </div>
        </div>
      </div>

      {/* Account Cards Grid Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((index) => (
          <div
            key={index}
            className="flex flex-col justify-between rounded-xl border border-border bg-surface-elevated p-5 sm:p-6"
          >
            <div>
              {/* Card Header: Icon + Title & Type + Badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                {index === 1 && <Skeleton className="h-5 w-16 rounded-full" />}
              </div>

              {/* Balance block skeleton */}
              <div className="my-5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2 h-8 w-44" />
              </div>

              {/* Account number box skeleton */}
              <div className="rounded-lg border border-border/80 bg-surface/60 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Skeleton className="h-2.5 w-20" />
                  <Skeleton className="h-2.5 w-12" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <div className="flex gap-1">
                    <Skeleton className="h-6 w-6 rounded" />
                    <Skeleton className="h-6 w-6 rounded" />
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons skeleton */}
            <div className="mt-6 border-t border-border/60 pt-4">
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-9 w-full rounded-md" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
