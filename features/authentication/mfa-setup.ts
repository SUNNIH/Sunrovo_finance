import "server-only";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { generateTotpSecret, getTotpProvisioningUri, verifyTotpCode } from "@/lib/auth/mfa";
import { encryptSecret, decryptSecret } from "@/lib/encryption/aes";
import { destroyAllSessionsForUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/log";
import { AuthError } from "./errors";

/**
 * Minimal MFA enrollment so the MFA branch built into login.ts is
 * actually reachable/testable in Phase 2. The full security-settings
 * surface (trusted devices list, session list, anti-phishing phrase,
 * transaction PIN, withdrawal allowlist) is Phase 5 scope.
 */
export async function startMfaSetup(userId: string, userEmail: string) {
  const secret = generateTotpSecret();
  // Stored immediately but mfaEnabled stays false until a valid code
  // confirms the authenticator app is actually set up correctly.
  await prisma.securitySetting.update({
    where: { userId },
    data: { mfaSecretEncrypted: encryptSecret(secret) },
  });

  return {
    secret,
    otpauthUrl: getTotpProvisioningUri(secret, userEmail),
  };
}

export async function confirmMfaSetup(userId: string, code: string): Promise<void> {
  const [user, security] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.securitySetting.findUnique({ where: { userId } }),
  ]);

  if (!user || !security?.mfaSecretEncrypted) {
    throw new AuthError("MFA_NOT_STARTED", "Start MFA setup before confirming a code.", 400);
  }

  const secret = decryptSecret(security.mfaSecretEncrypted);
  if (!verifyTotpCode(secret, user.email, code)) {
    throw new AuthError("INVALID_MFA_CODE", "That code is incorrect or has expired.", 401);
  }

  await prisma.securitySetting.update({ where: { userId }, data: { mfaEnabled: true } });
  await writeAuditLog({
    actorUserId: userId,
    actorRole: "USER",
    action: "security.mfa_enabled",
    targetType: "User",
    targetId: userId,
  });
}

export async function disableMfa(userId: string, currentPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) {
    throw new AuthError("INVALID_PASSWORD", "Your current password is incorrect.", 401);
  }

  await prisma.securitySetting.update({
    where: { userId },
    data: { mfaEnabled: false, mfaSecretEncrypted: null },
  });

  // Disabling MFA is sensitive enough to warrant re-authentication
  // everywhere (security memory: step-up auth for sensitive actions).
  await destroyAllSessionsForUser(userId);

  await writeAuditLog({
    actorUserId: userId,
    actorRole: "USER",
    action: "security.mfa_disabled",
    targetType: "User",
    targetId: userId,
  });
}
