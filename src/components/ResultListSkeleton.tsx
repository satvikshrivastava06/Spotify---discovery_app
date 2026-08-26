function SkeletonCard() {
  return (
    <div className="flex gap-3 rounded-card border border-graphite bg-graphite/50 p-3">
      <div className="h-14 w-14 flex-shrink-0 animate-pulse rounded-sm bg-graphite" />
      <div className="min-w-0 flex-1 space-y-2 py-0.5">
        <div className="h-4 w-3/4 animate-pulse rounded-sm bg-graphite" />
        <div className="h-3 w-1/2 animate-pulse rounded-sm bg-graphite" />
        <div className="h-3 w-1/4 animate-pulse rounded-sm bg-graphite" />
      </div>
    </div>
  );
}

export function ResultListSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading results" role="status">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
