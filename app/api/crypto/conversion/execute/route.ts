import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { executeConversion } from "@/features/crypto/conversion";
import { convertExecuteSchema } from "@/lib/validation/crypto";

/**
 * POST /api/crypto/conversion/execute
 * 
 * Execute a conversion using a valid quote.
 * Requires idempotency key for duplicate protection.
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
    const validation = convertExecuteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0]?.message || "Invalid request",
        },
        { status: 400 }
      );
    }

    const { quoteId } = validation.data;

    // A conversion quote can be executed only once.
// Use a stable key so retries identify the same operation.
const idempotencyKey = quoteId;

    const result = await executeConversion({
      userId: user.id,
      quoteId,
      idempotencyKey,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Conversion execute error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
