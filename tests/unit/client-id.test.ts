// @vitest-environment jsdom
import { describe, expect, it, afterEach, vi } from "vitest";
import { generateClientId } from "@/lib/utilities/id";

describe("generateClientId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses crypto.randomUUID when available", () => {
    const spy = vi.spyOn(crypto, "randomUUID").mockReturnValue("11111111-1111-1111-1111-111111111111");
    expect(generateClientId()).toBe("11111111-1111-1111-1111-111111111111");
    spy.mockRestore();
  });

  it("falls back to a generated ID when crypto.randomUUID is unavailable", () => {
    // Simulates an insecure context (e.g. a LAN IP over plain HTTP),
    // where `crypto` exists but `.randomUUID` does not — exactly the
    // runtime error this fallback exists to prevent. `randomUUID` lives
    // on Crypto.prototype in jsdom, so `delete crypto.randomUUID` alone
    // wouldn't remove it (delete only affects own properties) — stub
    // the whole global instead.
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });

    const id = generateClientId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
    expect(id.startsWith("id-")).toBe(true);
  });

  it("produces different values on successive calls (fallback path)", () => {
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });

    const a = generateClientId();
    const b = generateClientId();
    expect(a).not.toBe(b);
  });
});
