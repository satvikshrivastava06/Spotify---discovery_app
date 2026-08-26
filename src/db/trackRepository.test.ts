import { beforeEach, describe, expect, it } from "vitest";
import { TrackRepository } from "./trackRepository";
import { createTestExecutor } from "./testExecutor";

describe("TrackRepository", () => {
  let repo: TrackRepository;

  beforeEach(() => {
    repo = new TrackRepository(createTestExecutor());
  });

  it("returns null for a cache miss", async () => {
    const result = await repo.getCachedTrack("Ed Sheeran", "Perfect");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBeNull();
  });

  it("finds a cached track through a differently-formatted lookup", async () => {
    await repo.upsertTrack({ artist: "Ed Sheeran", title: "Perfect" });
    const result = await repo.getCachedTrack("ED SHEERAN", "perfect!!");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data?.title).toBe("Perfect");
  });

  it("upserting the same track twice updates rather than duplicates", async () => {
    await repo.upsertTrack({ artist: "Ed Sheeran", title: "Perfect" });
    await repo.upsertTrack({
      artist: "Ed Sheeran",
      title: "Perfect",
      spotifyTrackId: "abc123",
    });
    const result = await repo.getCachedTrack("Ed Sheeran", "Perfect");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data?.spotifyTrackId).toBe("abc123");
  });

  it("a later refresh never clobbers an already-resolved spotify track id", async () => {
    await repo.upsertTrack({
      artist: "Ed Sheeran",
      title: "Perfect",
      spotifyTrackId: "abc123",
    });
    await repo.upsertTrack({ artist: "Ed Sheeran", title: "Perfect" }); // no id this time
    const result = await repo.getCachedTrack("Ed Sheeran", "Perfect");
    if (result.ok) expect(result.data?.spotifyTrackId).toBe("abc123");
  });

  it("ranks results by relevance and excludes dismissed ones", async () => {
    const track = await repo.upsertTrack({ artist: "Ed Sheeran", title: "Perfect" });
    if (!track.ok) throw new Error("setup failed");
    const trackId = track.data.id;

    await repo.upsertTrackResults(trackId, [
      {
        youtubeVideoId: "aaa",
        title: "Perfect (Acoustic)",
        channelId: "c1",
        channelName: "Ed Sheeran",
        thumbnailUrl: "https://example.com/a.jpg",
        viewCount: 100,
        publishedAt: null,
        versionType: "acoustic",
        isOfficialChannel: true,
        relevanceScore: 0.9,
      },
      {
        youtubeVideoId: "bbb",
        title: "Perfect (Live)",
        channelId: "c2",
        channelName: "Random Fan",
        thumbnailUrl: "https://example.com/b.jpg",
        viewCount: 50,
        publishedAt: null,
        versionType: "live",
        isOfficialChannel: false,
        relevanceScore: 0.4,
      },
    ]);

    const ranked = await repo.getTrackResults(trackId);
    expect(ranked.ok).toBe(true);
    if (ranked.ok) {
      expect(ranked.data).toHaveLength(2);
      expect(ranked.data[0].youtubeVideoId).toBe("aaa");
    }

    await repo.dismissResult(trackId, "aaa");
    const afterDismiss = await repo.getTrackResults(trackId);
    if (afterDismiss.ok) {
      expect(afterDismiss.data).toHaveLength(1);
      expect(afterDismiss.data[0].youtubeVideoId).toBe("bbb");
    }
  });

  it("re-searching the same video updates its score instead of duplicating the row", async () => {
    const track = await repo.upsertTrack({ artist: "Ed Sheeran", title: "Perfect" });
    if (!track.ok) throw new Error("setup failed");
    const trackId = track.data.id;
    const base = {
      youtubeVideoId: "aaa",
      title: "Perfect (Acoustic)",
      channelId: "c1",
      channelName: "Ed Sheeran",
      thumbnailUrl: "https://example.com/a.jpg",
      viewCount: 100,
      publishedAt: null,
      versionType: "acoustic" as const,
      isOfficialChannel: true,
      relevanceScore: 0.5,
    };
    await repo.upsertTrackResults(trackId, [base]);
    await repo.upsertTrackResults(trackId, [{ ...base, relevanceScore: 0.95 }]);

    const results = await repo.getTrackResults(trackId);
    if (results.ok) {
      expect(results.data).toHaveLength(1);
      expect(results.data[0].relevanceScore).toBe(0.95);
    }
  });

  it("dismissing a result that doesn't exist returns NOT_FOUND", async () => {
    const track = await repo.upsertTrack({ artist: "Ed Sheeran", title: "Perfect" });
    if (!track.ok) throw new Error("setup failed");
    const result = await repo.dismissResult(track.data.id, "does-not-exist");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("TTL cleanup cascades to that track's results", async () => {
    const track = await repo.upsertTrack({ artist: "Ed Sheeran", title: "Perfect" });
    if (!track.ok) throw new Error("setup failed");
    const trackId = track.data.id;
    await repo.upsertTrackResults(trackId, [
      {
        youtubeVideoId: "aaa",
        title: "Perfect (Acoustic)",
        channelId: "c1",
        channelName: "Ed Sheeran",
        thumbnailUrl: "https://example.com/a.jpg",
        viewCount: 100,
        publishedAt: null,
        versionType: "acoustic",
        isOfficialChannel: true,
        relevanceScore: 0.9,
      },
    ]);

    // Negative TTL = "cutoff is in the future" = every current row is
    // treated as expired, without needing to fake timestamps.
    const cleaned = await repo.cleanupExpiredTracks(-1);
    expect(cleaned.ok).toBe(true);
    if (cleaned.ok) expect(cleaned.data).toBeGreaterThanOrEqual(1);

    const afterCleanup = await repo.getTrackResults(trackId);
    if (afterCleanup.ok) expect(afterCleanup.data).toHaveLength(0);
  });
});
