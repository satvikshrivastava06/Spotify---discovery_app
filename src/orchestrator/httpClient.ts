export interface HttpResponse {
  status: number;
  json: () => Promise<unknown>;
}

/**
 * Thin abstraction over HTTP, mirroring the SqlExecutor pattern from
 * Module 2. Production uses TauriHttpClient (wrapping
 * @tauri-apps/plugin-http — Rust-mediated, so it doesn't hit the
 * webview's CORS restrictions the way a raw browser `fetch` would against
 * YouTube/Spotify). Tests use FakeHttpClient with canned responses —
 * nothing in this module's test suite makes a real network call.
 */
export interface HttpClient {
  get(
    url: string,
    params?: Record<string, string>,
    headers?: Record<string, string>,
  ): Promise<HttpResponse>;
  post(
    url: string,
    body?: Record<string, string>,
    headers?: Record<string, string>,
  ): Promise<HttpResponse>;
}
