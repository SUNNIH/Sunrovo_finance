import { describe, expect, it } from "vitest";
import { isValidPinFormat, hashTransactionPin, verifyTransactionPin } from "@/lib/auth/transaction-pin";

describe("isValidPinFormat", () => {
  it("accepts 4, 5, and 6 digit PINs", () => {
    expect(isValidPinFormat("1234")).toBe(true);
    expect(isValidPinFormat("12345")).toBe(true);
    expect(isValidPinFormat("123456")).toBe(true);
  });

  it("rejects PINs outside the 4-6 digit range", () => {
    expect(isValidPinFormat("123")).toBe(false);
    expect(isValidPinFormat("1234567")).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(isValidPinFormat("12ab")).toBe(false);
  });
});

describe("transaction PIN hashing", () => {
  it("hashes and verifies a correct PIN", async () => {
    const hash = await hashTransactionPin("4821");
    expect(hash).not.toBe("4821");
    expect(await verifyTransactionPin(hash, "4821")).toBe(true);
  });

  it("rejects an incorrect PIN", async () => {
    const hash = await hashTransactionPin("4821");
    expect(await verifyTransactionPin(hash, "9999")).toBe(false);
  });
});
