import { describe, expect, it } from "vitest";
import { resolveAuthorizedRecipient } from "@/lib/utilities/transfer-recipient";

const accounts = [
  {
    id: "src",
    nickname: "Everyday",
    type: "CURRENT",
    accountNumber: "111122223333",
    currencySymbol: "USD",
    balanceCache: "100.00",
  },
  {
    id: "sav",
    nickname: null,
    type: "SAVINGS",
    accountNumber: "999988887777",
    currencySymbol: "USD",
    balanceCache: "50.00",
  },
];

const beneficiaries = [
  {
    id: "ben-1",
    type: "INTERNAL_PLT" as const,
    nickname: "Alex",
    accountName: "Alex Rivera",
    accountNumber: "555566667777",
    bankName: null,
    isFavorite: true,
  },
];

describe("resolveAuthorizedRecipient", () => {
  it("waits until a plausible account number is entered", () => {
    expect(resolveAuthorizedRecipient("12", "src", accounts, beneficiaries).status).toBe(
      "incomplete"
    );
  });

  it("matches a unique owned destination account", () => {
    const match = resolveAuthorizedRecipient("999988887777", "src", accounts, beneficiaries);
    expect(match.status).toBe("own_account");
    if (match.status === "own_account") {
      expect(match.account.id).toBe("sav");
      expect(match.label).toBe("Savings Account");
    }
  });

  it("rejects the currently selected source account", () => {
    expect(resolveAuthorizedRecipient("111122223333", "src", accounts, beneficiaries).status).toBe(
      "own_source"
    );
  });

  it("matches a unique saved beneficiary", () => {
    const match = resolveAuthorizedRecipient("555566667777", "src", accounts, beneficiaries);
    expect(match.status).toBe("beneficiary");
    if (match.status === "beneficiary") {
      expect(match.beneficiary.id).toBe("ben-1");
      expect(match.label).toBe("Alex");
    }
  });

  it("does not invent recipients outside authorized accounts and beneficiaries", () => {
    expect(resolveAuthorizedRecipient("000000000000", "src", accounts, beneficiaries).status).toBe(
      "none"
    );
  });
});
