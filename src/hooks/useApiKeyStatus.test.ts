// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useApiKeyStatus } from "./useApiKeyStatus";

const { hasKeyMock, setKeyMock } = vi.hoisted(() => ({
  hasKeyMock: vi.fn(),
  setKeyMock: vi.fn(),
}));

vi.mock("../services", () => ({
  apiKeyManager: { hasYouTubeApiKey: hasKeyMock, setYouTubeApiKey: setKeyMock },
}));

describe("useApiKeyStatus", () => {
  it("checks for an existing key on mount", async () => {
    hasKeyMock.mockResolvedValue({ ok: true, data: true });
    const { result } = renderHook(() => useApiKeyStatus());
    expect(result.current.hasKey).toBeNull(); // not checked yet
    await waitFor(() => expect(result.current.hasKey).toBe(true));
  });

  it("saves a key and refreshes hasKey afterward", async () => {
    hasKeyMock.mockResolvedValueOnce({ ok: true, data: false });
    setKeyMock.mockResolvedValueOnce({ ok: true, data: undefined });
    hasKeyMock.mockResolvedValueOnce({ ok: true, data: true }); // after saving

    const { result } = renderHook(() => useApiKeyStatus());
    await waitFor(() => expect(result.current.hasKey).toBe(false));

    await act(async () => {
      await result.current.save("AIza-fake-key");
    });

    expect(setKeyMock).toHaveBeenCalledWith("AIza-fake-key");
    expect(result.current.saveStatus).toBe("saved");
    expect(result.current.hasKey).toBe(true);
  });

  it("surfaces a save failure without claiming success", async () => {
    hasKeyMock.mockResolvedValue({ ok: true, data: false });
    setKeyMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "INVALID_INPUT", message: "API key cannot be empty" },
    });

    const { result } = renderHook(() => useApiKeyStatus());
    await waitFor(() => expect(result.current.hasKey).toBe(false));

    await act(async () => {
      await result.current.save("");
    });

    expect(result.current.saveStatus).toBe("error");
    expect(result.current.errorMessage).toBe("API key cannot be empty");
  });

  // Note: the hook's return type only ever exposes hasKey as a boolean —
  // there is no code path through useApiKeyStatus that can surface the
  // raw key value to a component, which is the write-only contract from
  // Module 4 enforced at the type level, not just by convention.
});
