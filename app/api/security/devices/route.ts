import { getCurrentUser } from "@/lib/auth/session";
import { listTrustedDevices } from "@/features/authentication/account-security";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);

  const devices = await listTrustedDevices(user.id);
  return apiSuccess({ devices });
}
