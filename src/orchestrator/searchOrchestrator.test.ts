import { beforeEach, describe, expect, it } from "vitest";
import { ApiUsageRepository } from "../db/apiUsageRepository";
import { createTestExecutor } from "../db/testExecutor";
import { TrackRepository } from "../db/trackRepository";
import type { Credentials, CredentialsProvider } from "./credentialsProvider";
import { FakeHttpClient, jsonResponse } from "./fakeHttpClient";
import { SearchOrchestrator } from "./searchOrchestrator";

function fakeCredentials(overrides: Partial<Credentials> = {}): CredentialsProvider {
  const creds: Credentials = {
    youtubeApiKey: "fake-yt-key",
    spotifyClientId: "fake-client-id",
    spotifyClientSecret: "fake-client-secret",
    ...overrides,
  };
  return { getCredentials: async () => creds };
}

function youtubeItem(videoId: string, title: string) {
  return {
    id: { videoId },
    snippet: {
      title,
      channelId: "c1",
      channelTitle: "Ed Sheeran",
      publishedAt: "2017-03-03T00:00:00Z",
      thumbnails: { medium: { url: `https://example.com/${videoId}.jpg` } },
    },
  };
}

describe("SearchOrchestrator", () => {
  let trackRepo: TrackRepository;
  let apiUsageRepo: ApiUsageRepository;
  let http: FakeHttpClient;

  beforeEach(() => {
    const executor = createTestExecutor();
    trackRepo = new TrackRepository(executor);
    apiUsageRepo = new ApiUsageRepository(executor);
    http = new FakeHttpClient();
  });

  function setUpSuccessfulApis() {
    http.onGet("youtube/v3/search", (_url, params) => {
      if (params.q.includes("acoustic")) {
        return jsonResponse(200, { items: [youtubeItem("acoustic1", "Perfect (Acoustic)")] });
      }
      if (params.q.includes("live")) {
        return jsonResponse(200, { items: [youtubeItem("live1", "Perfect (Live)")] });
      }
      return jsonResponse(200, { items: [] });
    });
    http.onGet("youtube/v3/videos", () =>
      jsonResponse(200, {
        items: [
          { id: "acoustic1", statistics: { viewCount: "100000" } },
          { id: "live1", statistics: { viewCount: "50000" } },
        ],
      }),
    );
    http.onPost("accounts.spotify.com/api/token", () =>
      jsonResponse(200, { access_token: "tok", expires_in: 3600 }),
    );
    http.onGet("api.spotify.com/v1/search", () => jsonResponse(200, { tracks: { items: [] } }));
  }

  it("returns an error without any HTTP calls when no YouTube key is configured", async () => {
    const orchestrator = new SearchOrchestrator(
      trackRepo,
      apiUsageRepo,
      fakeCredentials({ youtubeApiKey: null }),
      http,
    );
    const result = await orchestrator.searchTrackVersions("Ed Sheeran", "Perfect");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_INPUT");
    expect(http.getCalls).toHaveLength(0);
  });

  it("runs the full pipeline on a cache miss and persists results", async () => {
    setUpSuccessfulApis();
    const orchestrator = new SearchOrchestrator(trackRepo, apiUsageRepo, fakeCredentials(), http);
    const result = await orchestrator.searchTrackVersions("Ed Sheeran", "Perfect");

    expect(result.ok).toBe(true);
    if (result.ok) {
      const ids = result.data.map((r) => r.youtubeVideoId).sort();
      expect(ids).toEqual(["acoustic1", "live1"]);
      const acoustic = result.data.find((r) => r.youtubeVideoId === "acoustic1");
      expect(acoustic?.versionType).toBe("acoustic");
      expect(acoustic?.viewCount).toBe(100000);
    }
  });

  it("serves the second call for the same track from cache, with no further HTTP calls", async () => {
    setUpSuccessfulApis();
    const orchestrator = new SearchOrchestrator(trackRepo, apiUsageRepo, fakeCredentials(), http);
    await orchestrator.searchTrackVersions("Ed Sheeran", "Perfect");
    const callsAfterFirst = http.getCalls.length + http.postCalls.length;

    const second = await orchestrator.searchTrackVersions("ED SHEERAN", "perfect!!"); // differently formatted
    expect(second.ok).toBe(true);
    expect(http.getCalls.length + http.postCalls.length).toBe(callsAfterFirst); // unchanged
  });

  it("shows YouTube results unfiltered when no Spotify credentials are configured", async () => {
    setUpSuccessfulApis();
    const orchestrator = new SearchOrchestrator(
      trackRepo,
      apiUsageRepo,
      fakeCredentials({ spotifyClientId: null, spotifyClientSecret: null }),
      http,
    );
    const result = await orchestrator.searchTrackVersions("Ed Sheeran", "Perfect");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(2);
    expect(http.postCalls).toHaveLength(0); // never attempted a Spotify token fetch
  });

  it("falls back to unfiltered YouTube results when the Spotify catalog check fails", async () => {
    http.onGet("youtube/v3/search", (_url, params) =>
      params.q.includes("acoustic")
        ? jsonResponse(200, { items: [youtubeItem("acoustic1", "Perfect (Acoustic)")] })
        : jsonResponse(200, { items: [] }),
    );
    http.onGet("youtube/v3/videos", () =>
      jsonResponse(200, { items: [{ id: "acoustic1", statistics: { viewCount: "1000" } }] }),
    );
    http.onPost("accounts.spotify.com/api/token", () => jsonResponse(500, {})); // Spotify is down

    const orchestrator = new SearchOrchestrator(trackRepo, apiUsageRepo, fakeCredentials(), http);
    const result = await orchestrator.searchTrackVersions("Ed Sheeran", "Perfect");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.map((r) => r.youtubeVideoId)).toContain("acoustic1");
  });

  it("filters out a candidate that dedup confirms is already on Spotify", async () => {
    http.onGet("youtube/v3/search", (_url, params) =>
      params.q.includes("acoustic")
        ? jsonResponse(200, { items: [youtubeItem("acoustic1", "Perfect (Acoustic Version)")] })
        : jsonResponse(200, { items: [] }),
    );
    http.onGet("youtube/v3/videos", () =>
      jsonResponse(200, { items: [{ id: "acoustic1", statistics: { viewCount: "1000" } }] }),
    );
    http.onPost("accounts.spotify.com/api/token", () =>
      jsonResponse(200, { access_token: "tok", expires_in: 3600 }),
    );
    http.onGet("api.spotify.com/v1/search", () =>
      jsonResponse(200, {
        tracks: { items: [{ id: "sp1", name: "Perfect (Acoustic)", artists: [{ name: "Ed Sheeran" }] }] },
      }),
    );

    const orchestrator = new SearchOrchestrator(trackRepo, apiUsageRepo, fakeCredentials(), http);
    const result = await orchestrator.searchTrackVersions("Ed Sheeran", "Perfect");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(0);
  });

  it("returns a partial result set rather than failing when quota runs out mid-pipeline", async () => {
    setUpSuccessfulApis();
    // Pre-spend the daily budget down to exactly one more 100-unit search.
    await apiUsageRepo.tryRecordUsage("youtube", 9850);

    const orchestrator = new SearchOrchestrator(trackRepo, apiUsageRepo, fakeCredentials(), http);
    const result = await orchestrator.searchTrackVersions("Ed Sheeran", "Perfect");

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Only the first template ("acoustic") should have run before quota
      // ran out — "live" never got its search call.
      expect(result.data.map((r) => r.youtubeVideoId)).toEqual(["acoustic1"]);
    }
  });
});
