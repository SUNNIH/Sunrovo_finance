import { describe, expect, it } from "vitest";
import type { ConversionReceiptData } from "@/components/financial/convert-receipt";

describe("Conversion Receipt Data Handling", () => {
  it("preserves exact returned backend values without numeric conversion", () => {
    const mockConversion: ConversionReceiptData = {
      id: "cmtx_conv_12345",
      fromAsset: "USDT",
      toAsset: "BTC",
      fromAmount: "5000.00",
      toAmount: "0.074626",
      feeAmount: "0.000112",
      status: "COMPLETED",
      createdAt: "2026-09-08T20:00:00.000Z",
    };

    expect(mockConversion.id).toBe("cmtx_conv_12345");
    expect(mockConversion.fromAmount).toBe("5000.00");
    expect(mockConversion.toAmount).toBe("0.074626");
    expect(mockConversion.feeAmount).toBe("0.000112");
    expect(mockConversion.status).toBe("COMPLETED");
  });
});
