import { Skeleton } from "@pl/ui";

export default function LeaderboardLoading() {
  return (
    <div className="light-route leaderboard-route animate-pulse space-y-6">
      <div className="leaderboard-heading">
        <header>
          <Skeleton className="h-4 w-36 rounded mb-2" />
          <Skeleton className="h-10 w-56 rounded-lg mb-2" />
          <Skeleton className="h-4 w-44 rounded" />
        </header>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-48 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>

      <div className="h-72 w-full rounded-2xl bg-black/[0.04] p-6 border border-black/5 flex items-end justify-center gap-6">
        <Skeleton className="h-36 w-32 rounded-t-xl" />
        <Skeleton className="h-48 w-36 rounded-t-xl" />
        <Skeleton className="h-28 w-32 rounded-t-xl" />
      </div>

      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 rounded-xl border border-black/5 bg-black/[0.02]"
          >
            <div className="flex items-center gap-4">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-4 w-32 rounded" />
            </div>
            <div className="flex gap-6">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
