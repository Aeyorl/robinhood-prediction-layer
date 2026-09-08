import { Skeleton } from "@pl/ui";

export default function MarketsLoading() {
  return (
    <div className="market-directory space-y-6 animate-pulse">
      <div className="market-signals-heading">
        <div>
          <Skeleton className="h-4 w-32 rounded mb-2" />
          <Skeleton className="h-10 w-64 rounded-lg mb-2" />
          <Skeleton className="h-4 w-48 rounded" />
        </div>
        <div className="market-signal-toolbar flex gap-2">
          <Skeleton className="h-11 w-48 rounded-lg" />
          <Skeleton className="h-11 w-36 rounded-lg" />
          <Skeleton className="h-11 w-28 rounded-lg" />
        </div>
      </div>

      <div className="h-64 w-full rounded-2xl bg-white/[0.04] p-6 flex flex-col justify-between border border-white/5">
        <Skeleton className="h-6 w-40 rounded" />
        <Skeleton className="h-10 w-3/4 rounded" />
        <div className="flex gap-4">
          <Skeleton className="h-12 w-32 rounded-lg" />
          <Skeleton className="h-12 w-32 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-2xl border border-white/5 bg-white/[0.03] p-5 flex flex-col justify-between"
          >
            <div className="flex justify-between items-start">
              <Skeleton className="h-8 w-20 rounded" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-10 w-full rounded" />
            <div className="flex justify-between items-center pt-2 border-t border-white/5">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
