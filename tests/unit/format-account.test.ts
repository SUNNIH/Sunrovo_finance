import { describe, expect, it } from "vitest";
import { accountDisplayName, maskAccountNumber } from "@/lib/utilities/format-account";

describe("maskAccountNumber", () => {
  it("keeps only the last four digits visible", () => {
    expect(maskAccountNumber("1234567890")).toBe("•••• 7890");
  });
});

describe("accountDisplayName", () => {
  it("prefers a nickname over the account type label", () => {
    expect(accountDisplayName("Travel fund", "CURRENT")).toBe("Travel fund");
  });

  it("formats only exact legacy default nicknames for display", () => {
    expect(accountDisplayName("PLT Current Account", "CURRENT")).toBe("FHT Current Account");
    expect(accountDisplayName("PLT Savings Account", "SAVINGS")).toBe("FHT Savings Account");
    expect(accountDisplayName("PLT Current Account — travel", "CURRENT")).toBe(
      "PLT Current Account — travel"
    );
  });

  it("falls back to the type label when no nickname is set", () => {
    expect(accountDisplayName(null, "SAVINGS")).toBe("Savings Account");
  });

  it("treats a blank nickname as missing", () => {
    expect(accountDisplayName("   ", "CURRENT")).toBe("Current Account");
  });
});
