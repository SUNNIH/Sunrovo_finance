import { PageHeaderSkeleton, Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function DepositLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading deposit options">
      <PageHeaderSkeleton />
      <div className="max-w-xl">
        <Skeleton className="mb-4 h-12 w-full rounded-xl" />
        <SkeletonCard className="h-96 w-full rounded-2xl" />
      </div>
    </div>
  );
}
