import { describe, expect, it } from "vitest";
import { transactionTextForDisplay } from "@/lib/utilities/format-transaction";

describe("transactionTextForDisplay", () => {
  it("formats only known system-generated environment labels", () => {
    expect(transactionTextForDisplay("Demo funding")).toBe("Account credit");
    expect(transactionTextForDisplay("Simulated fiat deposit")).toBe("Account credit");
    expect(transactionTextForDisplay("Simulated on-chain deposit")).toBe("Crypto deposit");
    expect(transactionTextForDisplay("Simulated withdrawal")).toBe("Withdrawal");
  });

  it("preserves custom transaction text", () => {
    expect(transactionTextForDisplay("Simulated savings goal")).toBe("Simulated savings goal");
    expect(transactionTextForDisplay("Invoice 1024")).toBe("Invoice 1024");
    expect(transactionTextForDisplay(null)).toBeNull();
  });
});
