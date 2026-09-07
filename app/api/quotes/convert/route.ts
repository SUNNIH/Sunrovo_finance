import { getCurrentUser } from "@/lib/auth/session";
import { convertQuoteSchema } from "@/lib/validation/crypto";
import { createConversionQuote } from "@/features/crypto/convert";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = convertQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.", 422);
  }

  try {
    const quote = await createConversionQuote(user.id, parsed.data.fromAsset, parsed.data.toAsset, parsed.data.fromAmount);
    return apiSuccess({ quote });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.code, error.message, error.status);
    }
    console.error("conversion quote failed", error);
    return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
