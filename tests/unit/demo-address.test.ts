import { describe, expect, it } from "vitest";
import { getDemoDepositAddress } from "@/features/treasury/demo-address";

describe("getDemoDepositAddress", () => {
  it("is deterministic for the same user+asset", () => {
    const a = getDemoDepositAddress("user_1", "BTC");
    const b = getDemoDepositAddress("user_1", "BTC");
    expect(a.address).toBe(b.address);
  });

  it("differs between users", () => {
    const a = getDemoDepositAddress("user_1", "BTC");
    const b = getDemoDepositAddress("user_2", "BTC");
    expect(a.address).not.toBe(b.address);
  });

  it("differs between assets for the same user", () => {
    const btc = getDemoDepositAddress("user_1", "BTC");
    const eth = getDemoDepositAddress("user_1", "ETH");
    expect(btc.address).not.toBe(eth.address);
  });

  it("uses an asset-appropriate prefix so it's visually distinguishable, never a real address", () => {
    expect(getDemoDepositAddress("user_1", "BTC").address.startsWith("bc1demo")).toBe(true);
    expect(getDemoDepositAddress("user_1", "ETH").address.startsWith("0xdemo")).toBe(true);
  });

  it("labels the network for every supported asset", () => {
    expect(getDemoDepositAddress("user_1", "BTC").network).toBe("Bitcoin");
    expect(getDemoDepositAddress("user_1", "SOL").network).toBe("Solana");
  });
});
