import { describe, expect, it } from "vitest";
import { getSupportedPair, isSupportedSymbol, SUPPORTED_PAIRS } from "@/lib/bybit/instruments";

describe("instruments", () => {
  it("includes the five MVP pairs", () => {
    const symbols = SUPPORTED_PAIRS.map((p) => p.symbol);
    expect(symbols).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "PLTUSDT"]);
  });

  it("marks PLT/USDT (and only PLT/USDT) as fictional", () => {
    const fictional = SUPPORTED_PAIRS.filter((p) => p.isFictional).map((p) => p.symbol);
    expect(fictional).toEqual(["PLTUSDT"]);
  });

  it("looks up a pair case-insensitively", () => {
    expect(getSupportedPair("btcusdt")?.symbol).toBe("BTCUSDT");
    expect(getSupportedPair("BTCUSDT")?.symbol).toBe("BTCUSDT");
  });

  it("returns undefined for an unsupported symbol", () => {
    expect(getSupportedPair("DOGEUSDT")).toBeUndefined();
  });

  it("isSupportedSymbol matches getSupportedPair", () => {
    expect(isSupportedSymbol("ETHUSDT")).toBe(true);
    expect(isSupportedSymbol("DOGEUSDT")).toBe(false);
  });
});
