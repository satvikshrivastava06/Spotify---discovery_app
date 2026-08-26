import { useCallback, useEffect, useState } from "react";
import { apiKeyManager } from "../services";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface ApiKeyStatusState {
  /** null = not yet checked, otherwise the real has-a-key boolean — never
   *  the key value itself, per Module 4's write-only contract. */
  hasKey: boolean | null;
  saveStatus: SaveStatus;
  errorMessage: string | null;
  save: (key: string) => Promise<void>;
}

export function useApiKeyStatus(): ApiKeyStatusState {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await apiKeyManager.hasYouTubeApiKey();
    setHasKey(result.ok ? result.data : null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function save(key: string) {
    setSaveStatus("saving");
    setErrorMessage(null);
    const result = await apiKeyManager.setYouTubeApiKey(key);
    if (!result.ok) {
      setSaveStatus("error");
      setErrorMessage(result.error.message);
      return;
    }
    setSaveStatus("saved");
    await refresh();
  }

  return { hasKey, saveStatus, errorMessage, save };
}
