import { beforeEach, describe, expect, it } from "vitest";
import { ApiKeyManager } from "./apiKeyManager";
import { FakeSecretStore } from "./fakeSecretStore";

describe("ApiKeyManager", () => {
  let manager: ApiKeyManager;

  beforeEach(() => {
    manager = new ApiKeyManager(new FakeSecretStore());
  });

  it("reports no key configured before anything is set", async () => {
    const result = await manager.hasYouTubeApiKey();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(false);
  });

  it("reports a key is configured after setting one", async () => {
    await manager.setYouTubeApiKey("AIza-fake-key-value");
    const result = await manager.hasYouTubeApiKey();
    if (result.ok) expect(result.data).toBe(true);
  });

  it("rejects an empty key without touching the store", async () => {
    const result = await manager.setYouTubeApiKey("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_INPUT");

    const hasKey = await manager.hasYouTubeApiKey();
    if (hasKey.ok) expect(hasKey.data).toBe(false);
  });

  it("trims whitespace around a key before storing it", async () => {
    await manager.setYouTubeApiKey("  AIza-fake-key-value  ");
    const value = await manager.getYouTubeApiKeyForOrchestrator();
    expect(value).toBe("AIza-fake-key-value");
  });

  it("hasYouTubeApiKey never exposes the raw value, only a boolean", async () => {
    await manager.setYouTubeApiKey("AIza-fake-key-value");
    const result = await manager.hasYouTubeApiKey();
    // TypeScript already enforces this at the type level (CommandResult<boolean>,
    // not <string>) — this assertion just documents the intent as a runtime check too.
    if (result.ok) expect(typeof result.data).toBe("boolean");
  });

  it("getYouTubeApiKeyForOrchestrator returns null when nothing is configured", async () => {
    const value = await manager.getYouTubeApiKeyForOrchestrator();
    expect(value).toBeNull();
  });

  it("overwriting a key replaces rather than appends", async () => {
    await manager.setYouTubeApiKey("first-key");
    await manager.setYouTubeApiKey("second-key");
    const value = await manager.getYouTubeApiKeyForOrchestrator();
    expect(value).toBe("second-key");
  });
});
