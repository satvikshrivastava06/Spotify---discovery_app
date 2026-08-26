import { useEffect, useState } from "react";

const STABILIZE_MS = 1500;

export interface StableTrack {
  artist: string | null;
  title: string | null;
}

/**
 * Implements Phase 2's Playback Watcher debounce: rapid track-skipping
 * must never fire a full search pipeline run per skip. Every time
 * (artist, title) changes, the timer restarts — a value only becomes
 * "stable" (and triggers a search downstream) after STABILIZE_MS with no
 * further changes.
 */
export function useStableTrack(artist: string | null, title: string | null): StableTrack {
  const [stable, setStable] = useState<StableTrack>({ artist: null, title: null });

  useEffect(() => {
    if (!artist || !title) {
      setStable({ artist: null, title: null });
      return;
    }
    const timer = setTimeout(() => {
      setStable({ artist, title });
    }, STABILIZE_MS);
    return () => clearTimeout(timer);
  }, [artist, title]);

  return stable;
}
