import { getCurrentUser } from "@/lib/auth/session";
import { getWalletForUser } from "@/features/crypto/wallets";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  }

  const wallet = await getWalletForUser(user.id);
  return apiSuccess({ wallet });
}
