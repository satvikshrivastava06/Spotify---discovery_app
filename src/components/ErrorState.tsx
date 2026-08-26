export interface ErrorStateProps {
  message: string | null;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="font-medium text-rust">Couldn't load results</p>
      {message && <p className="mt-2 max-w-xs text-sm text-paper-muted">{message}</p>}
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-sm border border-tape/60 px-3 py-1.5 text-sm text-tape transition-colors hover:bg-tape/10"
      >
        Try again
      </button>
    </div>
  );
}
