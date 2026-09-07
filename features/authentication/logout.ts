import "server-only";
import { cookies } from "next/headers";
import { destroySession, clearSessionCookie } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/log";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "plt_session";

export async function logoutCurrentUser(userId: string | null): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(COOKIE_NAME)?.value;

  if (rawToken) {
    await destroySession(rawToken);
  }
  await clearSessionCookie();

  if (userId) {
    await writeAuditLog({
      actorUserId: userId,
      actorRole: "USER",
      action: "user.logout",
      targetType: "User",
      targetId: userId,
    });
  }
}
