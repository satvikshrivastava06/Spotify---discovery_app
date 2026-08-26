import { describe, expect, it } from "vitest";
import { classifyVersionType } from "./versionClassifier";

describe("classifyVersionType", () => {
  it("classifies acoustic", () => {
    expect(classifyVersionType("Perfect (Acoustic)")).toBe("acoustic");
  });

  it("classifies live", () => {
    expect(classifyVersionType("Perfect (Live at Wembley)")).toBe("live");
  });

  it("classifies session/unplugged", () => {
    expect(classifyVersionType("Perfect (Live Lounge Session)")).toBe("session");
    expect(classifyVersionType("Perfect (Unplugged)")).toBe("session");
  });

  it("classifies cover", () => {
    expect(classifyVersionType("Perfect (Cover by Jane Doe)")).toBe("cover");
  });

  it("classifies demo", () => {
    expect(classifyVersionType("Perfect (Unreleased Demo)")).toBe("demo");
  });

  it("falls back to other when nothing matches", () => {
    expect(classifyVersionType("Perfect (Official Music Video)")).toBe("other");
  });

  it("does not false-positive on substrings", () => {
    // "Live" inside "Livermore" shouldn't trigger the live classifier —
    // this checks the pattern set uses word-boundary matching.
    expect(classifyVersionType("Perfect (Recorded in Livermore)")).toBe("other");
  });
});
