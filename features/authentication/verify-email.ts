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

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    // Claim an unconsumed, unexpired token exactly once, even under concurrency.
    const claim = await tx.verificationToken.updateMany({
      where: {
        id: record.id,
        type: "EMAIL_VERIFICATION",
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });
    if (claim.count !== 1) {
      throw new AuthError("INVALID_TOKEN", "This verification link is no longer valid. Request a new one.", 400);
    }

    const verified = await tx.user.updateMany({
      where: { id: record.userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: now },
    });
    if (verified.count === 1) {
      // Old sessions issued before enforcement must not become valid again.
      await tx.session.deleteMany({ where: { userId: record.userId } });
      await tx.trustedDevice.updateMany({ where: { userId: record.userId }, data: { trusted: false } });
    }
  });

  await writeAuditLog({
    actorUserId: record.userId,
    actorRole: "USER",
    action: "user.verify_email",
    targetType: "User",
    targetId: record.userId,
  });
}
