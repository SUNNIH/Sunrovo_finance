import { getCurrentUser } from "@/lib/auth/session";
import { startMfaSetup } from "@/features/authentication/mfa-setup";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  }

  const result = await startMfaSetup(user.id, user.email);
  return apiSuccess(result);
}
