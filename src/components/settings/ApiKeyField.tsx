import { useState } from "react";
import { useApiKeyStatus } from "../../hooks/useApiKeyStatus";

export function ApiKeyField() {
  const { hasKey, saveStatus, errorMessage, save } = useApiKeyStatus();
  const [draft, setDraft] = useState("");

  async function handleSave() {
    await save(draft);
    // The draft is cleared regardless of outcome — never kept around in
    // component state longer than it takes to send once, matching the
    // write-only intent even on the client side of the form.
    setDraft("");
  }

  return (
    <section>
      <label htmlFor="youtube-key" className="block text-sm font-medium">
        YouTube API key
      </label>
      <p className="mt-1 text-xs text-paper-muted">
        {hasKey === null && "Checking…"}
        {hasKey === true && "A key is configured. Paste a new one below to replace it."}
        {hasKey === false && "No key configured yet — search won't work until you add one."}
      </p>
      <div className="mt-2 flex gap-2">
        <input
          id="youtube-key"
          type="password"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="AIza..."
          className="min-w-0 flex-1 rounded-sm border border-graphite bg-ink px-2 py-1.5 font-mono text-sm placeholder:text-paper-muted/50 focus:border-tape"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={!draft.trim() || saveStatus === "saving"}
          className="flex-shrink-0 rounded-sm border border-tape/60 px-3 py-1.5 text-sm text-tape transition-colors hover:bg-tape/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saveStatus === "saving" ? "Saving…" : "Save"}
        </button>
      </div>
      {saveStatus === "error" && errorMessage && (
        <p className="mt-2 text-xs text-rust" role="alert">
          {errorMessage}
        </p>
      )}
      {saveStatus === "saved" && (
        <p className="mt-2 text-xs text-verdigris" role="status">
          Saved.
        </p>
      )}
    </section>
  );
}
