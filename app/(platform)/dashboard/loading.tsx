import { PageHeaderSkeleton, Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading dashboard">
      {/* Page header */}
      <PageHeaderSkeleton />

      {/* Balance overview */}
      <div className="rounded-xl border border-border bg-surface-elevated p-5 shadow-sm sm:p-6">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-10 w-64" />
        <Skeleton className="mt-2 h-3 w-48" />
        <div className="mt-5 flex flex-wrap gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      {/* Accounts & Wallets section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-xl border border-border bg-surface-elevated shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-16" />
        </div>
        {/* Activity rows */}
        <div className="divide-y divide-border border-t border-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
              <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-1.5 h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-20 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
