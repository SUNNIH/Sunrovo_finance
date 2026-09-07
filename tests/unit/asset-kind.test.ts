import { describe, expect, it } from "vitest";
import { isFiatAsset, isCryptoAsset } from "@/lib/money/asset-kind";

describe("isFiatAsset", () => {
  it("recognises the supported fiat currencies", () => {
    expect(isFiatAsset("USD")).toBe(true);
    expect(isFiatAsset("NGN")).toBe(true);
    expect(isFiatAsset("EUR")).toBe(true);
    expect(isFiatAsset("GBP")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isFiatAsset("usd")).toBe(true);
  });

  it("treats crypto assets as not fiat", () => {
    expect(isFiatAsset("BTC")).toBe(false);
    expect(isFiatAsset("USDT")).toBe(false);
  });
});

describe("isCryptoAsset", () => {
  it("is the exact inverse of isFiatAsset", () => {
    expect(isCryptoAsset("USD")).toBe(false);
    expect(isCryptoAsset("BTC")).toBe(true);
    expect(isCryptoAsset("PLT")).toBe(true);
  });
});
