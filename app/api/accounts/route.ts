import { getCurrentUser } from "@/lib/auth/session";
import { getAccountsForUser } from "@/features/banking/accounts";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  }

  const accounts = await getAccountsForUser(user.id);
  return apiSuccess({ accounts });
}
