import { PageHeaderSkeleton, Skeleton, SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading dashboard">
      <PageHeaderSkeleton />
      <div className="rounded-lg border border-border bg-surface-elevated p-5 shadow-sm">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-3 h-9 w-56" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonTable rows={5} columns={3} />
    </div>
  );
}
