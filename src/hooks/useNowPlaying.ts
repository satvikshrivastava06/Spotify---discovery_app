import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import type { CommandResult } from "../db/result";

export interface NowPlayingState {
  isPlaying: boolean;
  artist: string | null;
  title: string | null;
  album: string | null;
  artworkUrl: string | null;
  sourceApp: string | null;
}

const IDLE_STATE: NowPlayingState = {
  isPlaying: false,
  artist: null,
  title: null,
  album: null,
  artworkUrl: null,
  sourceApp: null,
};

const POLL_INTERVAL_MS = 2000;

/** Polls Module 1's get_now_playing command. Cheap to poll frequently —
 *  it's a local OS media-session read, not a network call, so there's no
 *  quota concern the way there is for the search pipeline. */
export function useNowPlaying(): { nowPlaying: NowPlayingState; error: string | null } {
  const [nowPlaying, setNowPlaying] = useState<NowPlayingState>(IDLE_STATE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const result = await invoke<CommandResult<NowPlayingState>>("get_now_playing");
        if (cancelled) return;
        if (result.ok) {
          setNowPlaying(result.data);
          setError(null);
        } else {
          // A read failure (OS_MEDIA_UNAVAILABLE) is surfaced, but the
          // last-known playback state is left in place rather than reset
          // to idle — a transient read hiccup shouldn't flash the whole
          // UI to "nothing playing" for one poll cycle.
          setError(result.error.message);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { nowPlaying, error };
}
