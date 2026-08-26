// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useQuotaStatus } from "./useQuotaStatus";

const { getUsageMock } = vi.hoisted(() => ({ getUsageMock: vi.fn() }));

vi.mock("../services", () => ({
  apiUsageRepository: { getUsage: getUsageMock },
}));

describe("useQuotaStatus", () => {
  it("starts null before the initial fetch resolves", () => {
    getUsageMock.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useQuotaStatus());
    expect(result.current).toBeNull();
  });

  it("surfaces used/limit once loaded", async () => {
    getUsageMock.mockResolvedValue({ ok: true, data: { used: 4200, limit: 10000 } });
    const { result } = renderHook(() => useQuotaStatus());
    await waitFor(() => expect(result.current).toEqual({ used: 4200, limit: 10000 }));
  });

  it("stays null if the fetch fails, rather than showing a bad value", async () => {
    getUsageMock.mockResolvedValue({ ok: false, error: { code: "UNKNOWN", message: "boom" } });
    const { result } = renderHook(() => useQuotaStatus());
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toBeNull();
  });
});
