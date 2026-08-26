import { beforeEach, describe, expect, it } from "vitest";
import { SettingsRepository } from "./settingsRepository";
import { createTestExecutor } from "./testExecutor";

describe("SettingsRepository", () => {
  let repo: SettingsRepository;

  beforeEach(() => {
    repo = new SettingsRepository(createTestExecutor());
  });

  it("returns null for an unset key", async () => {
    const result = await repo.get("theme");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBeNull();
  });

  it("round-trips a value", async () => {
    await repo.set("theme", "dark");
    const result = await repo.get("theme");
    if (result.ok) expect(result.data).toBe("dark");
  });

  it("overwrites rather than duplicates on repeated set", async () => {
    await repo.set("theme", "dark");
    await repo.set("theme", "light");
    const all = await repo.getAll();
    if (all.ok) {
      expect(all.data.theme).toBe("light");
      expect(Object.keys(all.data)).toHaveLength(1);
    }
  });
});
