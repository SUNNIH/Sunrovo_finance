import { describe, expect, it } from "vitest";
import { assertBalancedPosting } from "@/lib/ledger/postLedgerEntries";
import { invertLedgerPosting } from "@/lib/ledger/reversal";

describe("invertLedgerPosting", () => {
  it("preserves every original account and amount while reversing direction", () => {
    const reversal = invertLedgerPosting([
      { ledgerAccountId: "customer-exact-account", direction: "DEBIT", assetSymbol: "USD", amount: "10.25" },
      { ledgerAccountId: "settlement-used-at-request-time", direction: "CREDIT", assetSymbol: "USD", amount: "10.25" },
      { ledgerAccountId: "customer-exact-account", direction: "DEBIT", assetSymbol: "USD", amount: "0.05" },
      { ledgerAccountId: "fee-pool-used-at-request-time", direction: "CREDIT", assetSymbol: "USD", amount: "0.05" },
    ], "WithdrawalReversal", "withdrawal_1");

    expect(reversal).toEqual([
      expect.objectContaining({ ledgerAccountId: "customer-exact-account", direction: "CREDIT", amount: "10.25" }),
      expect.objectContaining({ ledgerAccountId: "settlement-used-at-request-time", direction: "DEBIT", amount: "10.25" }),
      expect.objectContaining({ ledgerAccountId: "customer-exact-account", direction: "CREDIT", amount: "0.05" }),
      expect.objectContaining({ ledgerAccountId: "fee-pool-used-at-request-time", direction: "DEBIT", amount: "0.05" }),
    ]);
    expect(() => assertBalancedPosting(reversal)).not.toThrow();
  });
});
