import { describe, expect, it } from "vitest";
import { titleSimilarity } from "./titleSimilarity";

describe("titleSimilarity", () => {
  it("scores identical titles as 1", () => {
    expect(titleSimilarity("Perfect", "Perfect")).toBe(1);
  });

  it("is case and punctuation insensitive", () => {
    expect(titleSimilarity("Perfect!", "perfect")).toBe(1);
  });

  it("scores completely different songs low", () => {
    expect(titleSimilarity("Perfect", "Shape of You")).toBeLessThan(0.3);
  });

  it("is symmetric", () => {
    const a = titleSimilarity("Perfect (Acoustic)", "Perfect (Acoustic Version)");
    const b = titleSimilarity("Perfect (Acoustic Version)", "Perfect (Acoustic)");
    expect(a).toBe(b);
  });

  it("handles very short strings without dividing by zero", () => {
    expect(titleSimilarity("A", "B")).toBe(0);
    expect(titleSimilarity("", "")).toBe(1);
  });
});
