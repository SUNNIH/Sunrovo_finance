import { getCurrentUser } from "@/lib/auth/session";
import { transferPreviewSchema } from "@/lib/validation/banking";
import { previewTransfer } from "@/features/banking/transfers";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = transferPreviewSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.", 422);
  }

  try {
    const preview = await previewTransfer(user.id, parsed.data);
    return apiSuccess(preview);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.code, error.message, error.status);
    }
    console.error("transfer quote failed", error);
    return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
