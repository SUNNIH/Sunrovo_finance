import { Skeleton } from "@/components/ui/skeleton";

export default function BeneficiariesLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading beneficiaries">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-8 w-56 sm:h-9" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      {/* Search & Actions bar skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-full max-w-xs rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>

      {/* Beneficiaries Grid Skeleton */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-4 rounded-xl border border-border bg-surface-elevated p-4 sm:p-5"
          >
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
