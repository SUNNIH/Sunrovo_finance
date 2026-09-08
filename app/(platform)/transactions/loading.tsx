import { PageHeaderSkeleton, Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function TransactionsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading transactions">
      <PageHeaderSkeleton />
      <div className="rounded-xl border border-border/80 bg-surface-elevated p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <div className="flex flex-wrap gap-2.5">
            <Skeleton className="h-10 w-36 rounded-lg" />
            <Skeleton className="h-10 w-36 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
        </div>
      </div>
      <SkeletonTable rows={8} columns={6} />
    </div>
  );
}
