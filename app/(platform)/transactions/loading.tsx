import { PageHeaderSkeleton, Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function TransactionsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading transactions">
      <PageHeaderSkeleton />
      <div className="rounded-lg border border-border bg-surface-elevated p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>
      <SkeletonTable rows={8} columns={5} />
    </div>
  );
}
