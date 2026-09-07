import { z } from "zod";
import { verifyEmailToken } from "@/features/authentication/verify-email";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

const bodySchema = z.object({ token: z.string().min(1) });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "A verification token is required.", 422);
  }

  try {
    await verifyEmailToken(parsed.data.token);
    return apiSuccess({ verified: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.code, error.message, error.status);
    }
    console.error("verify-email failed", error);
    return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
