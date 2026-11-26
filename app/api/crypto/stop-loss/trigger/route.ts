import { NextResponse } from "next/server";
import { checkAndTriggerStopLossOrders } from "@/features/crypto/stop-loss-monitor";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Manual Stop-Loss Trigger Endpoint (Admin Only)
 * 
 * The automatic monitoring runs server-side via instrumentation.ts.
 * This endpoint is for manual admin triggers only.
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    const result = await checkAndTriggerStopLossOrders();
    
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error in stop-loss trigger:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed - use POST" },
    { status: 405 }
  );
}
