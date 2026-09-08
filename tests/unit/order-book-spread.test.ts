import { describe, expect, it } from "vitest";

function calculateSpread(
  bestBid: string | null | undefined,
  bestAsk: string | null | undefined
): { spreadValue: number | null; spreadPercent: number | null } {
  const bid = bestBid !== null && bestBid !== undefined ? Number(bestBid) : null;
  const ask = bestAsk !== null && bestAsk !== undefined ? Number(bestAsk) : null;

  if (bid === null || ask === null || isNaN(bid) || isNaN(ask) || ask < bid) {
    return { spreadValue: null, spreadPercent: null };
  }

  const spreadValue = ask - bid;
  const spreadPercent = ask > 0 ? (spreadValue / ask) * 100 : 0;
  return { spreadValue, spreadPercent };
}

describe("Order book spread presentation calculation", () => {
  it("calculates positive spread and percentage accurately", () => {
    const { spreadValue, spreadPercent } = calculateSpread("67000.00", "67010.00");
    expect(spreadValue).toBe(10);
    expect(spreadPercent).toBeCloseTo((10 / 67010) * 100, 4);
  });

  it("handles empty or missing bid/ask gracefully", () => {
    expect(calculateSpread(null, "67000")).toEqual({ spreadValue: null, spreadPercent: null });
    expect(calculateSpread("67000", null)).toEqual({ spreadValue: null, spreadPercent: null });
  });

  it("handles crossed or inverted order book gracefully", () => {
    expect(calculateSpread("67100", "67000")).toEqual({ spreadValue: null, spreadPercent: null });
  });
});
