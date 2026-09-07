import { describe, expect, it } from "vitest";
import { assertBalancedPosting } from "@/lib/ledger/postLedgerEntries";
import { EmptyPostingError, LedgerImbalanceError } from "@/lib/ledger/errors";
import type { PostingLeg } from "@/lib/ledger/types";

const baseLeg = (overrides: Partial<PostingLeg>): PostingLeg => ({
  ledgerAccountId: "acct_1",
  direction: "DEBIT",
  assetSymbol: "USD",
  amount: "0",
  referenceType: "Transfer",
  referenceId: "transfer_1",
  ...overrides,
});

describe("assertBalancedPosting", () => {
  it("accepts a simple balanced internal transfer (debit sender, credit recipient)", () => {
    const legs: PostingLeg[] = [
      baseLeg({ ledgerAccountId: "sender", direction: "DEBIT", amount: "50000.00" }),
      baseLeg({ ledgerAccountId: "recipient", direction: "CREDIT", amount: "50000.00" }),
    ];
    expect(() => assertBalancedPosting(legs)).not.toThrow();
  });

  it("rejects a posting where debits and credits differ", () => {
    const legs: PostingLeg[] = [
      baseLeg({ ledgerAccountId: "sender", direction: "DEBIT", amount: "50000.00" }),
      baseLeg({ ledgerAccountId: "recipient", direction: "CREDIT", amount: "49999.99" }),
    ];
    expect(() => assertBalancedPosting(legs)).toThrow(LedgerImbalanceError);
  });

  it("rejects a posting with fewer than two legs", () => {
    const legs: PostingLeg[] = [baseLeg({ amount: "10" })];
    expect(() => assertBalancedPosting(legs)).toThrow(EmptyPostingError);
  });

  it("balances independently per asset for a multi-asset posting (e.g. a crypto purchase)", () => {
    // Debit fiat balance / credit fiat settlement, AND debit crypto
    // inventory / credit user crypto balance, in the same atomic posting.
    const legs: PostingLeg[] = [
      baseLeg({ ledgerAccountId: "user-fiat", direction: "DEBIT", assetSymbol: "USD", amount: "100.00" }),
      baseLeg({ ledgerAccountId: "fiat-settlement", direction: "CREDIT", assetSymbol: "USD", amount: "100.00" }),
      baseLeg({ ledgerAccountId: "crypto-inventory", direction: "DEBIT", assetSymbol: "BTC", amount: "0.0015" }),
      baseLeg({ ledgerAccountId: "user-crypto", direction: "CREDIT", assetSymbol: "BTC", amount: "0.0015" }),
    ];
    expect(() => assertBalancedPosting(legs)).not.toThrow();
  });

  it("rejects when one asset in a multi-asset posting is unbalanced", () => {
    const legs: PostingLeg[] = [
      baseLeg({ ledgerAccountId: "user-fiat", direction: "DEBIT", assetSymbol: "USD", amount: "100.00" }),
      baseLeg({ ledgerAccountId: "fiat-settlement", direction: "CREDIT", assetSymbol: "USD", amount: "100.00" }),
      baseLeg({ ledgerAccountId: "crypto-inventory", direction: "DEBIT", assetSymbol: "BTC", amount: "0.0015" }),
      baseLeg({ ledgerAccountId: "user-crypto", direction: "CREDIT", assetSymbol: "BTC", amount: "0.0014" }),
    ];
    expect(() => assertBalancedPosting(legs)).toThrow(LedgerImbalanceError);
  });
});
