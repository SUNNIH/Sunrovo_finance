import { getCurrentUser } from "@/lib/auth/session";
import { listActiveSessions } from "@/features/authentication/account-security";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);

  const sessions = await listActiveSessions(user.id);
  return apiSuccess({ sessions });
}
