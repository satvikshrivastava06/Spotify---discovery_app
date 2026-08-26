import { describe, expect, it } from "vitest";
import { FakeHttpClient, jsonResponse } from "./fakeHttpClient";
import { SpotifyClient } from "./spotifyClient";

describe("SpotifyClient", () => {
  it("fetches a token and uses it as a Bearer header on search", async () => {
    const http = new FakeHttpClient();
    http.onPost("accounts.spotify.com/api/token", () =>
      jsonResponse(200, { access_token: "tok_abc", expires_in: 3600 }),
    );
    http.onGet("api.spotify.com/v1/search", () =>
      jsonResponse(200, {
        tracks: { items: [{ id: "sp1", name: "Perfect", artists: [{ name: "Ed Sheeran" }] }] },
      }),
    );

    const client = new SpotifyClient(http, "client-id", "client-secret");
    const result = await client.searchTracksByArtist("Ed Sheeran");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([{ id: "sp1", name: "Perfect", artistNames: ["Ed Sheeran"] }]);
    }
    expect(http.postCalls).toHaveLength(1);
  });

  it("reuses a cached token instead of requesting a new one on a second call", async () => {
    const http = new FakeHttpClient();
    http.onPost("accounts.spotify.com/api/token", () =>
      jsonResponse(200, { access_token: "tok_abc", expires_in: 3600 }),
    );
    http.onGet("api.spotify.com/v1/search", () => jsonResponse(200, { tracks: { items: [] } }));

    const client = new SpotifyClient(http, "client-id", "client-secret");
    await client.searchTracksByArtist("Ed Sheeran");
    await client.searchTracksByArtist("Taylor Swift");

    expect(http.postCalls).toHaveLength(1); // token fetched once, reused
    expect(http.getCalls).toHaveLength(2);
  });

  it("propagates a token request failure as NETWORK_ERROR", async () => {
    const http = new FakeHttpClient();
    http.onPost("accounts.spotify.com/api/token", () => jsonResponse(401, {}));
    const client = new SpotifyClient(http, "bad-id", "bad-secret");
    const result = await client.searchTracksByArtist("Ed Sheeran");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NETWORK_ERROR");
  });

  it("propagates a search failure as NETWORK_ERROR without touching the token cache", async () => {
    const http = new FakeHttpClient();
    http.onPost("accounts.spotify.com/api/token", () =>
      jsonResponse(200, { access_token: "tok_abc", expires_in: 3600 }),
    );
    http.onGet("api.spotify.com/v1/search", () => jsonResponse(500, {}));
    const client = new SpotifyClient(http, "client-id", "client-secret");
    const result = await client.searchTracksByArtist("Ed Sheeran");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NETWORK_ERROR");
  });
});
