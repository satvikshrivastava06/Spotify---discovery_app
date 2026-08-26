export interface Credentials {
  youtubeApiKey: string | null;
  spotifyClientId: string | null;
  spotifyClientSecret: string | null;
}

export interface CredentialsProvider {
  getCredentials(): Promise<Credentials>;
}

/**
 * Stand-in used until Module 4 (Settings & API Keys, Stronghold-backed)
 * exists. Reads from environment variables so this module can be built
 * and tested in isolation — this is NOT how production credentials will
 * actually be sourced. Module 4 will implement the same
 * `CredentialsProvider` interface backed by Stronghold instead; nothing
 * in youtubeClient.ts, spotifyClient.ts, or searchOrchestrator.ts should
 * need to change when that swap happens — they only depend on the
 * interface, never on this implementation.
 */
export class EnvCredentialsProvider implements CredentialsProvider {
  async getCredentials(): Promise<Credentials> {
    return {
      youtubeApiKey: process.env.YOUTUBE_API_KEY ?? null,
      spotifyClientId: process.env.SPOTIFY_CLIENT_ID ?? null,
      spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? null,
    };
  }
}
