import { describe, expect, it } from "vitest";
import { normalizeCacheKey } from "./normalize";

describe("normalizeCacheKey", () => {
  it("lowercases and trims", () => {
    expect(normalizeCacheKey("Ed Sheeran", "Perfect")).toBe("ed sheeran::perfect");
  });

  it("strips accents", () => {
    expect(normalizeCacheKey("Beyoncé", "Halo")).toBe("beyonce::halo");
  });

  it("strips punctuation", () => {
    expect(normalizeCacheKey("Sheeran, Ed", "Perfect!")).toBe("sheeran ed::perfect");
  });

  it("collapses repeated whitespace", () => {
    expect(normalizeCacheKey("Ed   Sheeran", "Perfect")).toBe("ed sheeran::perfect");
  });

  it("produces the same key regardless of case or punctuation variance", () => {
    const a = normalizeCacheKey("ED SHEERAN", "Perfect (Acoustic)");
    const b = normalizeCacheKey("ed sheeran", "perfect acoustic");
    expect(a).toBe(b);
  });

  it("keeps different artists distinct", () => {
    const a = normalizeCacheKey("Ed Sheeran", "Perfect");
    const b = normalizeCacheKey("Kelly Clarkson", "Perfect");
    expect(a).not.toBe(b);
  });
});
