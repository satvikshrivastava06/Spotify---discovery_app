import type { SqlExecutor } from "./executor";
import { type CommandResult, err, ok } from "./result";

export type ApiName = "youtube" | "spotify";

const DAILY_LIMITS: Record<ApiName, number> = {
  // YouTube: 10,000 units/day per project, search.list = 100 units (Phase 2/3).
  youtube: 10_000,
  // Spotify's Client Credentials calls aren't unit-metered the way
  // YouTube's are — usage is still recorded here to spot abnormal spikes,
  // not to gate calls against a hard budget.
  spotify: Number.POSITIVE_INFINITY,
};

export class ApiUsageRepository {
  constructor(private db: SqlExecutor) {}

  // YouTube's quota resets at midnight Pacific Time, not UTC. Using
  // toISOString()'s UTC date here would drift the app's internal "day"
  // boundary away from when the quota actually resets — for anyone west
  // of UTC, by up to 7-8 hours depending on DST. Concretely: at 7pm
  // Pacific (2am UTC the next day), the UTC-based version would think a
  // new day had started and let the app spend a fresh budget against
  // internal tracking, while YouTube's real quota wouldn't reset for
  // another five hours — the app would keep issuing calls that then fail
  // with a real 403, exactly what this tracker exists to prevent.
  // Intl.DateTimeFormat handles the PST/PDT transition automatically; a
  // fixed UTC-7/-8 offset would not.
  private today(): string {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()); // en-CA locale formats as YYYY-MM-DD
  }

  async getUsage(api: ApiName): Promise<CommandResult<{ used: number; limit: number }>> {
    try {
      const rows = await this.db.select<{ units_used: number }>(
        "SELECT units_used FROM api_usage WHERE api_name = ? AND usage_date = ?",
        [api, this.today()],
      );
      return ok({ used: rows[0]?.units_used ?? 0, limit: DAILY_LIMITS[api] });
    } catch (e) {
      return err("UNKNOWN", `getUsage failed: ${String(e)}`);
    }
  }

  /**
   * Records `units` of usage and returns `true` — unless doing so would
   * exceed today's budget, in which case it returns `false` and leaves
   * usage unchanged. This is the proactive stop from Phase 2's rate
   * limiting design: the caller checks this *before* making the actual
   * YouTube/Spotify call, so quota is never spent on a request that was
   * going to be refused anyway.
   */
  async tryRecordUsage(api: ApiName, units: number): Promise<CommandResult<boolean>> {
    try {
      const usage = await this.getUsage(api);
      if (!usage.ok) return usage;
      if (usage.data.used + units > usage.data.limit) {
        return ok(false);
      }
      await this.db.execute(
        `INSERT INTO api_usage (api_name, usage_date, units_used) VALUES (?, ?, ?)
         ON CONFLICT(api_name, usage_date) DO UPDATE SET units_used = units_used + ?`,
        [api, this.today(), units, units],
      );
      return ok(true);
    } catch (e) {
      return err("UNKNOWN", `tryRecordUsage failed: ${String(e)}`);
    }
  }
}
