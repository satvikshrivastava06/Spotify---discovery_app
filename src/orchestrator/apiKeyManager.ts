import { type CommandResult, err, ok } from "../db/result";
import type { SecretStore } from "./secretStore";

const YOUTUBE_KEY_RECORD = "youtube_api_key";

export class ApiKeyManager {
  constructor(private store: SecretStore) {}

  /** Settings-screen command — matches Phase 5's set_api_key contract. */
  async setYouTubeApiKey(key: string): Promise<CommandResult<void>> {
    if (!key.trim()) return err("INVALID_INPUT", "API key cannot be empty");
    try {
      await this.store.set(YOUTUBE_KEY_RECORD, key.trim());
      return ok(undefined);
    } catch (e) {
      return err("KEYCHAIN_ERROR", `failed to store YouTube API key: ${String(e)}`);
    }
  }

  /** Settings-screen command — matches Phase 5's has_api_key contract.
   *  Existence-only, deliberately: this is the boundary that keeps the
   *  raw key from ever reaching a UI that could display or screenshot
   *  it. getYouTubeApiKeyForOrchestrator() below is a separate,
   *  narrower-purpose path for a different, legitimate consumer. */
  async hasYouTubeApiKey(): Promise<CommandResult<boolean>> {
    try {
      const value = await this.store.get(YOUTUBE_KEY_RECORD);
      return ok(value !== null);
    } catch (e) {
      return err("KEYCHAIN_ERROR", `failed to read YouTube API key: ${String(e)}`);
    }
  }

  /** Internal-only: the orchestrator needs the real key value to make API
   *  calls with — a fundamentally different need than a settings UI
   *  displaying it. Not part of the Phase 5 command surface; only
   *  StrongholdCredentialsProvider calls this. */
  async getYouTubeApiKeyForOrchestrator(): Promise<string | null> {
    return this.store.get(YOUTUBE_KEY_RECORD);
  }
}
