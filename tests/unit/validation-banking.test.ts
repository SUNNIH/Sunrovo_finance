import { describe, expect, it } from "vitest";
import { transferSchema, beneficiaryCreateSchema, setTransactionPinSchema, amountSchema } from "@/lib/validation/banking";

describe("amountSchema", () => {
  it("accepts a positive decimal string", () => {
    expect(amountSchema.safeParse("100.50").success).toBe(true);
  });

  it("rejects zero, negative, and non-numeric input", () => {
    expect(amountSchema.safeParse("0").success).toBe(false);
    expect(amountSchema.safeParse("-5").success).toBe(false);
    expect(amountSchema.safeParse("not-a-number").success).toBe(false);
  });
});

describe("transferSchema", () => {
  const base = {
    sourceAccountId: "acct_1",
    amount: "50.00",
    transactionPin: "1234",
  };

  it("accepts a valid own-account transfer", () => {
    const result = transferSchema.safeParse({
      ...base,
      destination: { kind: "own_account", destinationAccountId: "acct_2" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid beneficiary transfer", () => {
    const result = transferSchema.safeParse({
      ...base,
      destination: { kind: "beneficiary", beneficiaryId: "ben_1" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed transaction PIN", () => {
    const result = transferSchema.safeParse({
      ...base,
      transactionPin: "12",
      destination: { kind: "own_account", destinationAccountId: "acct_2" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown destination kind", () => {
    const result = transferSchema.safeParse({
      ...base,
      destination: { kind: "carrier_pigeon", address: "loft #1" },
    });
    expect(result.success).toBe(false);
  });
});

describe("beneficiaryCreateSchema", () => {
  it("requires currentPassword (step-up authentication)", () => {
    const result = beneficiaryCreateSchema.safeParse({
      type: "INTERNAL_PLT",
      nickname: "Jane",
      accountName: "Jane Doe",
      accountNumber: "1234567890",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid payload with currentPassword present", () => {
    const result = beneficiaryCreateSchema.safeParse({
      type: "EXTERNAL_BANK",
      nickname: "Landlord",
      accountName: "Property Co",
      accountNumber: "9876543210",
      bankName: "First Bank",
      currentPassword: "correct-password",
    });
    expect(result.success).toBe(true);
  });
});

describe("setTransactionPinSchema", () => {
  it("rejects mismatched PIN confirmation", () => {
    const result = setTransactionPinSchema.safeParse({
      pin: "1234",
      confirmPin: "4321",
      currentPassword: "correct-password",
    });
    expect(result.success).toBe(false);
  });

  it("accepts matching PINs with a password", () => {
    const result = setTransactionPinSchema.safeParse({
      pin: "1234",
      confirmPin: "1234",
      currentPassword: "correct-password",
    });
    expect(result.success).toBe(true);
  });
});
