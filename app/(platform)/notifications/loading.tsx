import { Skeleton, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />

      {/* Info notice skeleton */}
      <div className="rounded-xl border border-border bg-surface-elevated p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="h-3 w-80 max-w-full" />
          </div>
        </div>
      </div>

      {/* Filter tabs and mark all read action skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Skeleton className="h-9 w-16 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Notification items list skeleton */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface-elevated divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2 min-w-0">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-3 w-16 ml-auto" />
                </div>
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-full max-w-md" />
              </div>
            </div>
            <Skeleton className="h-9 w-28 rounded-md sm:self-center shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
