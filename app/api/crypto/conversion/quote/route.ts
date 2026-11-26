import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createConversionQuote } from "@/features/crypto/conversion";
import { convertQuoteSchema } from "@/lib/validation/crypto";

/**
 * POST /api/crypto/conversion/quote
 * 
 * Create a conversion quote with current market rate.
 * Quote expires after 30 seconds.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = convertQuoteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues[0]?.message || "Invalid request",
        },
        { status: 400 }
      );
    }

    const { fromAsset, toAsset, fromAmount } = validation.data;

    const result = await createConversionQuote({
      userId: user.id,
      fromAsset,
      toAsset,
      fromAmount,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Conversion quote error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
