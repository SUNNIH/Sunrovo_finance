import {
  timingSafeEqual,
} from "node:crypto";

import {
  NextResponse,
} from "next/server";

import {
  matchOpenLimitOrders,
} from "@/features/crypto/limit-order-matcher";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/**
 * Private server-side scheduler endpoint.
 *
 * POST only.
 *
 * Requires a secret matching CRYPTO_MATCHER_SECRET.
 */
export async function POST(request: Request) {
  const configuredSecret =
    process.env.CRYPTO_MATCHER_SECRET;

  const authHeader =
    request.headers.get("authorization") || "";

  const providedSecret =
    authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";

  // Reject missing or insufficiently long secrets.
  if (
    !configuredSecret ||
    configuredSecret.length < 32 ||
    !providedSecret
  ) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  const configured = Buffer.from(
    configuredSecret,
    "utf8"
  );

  const provided = Buffer.from(
    providedSecret,
    "utf8"
  );

  // Compare secrets without ordinary string comparison.
  if (
    configured.length !== provided.length ||
    !timingSafeEqual(configured, provided)
  ) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const summary = await matchOpenLimitOrders();

    return NextResponse.json(
      summary,
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Simulated limit-order matcher failed:",
      error
    );

    return NextResponse.json(
      {
        error: "Matcher failed",
      },
      {
        status: 500,
      }
    );
  }
}