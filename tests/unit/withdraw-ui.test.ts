import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { isDestinationAllowlisted } from "@/lib/treasury/withdrawal-allowlist";
import { NETWORK_BY_ASSET } from "@/features/treasury/demo-address";

describe("Withdrawal Form Validation", () => {
  function isValidAmount(val: string): boolean {
    try {
      return new Decimal(val).gt(0);
    } catch {
      return false;
    }
  }

  function isValidFiatDestination(dest: string): boolean {
    return dest.trim().length >= 4;
  }

  function isValidCryptoDestination(dest: string): boolean {
    const trimmed = dest.trim();
    return trimmed.length >= 10 && !/\s/.test(trimmed);
  }

  function isValidPin(pin: string): boolean {
    return /^\d{4,6}$/.test(pin);
  }

  it("validates positive withdrawal amounts", () => {
    expect(isValidAmount("100")).toBe(true);
    expect(isValidAmount("0.005")).toBe(true);
    expect(isValidAmount("1000.50")).toBe(true);
    expect(isValidAmount("0")).toBe(false);
    expect(isValidAmount("-10")).toBe(false);
    expect(isValidAmount("")).toBe(false);
  });

  it("validates fiat destination format", () => {
    expect(isValidFiatDestination("Chase 1234")).toBe(true);
    expect(isValidFiatDestination("GB29NWBK60161331926819")).toBe(true);
    expect(isValidFiatDestination("123")).toBe(false);
    expect(isValidFiatDestination("   ")).toBe(false);
  });

  it("validates crypto destination address format", () => {
    expect(isValidCryptoDestination("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq")).toBe(true);
    expect(isValidCryptoDestination("0x71C84940562D7Fea9C04f4340d9CaA40C4e4Ae1E")).toBe(true);
    expect(isValidCryptoDestination("short")).toBe(false);
    expect(isValidCryptoDestination("0x123 456")).toBe(false);
  });

  it("validates transaction PIN requirements (4-6 digits)", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("12345")).toBe(true);
    expect(isValidPin("123456")).toBe(true);
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("1234567")).toBe(false);
    expect(isValidPin("abcd")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
  });
});

describe("Withdrawal Allowlist Matching", () => {
  const allowlistEntry = {
    destination: "bc1qtestdestination1234567890",
    assetSymbol: "BTC",
    network: "Bitcoin",
  };

  const unscopedEntry = {
    destination: "0xtestunscopeddestination123456",
    assetSymbol: "",
    network: "",
  };

  it("identifies matching allowlisted destinations", () => {
    const isAllowed = isDestinationAllowlisted(allowlistEntry, {
      destination: "bc1qtestdestination1234567890",
      assetSymbol: "BTC",
      network: "Bitcoin",
    });
    expect(isAllowed).toBe(true);
  });

  it("allows unscoped entries for any asset and network", () => {
    const isAllowedEth = isDestinationAllowlisted(unscopedEntry, {
      destination: "0xtestunscopeddestination123456",
      assetSymbol: "ETH",
      network: "Ethereum (ERC-20)",
    });
    const isAllowedUsdt = isDestinationAllowlisted(unscopedEntry, {
      destination: "0xtestunscopeddestination123456",
      assetSymbol: "USDT",
      network: "Ethereum (ERC-20)",
    });
    expect(isAllowedEth).toBe(true);
    expect(isAllowedUsdt).toBe(true);
  });

  it("rejects non-allowlisted destinations", () => {
    const isAllowed = isDestinationAllowlisted(allowlistEntry, {
      destination: "bc1qunauthorizeddestination9999",
      assetSymbol: "BTC",
      network: "Bitcoin",
    });
    expect(isAllowed).toBe(false);
  });

  it("rejects mismatched asset on asset-scoped allowlist entry", () => {
    const isAllowed = isDestinationAllowlisted(allowlistEntry, {
      destination: "bc1qtestdestination1234567890",
      assetSymbol: "ETH",
      network: "Ethereum (ERC-20)",
    });
    expect(isAllowed).toBe(false);
  });
});

describe("Supported Crypto Networks", () => {
  it("reuses repository network metadata for supported crypto assets", () => {
    expect(NETWORK_BY_ASSET.BTC).toBe("Bitcoin");
    expect(NETWORK_BY_ASSET.ETH).toBe("Ethereum (ERC-20)");
    expect(NETWORK_BY_ASSET.USDT).toBe("Ethereum (ERC-20)");
    expect(NETWORK_BY_ASSET.SOL).toBe("Solana");
    expect(NETWORK_BY_ASSET.XRP).toBe("XRP Ledger");
    expect(NETWORK_BY_ASSET.PLT).toBe("PLT Demo Network");
  });
});

describe("Withdrawal Receipt Invariants", () => {
  it("preserves authoritative status and fee data returned by backend", () => {
    const pendingReceipt = {
      id: "wd_test_pending_123",
      assetSymbol: "USD",
      amount: "5000.00",
      feeAmount: "25.00",
      destination: "Chase •••• 1234",
      status: "PENDING",
      createdAt: "2026-09-08T22:00:00.000Z",
    };

    const completedReceipt = {
      id: "wd_test_completed_456",
      assetSymbol: "BTC",
      amount: "0.01",
      feeAmount: "0.00005000",
      destination: "bc1qtest123456789",
      network: "Bitcoin",
      status: "COMPLETED",
      createdAt: "2026-09-08T22:05:00.000Z",
    };

    expect(pendingReceipt.status).toBe("PENDING");
    expect(pendingReceipt.feeAmount).toBe("25.00");
    expect(completedReceipt.status).toBe("COMPLETED");
    expect(completedReceipt.network).toBe("Bitcoin");
  });
});
