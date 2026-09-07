import "server-only";
import { prisma } from "@/lib/db/prisma";
import { hashToken, isTokenExpired } from "@/lib/auth/tokens";
import { writeAuditLog } from "@/lib/audit/log";
import { AuthError } from "./errors";

export async function verifyEmailToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.verificationToken.findUnique({ where: { tokenHash } });

  if (!record || record.type !== "EMAIL_VERIFICATION") {
    throw new AuthError("INVALID_TOKEN", "This verification link is invalid.", 400);
  }
  if (record.consumedAt) {
    throw new AuthError("TOKEN_ALREADY_USED", "This verification link has already been used.", 400);
  }
  if (isTokenExpired(record.expiresAt)) {
    throw new AuthError("TOKEN_EXPIRED", "This verification link has expired. Request a new one.", 400);
  }

  await prisma.$transaction([
    prisma.verificationToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);

  await writeAuditLog({
    actorUserId: record.userId,
    actorRole: "USER",
    action: "user.verify_email",
    targetType: "User",
    targetId: record.userId,
  });
}
