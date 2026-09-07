import "server-only";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { generateRawToken, hashToken, isTokenExpired, PASSWORD_RESET_TTL_MS } from "@/lib/auth/tokens";
import { buildPasswordResetEmail, sendEmail } from "@/lib/auth/mailer";
import { destroyAllSessionsForUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/log";
import { AuthError } from "./errors";

/** Always resolves successfully — never reveals whether the email exists. */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  await prisma.verificationToken.deleteMany({
    where: { userId: user.id, type: "PASSWORD_RESET", consumedAt: null },
  });

  const rawToken = generateRawToken();
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      type: "PASSWORD_RESET",
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    },
  });

  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${rawToken}`;
  await sendEmail({ to: user.email, ...buildPasswordResetEmail(resetUrl) });
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.verificationToken.findUnique({ where: { tokenHash } });

  if (!record || record.type !== "PASSWORD_RESET") {
    throw new AuthError("INVALID_TOKEN", "This reset link is invalid.", 400);
  }
  if (record.consumedAt) {
    throw new AuthError("TOKEN_ALREADY_USED", "This reset link has already been used.", 400);
  }
  if (isTokenExpired(record.expiresAt)) {
    throw new AuthError("TOKEN_EXPIRED", "This reset link has expired. Request a new one.", 400);
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.verificationToken.update({ where: { id: record.id }, data: { consumedAt: new Date() } }),
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
  ]);

  // Security memory: a password change invalidates every existing session.
  await destroyAllSessionsForUser(record.userId);

  await writeAuditLog({
    actorUserId: record.userId,
    actorRole: "USER",
    action: "user.reset_password",
    targetType: "User",
    targetId: record.userId,
  });
}
