import { Skeleton } from "@pl/ui";

export default function PortfolioLoading() {
  return (
    <div className="light-route portfolio-route animate-pulse space-y-6">
      <header className="portfolio-heading">
        <Skeleton className="h-4 w-44 rounded mb-2" />
        <Skeleton className="h-10 w-60 rounded-lg mb-2" />
        <Skeleton className="h-4 w-72 rounded" />
      </header>

      <div className="h-36 w-full rounded-2xl bg-black/[0.04] p-6 border border-black/5 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-8 w-48 rounded" />
        </div>
        <div className="flex gap-8">
          <div className="space-y-1">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-6 w-24 rounded" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-6 w-24 rounded" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl border border-black/5 bg-black/[0.02] p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-64 rounded" />
                <Skeleton className="h-3 w-36 rounded" />
              </div>
            </div>
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
