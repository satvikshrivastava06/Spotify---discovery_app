import { Settings as SettingsIcon } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "./components/EmptyState";
import { ErrorState } from "./components/ErrorState";
import { NowPlayingHeader } from "./components/NowPlayingHeader";
import { ResultList } from "./components/ResultList";
import { ResultListSkeleton } from "./components/ResultListSkeleton";
import { SettingsScreen } from "./components/settings/SettingsScreen";
import { useNowPlaying } from "./hooks/useNowPlaying";
import { useStableTrack } from "./hooks/useStableTrack";
import { useTrackResults } from "./hooks/useTrackResults";

// Navigation state stays a plain useState here rather than the Zustand
// store named in Phase 3's tech selection — a single two-value view
// toggle, read and written from one component tree, doesn't need a
// global store. Revisit if a second window (e.g. a separate tray-menu
// surface) ever needs this same state — that's the point where Zustand
// would actually earn its place.
type View = "main" | "settings";

export function App() {
  const [view, setView] = useState<View>("main");
  const { nowPlaying } = useNowPlaying();
  const stable = useStableTrack(
    nowPlaying.isPlaying ? nowPlaying.artist : null,
    nowPlaying.isPlaying ? nowPlaying.title : null,
  );
  const { status, results, errorMessage, dismiss, refetch } = useTrackResults(
    stable.artist,
    stable.title,
  );

  if (view === "settings") {
    return <SettingsScreen onBack={() => setView("main")} />;
  }

  return (
    <div className="flex h-full flex-col">
      <NowPlayingHeader
        nowPlaying={nowPlaying}
        action={
          <button
            type="button"
            onClick={() => setView("settings")}
            aria-label="Settings"
            className="flex-shrink-0 rounded-sm p-1.5 text-paper-muted hover:text-paper"
          >
            <SettingsIcon size={16} />
          </button>
        }
      />
      <main className="flex-1 overflow-y-auto p-4">
        {status === "idle" && <EmptyState variant="idle" />}
        {status === "loading" && <ResultListSkeleton />}
        {status === "error" && <ErrorState message={errorMessage} onRetry={refetch} />}
        {status === "empty" && <EmptyState variant="no-results" />}
        {status === "success" && <ResultList results={results} onDismiss={dismiss} />}
      </main>
    </div>
  );
}
