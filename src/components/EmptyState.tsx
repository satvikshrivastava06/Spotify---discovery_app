export type EmptyStateVariant = "idle" | "no-results";

const COPY: Record<EmptyStateVariant, { title: string; body: string }> = {
  idle: {
    title: "Nothing playing on Spotify",
    body: "Start a track and this fills in automatically — no need to refresh anything.",
  },
  "no-results": {
    title: "Nothing beyond what's already on Spotify",
    body: "No acoustic, live, session, or cover versions turned up for this track that aren't already in Spotify's catalog. Worth trying again later — new uploads show up over time.",
  },
};

export function EmptyState({ variant }: { variant: EmptyStateVariant }) {
  const { title, body } = COPY[variant];
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="font-medium text-paper">{title}</p>
      <p className="mt-2 max-w-xs text-sm text-paper-muted">{body}</p>
    </div>
  );
}
