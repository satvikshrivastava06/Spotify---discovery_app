import { open } from "@tauri-apps/plugin-shell";

const CONSOLE_URL = "https://console.cloud.google.com/apis/library/youtube.googleapis.com";

export function ApiKeyHelp() {
  return (
    <p className="mt-3 text-xs text-paper-muted">
      Free from Google Cloud — enable the YouTube Data API v3 on a project, then create an API
      key.{" "}
      <button
        type="button"
        onClick={() => open(CONSOLE_URL)}
        className="text-tape underline underline-offset-2 hover:text-tape/80"
      >
        Open Google Cloud Console
      </button>
    </p>
  );
}
