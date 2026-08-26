import { describe, expect, it } from "vitest";
import { ApiKeyManager } from "./apiKeyManager";
import { FakeSecretStore } from "./fakeSecretStore";
import { StrongholdCredentialsProvider } from "./strongholdCredentialsProvider";

describe("StrongholdCredentialsProvider", () => {
  it("surfaces null for the YouTube key when none is configured", async () => {
    const apiKeys = new ApiKeyManager(new FakeSecretStore());
    const provider = new StrongholdCredentialsProvider(apiKeys);
    const creds = await provider.getCredentials();
    expect(creds.youtubeApiKey).toBeNull();
  });

  it("surfaces the stored YouTube key once one is set", async () => {
    const apiKeys = new ApiKeyManager(new FakeSecretStore());
    await apiKeys.setYouTubeApiKey("AIza-fake-key-value");
    const provider = new StrongholdCredentialsProvider(apiKeys);
    const creds = await provider.getCredentials();
    expect(creds.youtubeApiKey).toBe("AIza-fake-key-value");
  });

  // Spotify's Client ID/Secret come from import.meta.env at build time
  // (see vite-env.d.ts and .env.example) rather than from ApiKeyManager —
  // that's build configuration, not application logic, so it's verified
  // when Module 5 sets up the real Vite build rather than asserted on
  // here against whatever the test runner's env happens to be.
});
