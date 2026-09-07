import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/utilities/csv";

describe("toCsv", () => {
  it("writes a header row followed by data rows", () => {
    const csv = toCsv([{ a: "1", b: "2" }], ["a", "b"]);
    expect(csv).toBe("a,b\n1,2");
  });

  it("quotes and escapes cells containing commas, quotes, or newlines", () => {
    const csv = toCsv([{ note: 'has "quotes", a comma, and\na newline' }], ["note"]);
    expect(csv).toBe('note\n"has ""quotes"", a comma, and\na newline"');
  });

  it("renders null/undefined as an empty cell rather than the literal string", () => {
    const csv = toCsv([{ narration: null, counterparty: undefined }], ["narration", "counterparty"]);
    expect(csv).toBe("narration,counterparty\n,");
  });

  it("handles an empty row set (header only)", () => {
    expect(toCsv([], ["a", "b"])).toBe("a,b");
  });
});
