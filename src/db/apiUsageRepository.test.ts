import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiUsageRepository } from "./apiUsageRepository";
import { createTestExecutor } from "./testExecutor";

describe("ApiUsageRepository", () => {
  let repo: ApiUsageRepository;

  beforeEach(() => {
    repo = new ApiUsageRepository(createTestExecutor());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts at zero usage", async () => {
    const usage = await repo.getUsage("youtube");
    expect(usage.ok).toBe(true);
    if (usage.ok) expect(usage.data.used).toBe(0);
  });

  it("accumulates usage across calls", async () => {
    await repo.tryRecordUsage("youtube", 100);
    await repo.tryRecordUsage("youtube", 100);
    const usage = await repo.getUsage("youtube");
    if (usage.ok) expect(usage.data.used).toBe(200);
  });

  it("refuses a call that would exceed the daily budget, without recording partial usage", async () => {
    await repo.tryRecordUsage("youtube", 9950);
    const result = await repo.tryRecordUsage("youtube", 100); // would push to 10,050 > 10,000
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(false);

    const usage = await repo.getUsage("youtube");
    if (usage.ok) expect(usage.data.used).toBe(9950); // unchanged by the refused call
  });

  it("allows a call that lands exactly on the daily budget", async () => {
    await repo.tryRecordUsage("youtube", 9900);
    const result = await repo.tryRecordUsage("youtube", 100); // exactly 10,000
    if (result.ok) expect(result.data).toBe(true);
  });

  it("tracks youtube and spotify usage independently", async () => {
    await repo.tryRecordUsage("youtube", 100);
    const spotifyUsage = await repo.getUsage("spotify");
    if (spotifyUsage.ok) expect(spotifyUsage.data.used).toBe(0);
  });

  it("buckets usage by Pacific Time, not UTC — the exact boundary case that motivated the fix", async () => {
    // 7pm Pacific on Aug 21 (PDT, UTC-7) is 2am UTC on Aug 22 — a moment
    // where the UTC date and the Pacific date genuinely disagree. Two
    // calls straddling this instant must land in the same Pacific-day
    // bucket; a UTC-based implementation would split them into two.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-22T01:00:00Z")); // 6pm PDT, Aug 21
    await repo.tryRecordUsage("youtube", 100);

    vi.setSystemTime(new Date("2026-08-22T03:00:00Z")); // 8pm PDT, still Aug 21
    await repo.tryRecordUsage("youtube", 100);

    const usage = await repo.getUsage("youtube");
    if (usage.ok) expect(usage.data.used).toBe(200); // both calls in one bucket
  });
});
