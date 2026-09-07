import { afterEach, describe, expect, it, vi } from "vitest";
import { probeBybitPublicApi } from "@/lib/bybit/client";

afterEach(() => vi.unstubAllGlobals());

describe("Bybit provider health probe", () => {
  it("reports healthy only after a successful direct provider response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ retCode: 0 }) }));
    await expect(probeBybitPublicApi()).resolves.toEqual({ status: "healthy" });
  });

  it("does not convert a failed live probe into a healthy fallback result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(probeBybitPublicApi()).resolves.toEqual({ status: "unhealthy" });
  });
});
