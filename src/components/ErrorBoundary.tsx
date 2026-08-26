import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render-time errors anywhere below it in the tree. React has no
 *  hook equivalent for this — error boundaries must be class components. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No telemetry by default (Phase 2's privacy-by-design stance) — this
    // goes to the local log file via the same tauri-plugin-log path
    // Module 1 uses on the Rust side, not sent anywhere.
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="font-medium text-rust">Something went wrong</p>
          <p className="max-w-xs text-sm text-paper-muted">
            The app hit an unexpected error. Restarting usually clears it.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-sm border border-tape/60 px-3 py-1.5 text-sm text-tape transition-colors hover:bg-tape/10"
          >
            Try to recover
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
