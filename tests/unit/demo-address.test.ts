import { describe, expect, it } from "vitest";
import { getDemoDepositAddress } from "@/features/treasury/demo-address";

describe("getDemoDepositAddress", () => {
  it("is deterministic for the same user+asset", () => {
    const first = getDemoDepositAddress("user_1", "BTC");
    const second = getDemoDepositAddress("user_1", "BTC");

    expect(first.address).toBe(second.address);
    expect(first.network).toBe(second.network);
  });

  it("uses the same BTC receiving address for all users", () => {
    const a = getDemoDepositAddress("user_1", "BTC");
    const b = getDemoDepositAddress("user_2", "BTC");

    expect(a.address).toBe(b.address);
    expect(a.network).toBe("Bitcoin");
    expect(b.network).toBe("Bitcoin");
  });

  it("returns the configured BTC receiving address", () => {
    const result = getDemoDepositAddress("user_1", "BTC");

    expect(result.address).toBeTruthy();
    expect(typeof result.address).toBe("string");
    expect(result.address.length).toBeGreaterThan(20);
    expect(result.network).toBe("Bitcoin");
  });

  it("rejects ETH wallet-transfer deposits", () => {
    expect(() =>
      getDemoDepositAddress("user_1", "ETH")
    ).toThrow("Wallet transfer deposits are currently unavailable");
  });

  it("rejects USDT wallet-transfer deposits", () => {
    expect(() =>
      getDemoDepositAddress("user_1", "USDT")
    ).toThrow("Wallet transfer deposits are currently unavailable");
  });

  it("rejects all other unsupported customer wallet-transfer assets", () => {
    const unsupportedAssets = ["SOL", "XRP", "PLT"];

    unsupportedAssets.forEach((asset) => {
      expect(() =>
        getDemoDepositAddress("user_1", asset)
      ).toThrow("Wallet transfer deposits are currently unavailable");
    });
  });
});