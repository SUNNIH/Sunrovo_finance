import { getCurrentUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { antiPhishingPhraseSchema } from "@/lib/validation/treasury";
import { setAntiPhishingPhrase } from "@/features/authentication/account-security";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  if (!(await verifyCsrf(request))) {
    return apiError("CSRF_INVALID", "Your session could not be verified. Refresh the page and try again.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = antiPhishingPhraseSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.", 422);
  }

  await setAntiPhishingPhrase(user.id, parsed.data);
  return apiSuccess({ set: true });
}
