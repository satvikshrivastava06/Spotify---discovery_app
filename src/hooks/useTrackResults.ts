import { useEffect, useRef, useState } from "react";
import type { TrackResult } from "../db/trackRepository";
import { searchOrchestrator, trackRepository } from "../services";

export type ResultsStatus = "idle" | "loading" | "success" | "empty" | "error";

export interface TrackResultsState {
  status: ResultsStatus;
  results: TrackResult[];
  errorMessage: string | null;
}

export interface UseTrackResultsReturn extends TrackResultsState {
  dismiss: (youtubeVideoId: string) => void;
  refetch: () => void;
}

/** Runs SearchOrchestrator.searchTrackVersions for a stabilized track.
 *  Guards against a real race: if the track changes again before a
 *  slower in-flight search resolves, that stale response must not
 *  overwrite results for whatever's playing now. */
export function useTrackResults(artist: string | null, title: string | null): UseTrackResultsReturn {
  const [state, setState] = useState<TrackResultsState>({
    status: "idle",
    results: [],
    errorMessage: null,
  });
  const [retryTick, setRetryTick] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    if (!artist || !title) {
      requestId.current += 1; // invalidate any in-flight request
      setState({ status: "idle", results: [], errorMessage: null });
      return;
    }

    const thisRequest = ++requestId.current;
    setState({ status: "loading", results: [], errorMessage: null });

    searchOrchestrator.searchTrackVersions(artist, title).then((result) => {
      if (thisRequest !== requestId.current) return; // superseded by a newer track

      if (!result.ok) {
        setState({ status: "error", results: [], errorMessage: result.error.message });
        return;
      }
      setState({
        status: result.data.length === 0 ? "empty" : "success",
        results: result.data,
        errorMessage: null,
      });
    });
    // retryTick is intentionally in the dependency array with no other
    // purpose than to let refetch() force this effect to run again for
    // the same (artist, title) after an error.
  }, [artist, title, retryTick]);

  function dismiss(youtubeVideoId: string) {
    const target = state.results.find((r) => r.youtubeVideoId === youtubeVideoId);
    if (!target) return;

    // Optimistic update — the card disappears immediately; if the
    // persisted dismiss fails, it simply reappears on the next search
    // rather than needing an explicit rollback path for what's a
    // low-stakes, easily-repeated action.
    setState((prev) => {
      const remaining = prev.results.filter((r) => r.youtubeVideoId !== youtubeVideoId);
      return { ...prev, results: remaining, status: remaining.length === 0 ? "empty" : prev.status };
    });
    trackRepository.dismissResult(target.trackId, youtubeVideoId);
  }

  function refetch() {
    setRetryTick((n) => n + 1);
  }

  return { ...state, dismiss, refetch };
}
