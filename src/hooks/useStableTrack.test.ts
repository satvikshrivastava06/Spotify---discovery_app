// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStableTrack } from "./useStableTrack";

describe("useStableTrack", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with no stable track", () => {
    const { result } = renderHook(() => useStableTrack(null, null));
    expect(result.current).toEqual({ artist: null, title: null });
  });

  it("does not commit a track before the stabilize window elapses", () => {
    const { result } = renderHook(() => useStableTrack("Ed Sheeran", "Perfect"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toEqual({ artist: null, title: null });
  });

  it("commits a track once the stabilize window elapses", () => {
    const { result } = renderHook(() => useStableTrack("Ed Sheeran", "Perfect"));
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current).toEqual({ artist: "Ed Sheeran", title: "Perfect" });
  });

  it("restarts the timer on every change — rapid skipping never commits", () => {
    const { result, rerender } = renderHook(
      ({ artist, title }) => useStableTrack(artist, title),
      { initialProps: { artist: "Track A" as string | null, title: "Track A" as string | null } },
    );

    // Simulate skipping every 500ms — well under the 1500ms window —
    // across five different tracks.
    for (let i = 0; i < 5; i++) {
      act(() => {
        vi.advanceTimersByTime(500);
      });
      rerender({ artist: `Track ${i}`, title: `Track ${i}` });
    }

    expect(result.current).toEqual({ artist: null, title: null }); // never stabilized
  });

  it("commits the final track once skipping stops", () => {
    const { result, rerender } = renderHook(
      ({ artist, title }) => useStableTrack(artist, title),
      { initialProps: { artist: "Track A" as string | null, title: "Track A" as string | null } },
    );

    act(() => vi.advanceTimersByTime(500));
    rerender({ artist: "Track B", title: "Track B" });
    act(() => vi.advanceTimersByTime(500));
    rerender({ artist: "Final Track", title: "Final Track" });

    // Now let it sit without further changes.
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current).toEqual({ artist: "Final Track", title: "Final Track" });
  });

  it("goes idle immediately, without waiting for the debounce window", () => {
    const { result, rerender } = renderHook(
      ({ artist, title }) => useStableTrack(artist, title),
      { initialProps: { artist: "Ed Sheeran" as string | null, title: "Perfect" as string | null } },
    );
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.artist).toBe("Ed Sheeran");

    rerender({ artist: null, title: null });
    // No timer advance at all — idle should be immediate.
    expect(result.current).toEqual({ artist: null, title: null });
  });
});
