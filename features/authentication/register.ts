import "server-only";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { generateRawToken, hashToken, EMAIL_VERIFICATION_TTL_MS } from "@/lib/auth/tokens";
import { buildVerificationEmail, sendEmail } from "@/lib/auth/mailer";
import { writeAuditLog } from "@/lib/audit/log";
import type { RequestMeta } from "@/lib/auth/session";
import type { RegisterInput } from "@/lib/validation/auth";
import { AuthError } from "./errors";

export async function registerUser(input: RegisterInput, meta: RequestMeta) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AuthError("EMAIL_TAKEN", "An account with this email already exists.", 409);
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      profile: { create: { fullName: input.fullName } },
      securitySetting: { create: {} },
    },
  });

  const rawToken = generateRawToken();
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      type: "EMAIL_VERIFICATION",
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    },
  });

  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${rawToken}`;
  await sendEmail({ to: user.email, ...buildVerificationEmail(verificationUrl) });

  await writeAuditLog({
    actorUserId: user.id,
    actorRole: "USER",
    action: "user.register",
    targetType: "User",
    targetId: user.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { userId: user.id, email: user.email };
}

export async function resendVerificationEmail(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always resolve successfully regardless of whether the account exists
  // or is already verified — the caller-facing message stays generic to
  // avoid leaking account existence.
  if (!user || user.emailVerifiedAt) return;

  await prisma.verificationToken.deleteMany({
    where: { userId: user.id, type: "EMAIL_VERIFICATION", consumedAt: null },
  });

  const rawToken = generateRawToken();
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      type: "EMAIL_VERIFICATION",
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    },
  });

  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${rawToken}`;
  await sendEmail({ to: user.email, ...buildVerificationEmail(verificationUrl) });
}
