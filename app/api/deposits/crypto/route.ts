import { getCurrentUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { cryptoDepositSchema } from "@/lib/validation/treasury";
import { createCryptoDeposit } from "@/features/treasury/deposits";
import { getDemoDepositAddress } from "@/features/treasury/demo-address";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";
import { assertPlatformOperational } from "@/lib/maintenance";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);

  const url = new URL(request.url);
  const assetSymbol = (url.searchParams.get("asset") ?? "USDT").toUpperCase();
  const address = getDemoDepositAddress(user.id, assetSymbol);
  return apiSuccess({ assetSymbol, ...address });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  if (!(await verifyCsrf(request))) {
    return apiError("CSRF_INVALID", "Your session could not be verified. Refresh the page and try again.", 403);
  }

  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return apiError("MISSING_IDEMPOTENCY_KEY", "This request requires an Idempotency-Key header.", 400);
  }

  const body = await request.json().catch(() => null);
  const parsed = cryptoDepositSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.", 422);
  }

  try {
    await assertPlatformOperational(user.role);
    const deposit = await createCryptoDeposit(user.id, parsed.data, idempotencyKey);
    return apiSuccess({ deposit }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return apiError(error.code, error.message, error.status);
    console.error("crypto deposit failed", error);
    return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
