// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TrackResult } from "../db/trackRepository";
import { useTrackResults } from "./useTrackResults";

const { searchTrackVersionsMock, dismissResultMock } = vi.hoisted(() => ({
  searchTrackVersionsMock: vi.fn(),
  dismissResultMock: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}));

vi.mock("../services", () => ({
  searchOrchestrator: { searchTrackVersions: searchTrackVersionsMock },
  trackRepository: { dismissResult: dismissResultMock },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function makeResult(videoId: string): TrackResult {
  return {
    id: 1,
    trackId: 1,
    youtubeVideoId: videoId,
    title: videoId,
    channelId: "c",
    channelName: "c",
    thumbnailUrl: "https://example.com/t.jpg",
    viewCount: null,
    publishedAt: null,
    versionType: "acoustic",
    isOfficialChannel: false,
    relevanceScore: 0.5,
    isDismissed: false,
    fetchedAt: new Date().toISOString(),
  };
}

describe("useTrackResults", () => {
  it("starts idle when there is no track", () => {
    const { result } = renderHook(() => useTrackResults(null, null));
    expect(result.current.status).toBe("idle");
  });

  it("goes to loading then success on a normal resolved search", async () => {
    searchTrackVersionsMock.mockResolvedValueOnce({ ok: true, data: [makeResult("a")] });
    const { result } = renderHook(() => useTrackResults("Ed Sheeran", "Perfect"));
    expect(result.current.status).toBe("loading");

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.results).toHaveLength(1);
  });

  it("reports empty when the search succeeds with zero results", async () => {
    searchTrackVersionsMock.mockResolvedValueOnce({ ok: true, data: [] });
    const { result } = renderHook(() => useTrackResults("Ed Sheeran", "Perfect"));
    await waitFor(() => expect(result.current.status).toBe("empty"));
  });

  it("surfaces an error message on failure", async () => {
    searchTrackVersionsMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "NETWORK_ERROR", message: "boom" },
    });
    const { result } = renderHook(() => useTrackResults("Ed Sheeran", "Perfect"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.errorMessage).toBe("boom");
  });

  it("ignores a stale response that resolves after a newer track has already superseded it", async () => {
    const first = deferred<{ ok: true; data: TrackResult[] }>();
    const second = deferred<{ ok: true; data: TrackResult[] }>();
    searchTrackVersionsMock.mockReturnValueOnce(first.promise);
    searchTrackVersionsMock.mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(
      ({ artist, title }) => useTrackResults(artist, title),
      { initialProps: { artist: "Track A", title: "Track A" } },
    );
    expect(result.current.status).toBe("loading");

    // Track changes before the first search resolves.
    rerender({ artist: "Track B", title: "Track B" });
    expect(result.current.status).toBe("loading");

    // The SECOND (current) search resolves first...
    second.resolve({ ok: true, data: [makeResult("b")] });
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.results[0].youtubeVideoId).toBe("b");

    // ...then the stale FIRST search finally resolves too. It must not
    // overwrite the already-correct "Track B" results.
    first.resolve({ ok: true, data: [makeResult("a")] });
    await new Promise((r) => setTimeout(r, 0)); // let microtasks flush
    expect(result.current.results[0].youtubeVideoId).toBe("b");
  });

  it("dismiss removes the result immediately and persists it via trackRepository", async () => {
    searchTrackVersionsMock.mockResolvedValueOnce({
      ok: true,
      data: [makeResult("a"), makeResult("b")],
    });
    const { result } = renderHook(() => useTrackResults("Ed Sheeran", "Perfect"));
    await waitFor(() => expect(result.current.status).toBe("success"));

    result.current.dismiss("a");

    await waitFor(() => expect(result.current.results).toHaveLength(1));
    expect(result.current.results[0].youtubeVideoId).toBe("b");
    expect(dismissResultMock).toHaveBeenCalledWith(1, "a");
  });

  it("dismiss moves status to empty once the last result is removed", async () => {
    searchTrackVersionsMock.mockResolvedValueOnce({ ok: true, data: [makeResult("a")] });
    const { result } = renderHook(() => useTrackResults("Ed Sheeran", "Perfect"));
    await waitFor(() => expect(result.current.status).toBe("success"));

    result.current.dismiss("a");
    await waitFor(() => expect(result.current.status).toBe("empty"));
  });
});
