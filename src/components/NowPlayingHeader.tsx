import type { ReactNode } from "react";
import type { NowPlayingState } from "../hooks/useNowPlaying";

export interface NowPlayingHeaderProps {
  nowPlaying: NowPlayingState;
  action?: ReactNode;
}

export function NowPlayingHeader({ nowPlaying, action }: NowPlayingHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-2 border-b border-graphite px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] uppercase tracking-widest text-paper-muted">
          Now Playing
        </p>
        {nowPlaying.isPlaying ? (
          <>
            <p className="mt-1 truncate text-lg font-medium">{nowPlaying.title}</p>
            <p className="truncate text-sm text-paper-muted">{nowPlaying.artist}</p>
          </>
        ) : (
          <p className="mt-1 text-lg font-medium text-paper-muted">—</p>
        )}
      </div>
      {action}
    </header>
  );
}
