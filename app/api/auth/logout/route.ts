import { getCurrentUser } from "@/lib/auth/session";
import { logoutCurrentUser } from "@/features/authentication/logout";
import { apiSuccess } from "@/lib/utilities/api-response";

export async function POST() {
  const user = await getCurrentUser();
  await logoutCurrentUser(user?.id ?? null);
  return apiSuccess({ loggedOut: true });
}
