import { Skeleton } from "@/components/ui/skeleton";

export default function SupportLoading() {
  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      {/* Header skeleton */}
      <div>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-full max-w-lg mt-2" />
      </div>

      {/* Search skeleton */}
      <div className="flex flex-col gap-4">
        <Skeleton className="h-11 w-full" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-8 w-32 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      </div>

      {/* Alert skeleton */}
      <Skeleton className="h-24 w-full rounded-lg" />

      {/* Quick links skeleton */}
      <div>
        <Skeleton className="h-4 w-32 mb-3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>

      {/* FAQ sections skeleton */}
      {[...Array(3)].map((_, i) => (
        <div key={i}>
          <div className="flex items-center gap-2.5 mb-4">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, j) => (
              <Skeleton key={j} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ))}

      {/* Contact card skeleton */}
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}
