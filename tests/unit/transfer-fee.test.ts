import { describe, expect, it } from "vitest";
import { computeTransferFee } from "@/features/banking/transfer-pricing";

describe("computeTransferFee", () => {
  it("charges no fee for a transfer between the user's own accounts", () => {
    const fee = computeTransferFee("own_account", "USD");
    expect(fee.isZero()).toBe(true);
  });

  it("charges no fee for a transfer to an internal FHT beneficiary", () => {
    const fee = computeTransferFee("internal_beneficiary", "USD");
    expect(fee.isZero()).toBe(true);
  });

  it("charges the flat demo fee for a simulated external-bank transfer", () => {
    const fee = computeTransferFee("external_beneficiary", "USD");
    expect(fee.isZero()).toBe(false);
    expect(fee.toFixed(2)).toBe("2.50");
  });

  it("tags the fee with the transfer's currency, not a hardcoded one", () => {
    const fee = computeTransferFee("external_beneficiary", "NGN");
    expect(fee.assetSymbol).toBe("NGN");
  });
});
