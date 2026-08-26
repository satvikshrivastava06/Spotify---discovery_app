import { open } from "@tauri-apps/plugin-shell";
import { X } from "lucide-react";
import type { TrackResult } from "../db/trackRepository";

const VERSION_LABELS: Record<TrackResult["versionType"], string> = {
  acoustic: "Acoustic",
  live: "Live",
  session: "Session",
  cover: "Cover",
  demo: "Demo",
  other: "Other",
};

function formatViewCount(count: number | null): string | null {
  if (count === null) return null;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K views`;
  return `${count} views`;
}

// Flagged in Phase 10's audit as a real, if low-risk, gap: thumbnailUrl
// comes from YouTube's API response and was going straight into an <img
// src> with no validation. The CSP's `img-src https:` already blocks
// anything that isn't https at the browser level, but checking here too
// means a malformed/unexpected value renders as no image instead of
// whatever the browser would otherwise attempt.
function isSafeImageUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export interface ResultCardProps {
  result: TrackResult;
  onDismiss: (youtubeVideoId: string) => void;
}

export function ResultCard({ result, onDismiss }: ResultCardProps) {
  const views = formatViewCount(result.viewCount);
  const showThumbnail = isSafeImageUrl(result.thumbnailUrl);

  async function handleOpen() {
    // Opens in the OS default browser via the shell plugin — not
    // `window.open`, which would navigate inside the app's own webview.
    await open(`https://www.youtube.com/watch?v=${result.youtubeVideoId}`);
  }

  return (
    <article className="group flex gap-3 rounded-card border border-graphite bg-graphite/50 p-3 transition-colors hover:border-tape/40">
      <button
        type="button"
        onClick={handleOpen}
        className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-sm bg-graphite"
        aria-label={`Open ${result.title} on YouTube`}
      >
        {showThumbnail && (
          <img
            src={result.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={handleOpen}
            className="truncate text-left font-medium hover:text-tape"
          >
            {result.title}
          </button>
          <span className="tape-label flex-shrink-0">{VERSION_LABELS[result.versionType]}</span>
        </div>
        <p className="mt-1 truncate text-sm text-paper-muted">{result.channelName}</p>
        {views && <p className="mt-0.5 font-mono text-xs text-paper-muted">{views}</p>}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(result.youtubeVideoId)}
        className="flex-shrink-0 self-start rounded-sm px-1 text-paper-muted opacity-0 transition-opacity hover:text-rust focus-visible:opacity-100 group-hover:opacity-100"
        aria-label={`Don't show ${result.title} again`}
      >
        <X size={14} />
      </button>
    </article>
  );
}
