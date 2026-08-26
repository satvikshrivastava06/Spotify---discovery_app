import { describe, expect, it } from "vitest";
import { computeRelevanceScore } from "./ranking";
import type { YouTubeVideo } from "./youtubeClient";

function makeVideo(overrides: Partial<YouTubeVideo>): YouTubeVideo {
  return {
    videoId: "v1",
    title: "Perfect (Acoustic)",
    channelId: "c1",
    channelName: "Ed Sheeran",
    thumbnailUrl: "https://example.com/thumb.jpg",
    publishedAt: new Date().toISOString(),
    viewCount: 1000,
    ...overrides,
  };
}

describe("computeRelevanceScore", () => {
  it("returns a score between 0 and 1", () => {
    const score = computeRelevanceScore(makeVideo({}), "Ed Sheeran", "Perfect");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("scores an official-channel result higher than an identical off-channel one", () => {
    const official = computeRelevanceScore(
      makeVideo({ channelName: "Ed Sheeran" }),
      "Ed Sheeran",
      "Perfect",
    );
    const random = computeRelevanceScore(
      makeVideo({ channelName: "Totally Unrelated Uploads" }),
      "Ed Sheeran",
      "Perfect",
    );
    expect(official).toBeGreaterThan(random);
  });

  it("scores a higher view count above an otherwise-identical low view count", () => {
    const popular = computeRelevanceScore(makeVideo({ viewCount: 50_000_000 }), "Ed Sheeran", "Perfect");
    const obscure = computeRelevanceScore(makeVideo({ viewCount: 10 }), "Ed Sheeran", "Perfect");
    expect(popular).toBeGreaterThan(obscure);
  });

  it("does not let view count alone overcome a poor title match", () => {
    const wellTitledButUnpopular = computeRelevanceScore(
      makeVideo({ title: "Perfect (Acoustic)", viewCount: 100 }),
      "Ed Sheeran",
      "Perfect",
    );
    const offTopicButViral = computeRelevanceScore(
      makeVideo({ title: "Completely Unrelated Video Title", viewCount: 500_000_000 }),
      "Ed Sheeran",
      "Perfect",
    );
    expect(wellTitledButUnpopular).toBeGreaterThan(offTopicButViral);
  });

  it("treats a missing view count as no signal rather than erroring", () => {
    expect(() => computeRelevanceScore(makeVideo({ viewCount: null }), "Ed Sheeran", "Perfect")).not.toThrow();
  });

  it("treats a missing publish date as neutral rather than erroring", () => {
    expect(() =>
      computeRelevanceScore(makeVideo({ publishedAt: "" }), "Ed Sheeran", "Perfect"),
    ).not.toThrow();
  });
});
