import { getCurrentUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { watchlistToggleSchema } from "@/lib/validation/crypto";
import { toggleWatchlist } from "@/features/crypto/markets";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  }
  if (!(await verifyCsrf(request))) {
    return apiError("CSRF_INVALID", "Your session could not be verified. Refresh the page and try again.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = watchlistToggleSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "A valid asset symbol is required.", 422);
  }

  try {
    const result = await toggleWatchlist(user.id, parsed.data.assetSymbol);
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.code, error.message, error.status);
    }
    console.error("watchlist toggle failed", error);
    return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
