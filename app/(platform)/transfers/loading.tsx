import { Skeleton } from "@/components/ui/skeleton";

export default function TransfersLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading transfer">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-8 w-48 sm:h-9" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      {/* Stepper Skeleton */}
      <div className="w-full max-w-2xl flex items-center justify-between gap-2 px-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-1 items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <Skeleton className="h-3 w-16 hidden sm:block" />
            {i < 4 && <Skeleton className="h-0.5 flex-1 mx-1 hidden sm:block" />}
          </div>
        ))}
      </div>

      {/* Wizard Card Skeleton */}
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm">
        <Skeleton className="h-6 w-36 mb-4" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
        <div className="mt-6 flex justify-end">
          <Skeleton className="h-11 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
