import { describe, expect, it } from "vitest";
import { isDestinationAllowlisted, normalizeWithdrawalAllowlistScope } from "@/lib/treasury/withdrawal-allowlist";

describe("withdrawal allowlist scopes", () => {
  const destination = "0x1234567890abcdef";

  it("normalises only scope values while preserving destination text", () => {
    expect(normalizeWithdrawalAllowlistScope({ destination: ` ${destination} `, assetSymbol: "eth", network: " erc20 " })).toEqual({
      destination,
      assetSymbol: "ETH",
      network: "ERC20",
    });
  });

  it("accepts an explicitly unscoped entry for any asset/network", () => {
    expect(isDestinationAllowlisted({ destination, assetSymbol: "", network: "" }, { destination, assetSymbol: "ETH", network: "erc20" })).toBe(true);
  });

  it("does not let an asset or network scoped entry authorize another scope", () => {
    const entry = { destination, assetSymbol: "ETH", network: "ERC20" };
    expect(isDestinationAllowlisted(entry, { destination, assetSymbol: "BTC", network: "ERC20" })).toBe(false);
    expect(isDestinationAllowlisted(entry, { destination, assetSymbol: "ETH", network: "TRC20" })).toBe(false);
  });

  it("does not let a matching destination authorize a different destination", () => {
    expect(isDestinationAllowlisted(
      { destination, assetSymbol: "ETH", network: "ERC20" },
      { destination: `${destination}ff`, assetSymbol: "ETH", network: "ERC20" }
    )).toBe(false);
  });
});
