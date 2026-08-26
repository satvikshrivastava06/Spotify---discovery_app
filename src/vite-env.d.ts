/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Shared embedded Spotify app credentials (Phase 2/6 design decision).
   *  Injected at build time — see .env.example. Never commit real values. */
  readonly VITE_SPOTIFY_CLIENT_ID: string;
  readonly VITE_SPOTIFY_CLIENT_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
