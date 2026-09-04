import { PageHeaderSkeleton, Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function WalletsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading wallets">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeaderSkeleton />
        <Skeleton className="h-16 w-40" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-11 w-24" />
        <Skeleton className="h-11 w-20" />
        <Skeleton className="h-11 w-24" />
      </div>
      <SkeletonTable rows={5} columns={4} />
    </div>
  );
}
