import { type CommandResult, err, ok } from "../db/result";
import type { HttpClient } from "./httpClient";

export interface SpotifyTrack {
  id: string;
  name: string;
  artistNames: string[];
}

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const SEARCH_URL = "https://api.spotify.com/v1/search";

interface SpotifyTokenResponse {
  access_token: string;
  expires_in: number;
}

interface SpotifySearchResponse {
  tracks?: {
    items: Array<{ id: string; name: string; artists: Array<{ name: string }> }>;
  };
}

/**
 * Client Credentials flow only — no end-user Spotify login anywhere in
 * this app (Phase 5's Authentication Flow). This client exists purely to
 * answer "does this artist already have a track that looks like this
 * candidate" for dedup, never to read or control playback.
 */
export class SpotifyClient {
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private http: HttpClient,
    private clientId: string,
    private clientSecret: string,
  ) {}

  private async getToken(): Promise<CommandResult<string>> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return ok(this.cachedToken.value);
    }
    try {
      const response = await this.http.post(
        TOKEN_URL,
        { grant_type: "client_credentials" },
        { Authorization: `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}` },
      );
      if (response.status !== 200) {
        return err("NETWORK_ERROR", `Spotify token request failed with status ${response.status}`);
      }
      const body = (await response.json()) as SpotifyTokenResponse;
      // Refresh a little early rather than exactly at expiry, so a
      // request never lands right on the boundary.
      this.cachedToken = {
        value: body.access_token,
        expiresAt: Date.now() + Math.max(0, body.expires_in - 60) * 1000,
      };
      return ok(this.cachedToken.value);
    } catch (e) {
      return err("NETWORK_ERROR", `Spotify token request failed: ${String(e)}`);
    }
  }

  /** Catalog search scoped to one artist — the dedup input. */
  async searchTracksByArtist(artist: string, limit = 50): Promise<CommandResult<SpotifyTrack[]>> {
    const token = await this.getToken();
    if (!token.ok) return token;

    try {
      const response = await this.http.get(
        SEARCH_URL,
        { q: `artist:${artist}`, type: "track", limit: String(limit) },
        { Authorization: `Bearer ${token.data}` },
      );
      if (response.status !== 200) {
        return err("NETWORK_ERROR", `Spotify search failed with status ${response.status}`);
      }
      const body = (await response.json()) as SpotifySearchResponse;
      const tracks = (body.tracks?.items ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        artistNames: t.artists.map((a) => a.name),
      }));
      return ok(tracks);
    } catch (e) {
      return err("NETWORK_ERROR", `Spotify search failed: ${String(e)}`);
    }
  }
}
