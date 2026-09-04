import { PageHeaderSkeleton, Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function MarketsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading markets">
      <PageHeaderSkeleton />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-10 w-64 max-w-full" />
      </div>
      <SkeletonTable rows={8} columns={5} />
    </div>
  );
}
