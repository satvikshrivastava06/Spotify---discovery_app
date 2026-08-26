import { describe, expect, it } from "vitest";
import { filterAlreadyOnSpotify, isSameRelease } from "./dedup";
import type { YouTubeVideo } from "./youtubeClient";

function makeVideo(overrides: Partial<YouTubeVideo> & { videoId: string; title: string }): YouTubeVideo {
  return {
    channelId: "c1",
    channelName: "Ed Sheeran",
    thumbnailUrl: "https://example.com/thumb.jpg",
    publishedAt: "2017-03-03T00:00:00Z",
    viewCount: null,
    ...overrides,
  };
}

// This exact case set was used to tune CORE_TITLE_THRESHOLD and the
// filler/qualifier word lists in dedup.ts against real title-formatting
// variance — see the Phase 6 module notes for how a naive whole-title
// similarity threshold failed on the Beyoncé-duet and "Live at Wembley"
// cases below before this two-part check was designed.
describe("isSameRelease", () => {
  it("does not treat an acoustic version as the same release as the plain track", () => {
    expect(isSameRelease("Perfect (Acoustic)", "Perfect")).toBe(false);
  });

  it("treats 'Acoustic' and 'Acoustic Version' as the same release", () => {
    expect(isSameRelease("Perfect (Acoustic)", "Perfect (Acoustic Version)")).toBe(true);
  });

  it("does not treat a live version as the same release as the plain track", () => {
    expect(isSameRelease("Perfect (Live)", "Perfect")).toBe(false);
  });

  it("treats two completely different songs as different releases", () => {
    expect(isSameRelease("Perfect", "Shape of You")).toBe(false);
  });

  it("does not confuse two different songs that share a qualifier", () => {
    expect(isSameRelease("Photograph (Acoustic)", "Perfect (Acoustic)")).toBe(false);
  });

  it("does not treat a long title's acoustic version as the same as its plain version", () => {
    // This is the case that broke a naive whole-string-similarity
    // threshold: the added "- Acoustic" barely moves the score on a long
    // base title, unlike on a short one.
    expect(
      isSameRelease(
        "Perfect Duet (with Beyoncé) - Acoustic",
        "Perfect Duet (with Beyoncé)",
      ),
    ).toBe(false);
  });

  it("treats dash- and parenthesis-formatted qualifiers as equivalent", () => {
    expect(isSameRelease("Perfect - Acoustic", "Perfect (Acoustic)")).toBe(true);
  });

  it("treats identical titles as the same release", () => {
    expect(isSameRelease("Perfect", "Perfect")).toBe(true);
  });

  it("under-filters rather than over-filters on a specific vs. generic live recording", () => {
    // A specific "Live at Wembley" recording is different content from a
    // generic "Live" catalog entry — showing both is the safer failure
    // mode than hiding one (see the module's bias note).
    expect(isSameRelease("Perfect (Live at Wembley)", "Perfect (Live)")).toBe(false);
  });

  it("does not confuse a featured-artist release with the plain track", () => {
    expect(isSameRelease("Perfect", "Perfect (feat. Beyoncé)")).toBe(false);
  });

  it("strips common YouTube title boilerplate before comparing", () => {
    expect(isSameRelease("Perfect (Official Acoustic Video)", "Perfect (Acoustic)")).toBe(true);
    expect(isSameRelease("Perfect (Official Music Video)", "Perfect")).toBe(true);
    expect(isSameRelease("Perfect (Audio)", "Perfect")).toBe(true);
  });

  it("does not treat a symphonic reimagining as the same release", () => {
    expect(isSameRelease("Perfect Symphony (with Andrea Bocelli)", "Perfect")).toBe(false);
  });
});

describe("filterAlreadyOnSpotify", () => {
  it("removes only the candidates that match the Spotify catalog", () => {
    const candidates = [
      makeVideo({ videoId: "a", title: "Perfect (Acoustic Version)" }),
      makeVideo({ videoId: "b", title: "Perfect (Live from the O2)" }),
    ];
    const catalog = [{ id: "sp1", name: "Perfect (Acoustic)", artistNames: ["Ed Sheeran"] }];
    const result = filterAlreadyOnSpotify(candidates, catalog);
    expect(result).toHaveLength(1);
    expect(result[0].videoId).toBe("b");
  });

  it("keeps everything when the catalog is empty", () => {
    const candidates = [makeVideo({ videoId: "a", title: "Perfect (Acoustic)" })];
    expect(filterAlreadyOnSpotify(candidates, [])).toHaveLength(1);
  });
});
