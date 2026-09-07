import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { confirmMfaSetup } from "@/features/authentication/mfa-setup";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

const bodySchema = z.object({ code: z.string().regex(/^\d{6}$/) });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Enter the 6-digit code.", 422);
  }

  try {
    await confirmMfaSetup(user.id, parsed.data.code);
    return apiSuccess({ mfaEnabled: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.code, error.message, error.status);
    }
    console.error("mfa enable failed", error);
    return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
