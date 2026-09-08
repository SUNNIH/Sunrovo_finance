import { describe, expect, it } from "vitest";
import { getCryptoAssetMeta, KNOWN_CRYPTO_ASSETS } from "@/components/financial/crypto-asset-icon";

describe("crypto-asset-icon metadata", () => {
  it("provides metadata for all supported crypto assets", () => {
    expect(KNOWN_CRYPTO_ASSETS.BTC).toBeDefined();
    expect(KNOWN_CRYPTO_ASSETS.ETH).toBeDefined();
    expect(KNOWN_CRYPTO_ASSETS.SOL).toBeDefined();
    expect(KNOWN_CRYPTO_ASSETS.XRP).toBeDefined();
    expect(KNOWN_CRYPTO_ASSETS.USDT).toBeDefined();
    expect(KNOWN_CRYPTO_ASSETS.PLT).toBeDefined();
  });

  it("identifies PLT accurately as PLT Demo Token with isFictional flag", () => {
    const pltMeta = getCryptoAssetMeta("PLT");
    expect(pltMeta.name).toBe("PLT Demo Token");
    expect(pltMeta.isFictional).toBe(true);
    expect(pltMeta.symbol).toBe("PLT");
  });

  it("is case-insensitive when looking up asset metadata", () => {
    const btcMeta = getCryptoAssetMeta("btc");
    expect(btcMeta.name).toBe("Bitcoin");
    expect(btcMeta.symbol).toBe("BTC");
    expect(btcMeta.glyph).toBe("₿");
  });

  it("handles unknown symbols gracefully with fallback metadata", () => {
    const unknownMeta = getCryptoAssetMeta("DOGE");
    expect(unknownMeta.symbol).toBe("DOGE");
    expect(unknownMeta.name).toBe("DOGE");
    expect(unknownMeta.glyph).toBe("DOG");
    expect(unknownMeta.isFictional).toBeUndefined();
  });
});
