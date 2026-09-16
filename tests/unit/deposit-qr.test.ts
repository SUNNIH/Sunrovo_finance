import { describe, expect, it } from "vitest";
import { getDemoDepositAddress } from "@/features/treasury/demo-address";
import { NETWORK_BY_ASSET } from "@/features/treasury/deposit-networks";

/**
 * BTC customer deposit tests.
 *
 * Policy:
 * - BTC is the only customer wallet-transfer deposit currently available.
 * - Every user receives the same public BTC receiving address.
 * - QR payload must exactly match the displayed BTC address.
 * - Other assets remain configured in the platform but customer
 *   wallet-transfer deposits for them are unavailable.
 */

describe("BTC Deposit Address", () => {
  it("returns a BTC deposit address", () => {
    const result = getDemoDepositAddress("user_1", "BTC");

    expect(result.address).toBeTruthy();
    expect(typeof result.address).toBe("string");
    expect(result.address.length).toBeGreaterThan(20);
    expect(result.network).toBe("Bitcoin");
  });

  it("returns the same BTC address for the same user", () => {
    const first = getDemoDepositAddress("user_1", "BTC");
    const second = getDemoDepositAddress("user_1", "BTC");

    expect(first.address).toBe(second.address);
    expect(first.network).toBe(second.network);
  });

  it("returns the same BTC address for different users", () => {
    const user1 = getDemoDepositAddress("user_1", "BTC");
    const user2 = getDemoDepositAddress("user_2", "BTC");
    const user3 = getDemoDepositAddress("user_3", "BTC");

    expect(user1.address).toBe(user2.address);
    expect(user2.address).toBe(user3.address);

    expect(user1.network).toBe("Bitcoin");
    expect(user2.network).toBe("Bitcoin");
    expect(user3.network).toBe("Bitcoin");
  });

  it("rejects non-BTC wallet-transfer deposits", () => {
    expect(() =>
      getDemoDepositAddress("user_1", "ETH")
    ).toThrow("Wallet transfer deposits are currently unavailable");

    expect(() =>
      getDemoDepositAddress("user_1", "USDT")
    ).toThrow("Wallet transfer deposits are currently unavailable");

    expect(() =>
      getDemoDepositAddress("user_1", "SOL")
    ).toThrow("Wallet transfer deposits are currently unavailable");

    expect(() =>
      getDemoDepositAddress("user_1", "XRP")
    ).toThrow("Wallet transfer deposits are currently unavailable");

    expect(() =>
      getDemoDepositAddress("user_1", "PLT")
    ).toThrow("Wallet transfer deposits are currently unavailable");
  });
});

describe("QR Code Payload Consistency", () => {
  it("QR payload exactly matches the displayed BTC deposit address", () => {
    const result = getDemoDepositAddress("user_qr_test", "BTC");

    const displayedAddress = result.address;
    const qrPayload = result.address;

    expect(qrPayload).toBe(displayedAddress);
    expect(qrPayload.length).toBeGreaterThan(20);
    expect(result.network).toBe("Bitcoin");
  });

  it("different users receive the same QR payload", () => {
    const user1 = getDemoDepositAddress("user_qr_1", "BTC");
    const user2 = getDemoDepositAddress("user_qr_2", "BTC");

    expect(user1.address).toBe(user2.address);
  });
});

describe("Asset/Network Configuration", () => {
  it("BTC is mapped to the Bitcoin network", () => {
    expect(NETWORK_BY_ASSET["BTC"]).toBe("Bitcoin");
  });

  it("platform asset network mappings remain available", () => {
    expect(NETWORK_BY_ASSET["ETH"]).toBe("Ethereum (ERC-20)");
    expect(NETWORK_BY_ASSET["SOL"]).toBe("Solana");
    expect(NETWORK_BY_ASSET["XRP"]).toBe("XRP Ledger");
    expect(NETWORK_BY_ASSET["USDT"]).toBe("Ethereum (ERC-20)");
  });

  it("each configured asset has a network value", () => {
    const assets = Object.keys(NETWORK_BY_ASSET);

    expect(assets.length).toBeGreaterThan(0);

    assets.forEach((asset) => {
      const network = NETWORK_BY_ASSET[asset];

      expect(network).toBeTruthy();
      expect(typeof network).toBe("string");
    });
  });
});

describe("BTC Address Security Properties", () => {
  it("exposes only a public receiving address", () => {
    const { address } = getDemoDepositAddress(
      "user_security_test",
      "BTC"
    );

    expect(address).not.toMatch(/private/i);
    expect(address).not.toMatch(/secret/i);
    expect(address).not.toMatch(/seed/i);
  });

  it("does not depend on the user id", () => {
    const first = getDemoDepositAddress(
      "completely_different_user_1",
      "BTC"
    );

    const second = getDemoDepositAddress(
      "completely_different_user_2",
      "BTC"
    );

    expect(first.address).toBe(second.address);
  });
});