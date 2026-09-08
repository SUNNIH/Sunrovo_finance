import { Skeleton } from "@/components/ui/skeleton";

export default function SecurityLoading() {
  return (
    <div className="flex flex-col gap-8 max-w-4xl" aria-busy="true" aria-label="Loading security settings">
      {/* Header skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48 sm:h-9" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      {/* Section 1 Skeleton */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-60" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-10 w-36 rounded-md mt-2" />
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-xs flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-10 w-full max-w-sm rounded-md" />
        </div>
      </div>

      {/* Section 2 Skeleton */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-3 w-72 max-w-full" />
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-80" />
        </div>
      </div>
    </div>
  );
}
