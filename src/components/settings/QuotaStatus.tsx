import { useQuotaStatus } from "../../hooks/useQuotaStatus";

export function QuotaStatus() {
  const quota = useQuotaStatus();
  if (!quota) return null;

  const percentUsed = Math.min(100, Math.round((quota.used / quota.limit) * 100));

  return (
    <section className="mt-6">
      <p className="text-sm font-medium">Today's YouTube search usage</p>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-graphite"
        role="progressbar"
        aria-valuenow={percentUsed}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="YouTube quota used today"
      >
        <div className="h-full bg-tape transition-[width]" style={{ width: `${percentUsed}%` }} />
      </div>
      <p className="mt-1 font-mono text-xs text-paper-muted">
        {quota.used.toLocaleString()} / {quota.limit.toLocaleString()} units
      </p>
    </section>
  );
}
