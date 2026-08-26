import type { Credentials, CredentialsProvider } from "./credentialsProvider";
import type { ApiKeyManager } from "./apiKeyManager";

/**
 * Replaces Module 3's EnvCredentialsProvider now that real key storage
 * exists. Nothing in youtubeClient.ts, spotifyClient.ts, or
 * searchOrchestrator.ts changes — they only ever depended on the
 * CredentialsProvider interface, which is exactly what that abstraction
 * was for.
 *
 * Spotify's Client ID/Secret are the shared embedded credentials from
 * Phase 2/6 — injected at build time via Vite env vars
 * (VITE_SPOTIFY_CLIENT_ID/SECRET, see .env.example), never committed to
 * source. They're app-level, not per-user, so they don't go through
 * Stronghold at all — only the user's own YouTube key does.
 */
export class StrongholdCredentialsProvider implements CredentialsProvider {
  constructor(private apiKeys: ApiKeyManager) {}

  async getCredentials(): Promise<Credentials> {
    return {
      youtubeApiKey: await this.apiKeys.getYouTubeApiKeyForOrchestrator(),
      spotifyClientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? null,
      spotifyClientSecret: import.meta.env.VITE_SPOTIFY_CLIENT_SECRET ?? null,
    };
  }
}
