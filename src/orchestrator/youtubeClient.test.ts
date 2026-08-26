import { describe, expect, it } from "vitest";
import { FakeHttpClient, jsonResponse } from "./fakeHttpClient";
import { YouTubeClient } from "./youtubeClient";

describe("YouTubeClient.search", () => {
  it("parses snippet fields and leaves viewCount null", async () => {
    const http = new FakeHttpClient();
    http.onGet("youtube/v3/search", () =>
      jsonResponse(200, {
        items: [
          {
            id: { videoId: "abc123" },
            snippet: {
              title: "Perfect (Acoustic)",
              channelId: "ch1",
              channelTitle: "Ed Sheeran",
              publishedAt: "2017-03-03T00:00:00Z",
              thumbnails: { medium: { url: "https://example.com/thumb.jpg" } },
            },
          },
        ],
      }),
    );

    const client = new YouTubeClient(http, "fake-key");
    const result = await client.search("Ed Sheeran Perfect acoustic");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        videoId: "abc123",
        title: "Perfect (Acoustic)",
        channelName: "Ed Sheeran",
        thumbnailUrl: "https://example.com/thumb.jpg",
        viewCount: null,
      });
    }
  });

  it("skips items without a video id rather than throwing", async () => {
    const http = new FakeHttpClient();
    http.onGet("youtube/v3/search", () =>
      jsonResponse(200, {
        items: [
          { id: {}, snippet: { title: "x", channelId: "c", channelTitle: "c", publishedAt: "2020-01-01" } },
        ],
      }),
    );
    const client = new YouTubeClient(http, "fake-key");
    const result = await client.search("query");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(0);
  });

  it("maps a 403 to QUOTA_EXCEEDED", async () => {
    const http = new FakeHttpClient();
    http.onGet("youtube/v3/search", () => jsonResponse(403, { error: "quota" }));
    const client = new YouTubeClient(http, "fake-key");
    const result = await client.search("query");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("QUOTA_EXCEEDED");
  });

  it("maps other non-200 statuses to NETWORK_ERROR", async () => {
    const http = new FakeHttpClient();
    http.onGet("youtube/v3/search", () => jsonResponse(500, {}));
    const client = new YouTubeClient(http, "fake-key");
    const result = await client.search("query");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NETWORK_ERROR");
  });
});

describe("YouTubeClient.getViewCounts", () => {
  it("returns an empty map without making a call for an empty id list", async () => {
    const http = new FakeHttpClient();
    const client = new YouTubeClient(http, "fake-key");
    const result = await client.getViewCounts([]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.size).toBe(0);
    expect(http.getCalls).toHaveLength(0);
  });

  it("batches ids into a single call and maps statistics by video id", async () => {
    const http = new FakeHttpClient();
    http.onGet("youtube/v3/videos", () =>
      jsonResponse(200, {
        items: [
          { id: "abc123", statistics: { viewCount: "50000" } },
          { id: "def456", statistics: { viewCount: "10" } },
        ],
      }),
    );
    const client = new YouTubeClient(http, "fake-key");
    const result = await client.getViewCounts(["abc123", "def456"]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.get("abc123")).toBe(50000);
      expect(result.data.get("def456")).toBe(10);
    }
    expect(http.getCalls).toHaveLength(1);
    expect(http.getCalls[0].params.id).toBe("abc123,def456");
  });
});
