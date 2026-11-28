import { Skeleton } from "@/components/ui/skeleton";

export default function MarketsLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-6" aria-busy="true" aria-label="Loading markets">
      {/* Markets page header */}
      <div>
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-1 h-8 w-36 sm:h-9" />
        <Skeleton className="mt-1 h-4 w-96 max-w-full" />
      </div>

      {/* Available Markets, Top Gainer and Top Loser */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-border bg-surface-elevated shadow-sm">
            <div className="flex items-center gap-2 p-4 pb-3 sm:p-5 sm:pb-3">
              {index > 0 && <Skeleton className="h-4 w-4 shrink-0" />}
              <Skeleton className="h-4 w-36 max-w-full" />
            </div>
            <div className="p-4 pt-0 sm:p-5 sm:pt-0">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="mt-1 h-3 w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* Search field */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
        <Skeleton className="h-4 w-4 shrink-0" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>

      {/* Match the desktop market table and mobile market cards */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full" aria-hidden="true">
            <thead>
              <tr className="border-b border-border bg-surface-elevated">
                <th className="px-4 py-3"><Skeleton className="h-3 w-20" /></th>
                <th className="px-4 py-3"><Skeleton className="ml-auto h-3 w-16" /></th>
                <th className="px-4 py-3"><Skeleton className="ml-auto h-3 w-16" /></th>
                <th className="px-4 py-3"><Skeleton className="ml-auto h-3 w-16" /></th>
                <th className="px-4 py-3"><Skeleton className="mx-auto h-3 w-12" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Array.from({ length: 6 }).map((_, index) => (
                <tr key={index}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 shrink-0" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-16" /></td>
                  <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="mx-auto h-5 w-14 rounded" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-border sm:hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1.5">
                  <Skeleton className="h-4 w-24 max-w-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-4 w-4" />
                </div>
              </div>
              <div className="space-y-1">
                {Array.from({ length: 2 }).map((_, row) => (
                  <div key={row} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
