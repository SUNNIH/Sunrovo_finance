import "server-only";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";

/** API-safe counterpart to requireAdmin(): never redirects JSON callers. */
export async function getCurrentAdmin(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  return user?.role === "ADMIN" ? user : null;
}
