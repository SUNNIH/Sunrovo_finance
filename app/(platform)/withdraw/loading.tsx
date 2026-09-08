import { Skeleton } from "@/components/ui/skeleton";

export default function WithdrawLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading withdrawal form">
      {/* Header skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40 sm:h-9" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="w-full max-w-xl">
        {/* Tab switcher skeleton */}
        <div className="mb-6 flex rounded-xl border border-border/80 bg-surface p-1.5 shadow-xs">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 flex-1 rounded-lg" />
        </div>

        {/* Card skeleton */}
        <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
            <Skeleton className="h-11 w-full rounded-lg mt-2" />
          </div>
        </div>
      </div>
    </div>
  );
}
