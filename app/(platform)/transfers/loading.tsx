import { PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function TransfersLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading transfer">
      <PageHeaderSkeleton />
      <div className="w-full max-w-2xl rounded-lg border border-border bg-surface-elevated p-6 shadow-sm">
        <Skeleton className="h-6 w-32" />
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
        <Skeleton className="mt-6 h-12 w-28" />
      </div>
    </div>
  );
}
