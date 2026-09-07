import "server-only";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, setSessionCookie, type RequestMeta } from "@/lib/auth/session";
import { ensureCsrfCookie } from "@/lib/auth/csrf";
import { fingerprintDevice, getOrCreateDeviceId } from "@/lib/auth/device";
import { setPendingMfaCookie, readPendingMfaUserId, clearPendingMfaCookie } from "@/lib/auth/pending-mfa";
import { decryptSecret } from "@/lib/encryption/aes";
import { verifyTotpCode } from "@/lib/auth/mfa";
import { writeAuditLog } from "@/lib/audit/log";
import type { LoginInput, MfaVerifyInput } from "@/lib/validation/auth";
import { AuthError } from "./errors";

// Constant-time-ish credential check: verify against a real password hash
// if the user exists, or a precomputed dummy hash if they don't, so a
// non-existent email doesn't respond measurably faster than a wrong
// password for an existing one.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword("plt-dummy-password-for-timing-safety-only");
  }
  return dummyHashPromise;
}

export type LoginResult = { status: "success" } | { status: "mfa_required" };

async function finalizeLogin(
  userId: string,
  params: {
    deviceFingerprint: string;
    deviceName: string | null | undefined;
    isNewDevice: boolean;
    rememberDevice: boolean;
    meta: RequestMeta;
  }
): Promise<void> {
  const { rawToken, expiresAt } = await createSession(userId, params.meta);
  await setSessionCookie(rawToken, expiresAt);
  await ensureCsrfCookie();

  await prisma.trustedDevice.upsert({
    where: { userId_deviceFingerprint: { userId, deviceFingerprint: params.deviceFingerprint } },
    update: {
      lastSeenAt: new Date(),
      ...(params.rememberDevice ? { trusted: true, deviceName: params.deviceName ?? undefined } : {}),
    },
    create: {
      userId,
      deviceFingerprint: params.deviceFingerprint,
      deviceName: params.deviceName ?? undefined,
      trusted: params.rememberDevice,
    },
  });

  await prisma.loginEvent.create({
    data: {
      userId,
      ipAddress: params.meta.ipAddress ?? undefined,
      userAgent: params.meta.userAgent ?? undefined,
      success: true,
      riskFlag: params.isNewDevice ? "NEW_DEVICE" : undefined,
    },
  });

  if (params.isNewDevice) {
    await prisma.notification.create({
      data: {
        userId,
        type: "SECURITY",
        title: "New sign-in detected",
        body: params.meta.ipAddress
          ? `A new sign-in to your account was detected from ${params.meta.ipAddress}. If this wasn't you, reset your password immediately.`
          : "A new sign-in to your account was detected from an unrecognised device. If this wasn't you, reset your password immediately.",
      },
    });
  }

  await writeAuditLog({
    actorUserId: userId,
    actorRole: "USER",
    action: "user.login",
    targetType: "User",
    targetId: userId,
    ipAddress: params.meta.ipAddress,
    userAgent: params.meta.userAgent,
    metadata: { isNewDevice: params.isNewDevice },
  });
}

export async function loginUser(input: LoginInput, meta: RequestMeta): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { securitySetting: true },
  });

  const passwordValid = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), input.password);

  if (!user || !passwordValid) {
    if (user) {
      await prisma.loginEvent.create({
        data: {
          userId: user.id,
          ipAddress: meta.ipAddress ?? undefined,
          userAgent: meta.userAgent ?? undefined,
          success: false,
        },
      });
    }
    throw new AuthError("INVALID_CREDENTIALS", "Invalid email or password.", 401);
  }

  if (user.status !== "ACTIVE") {
    throw new AuthError("ACCOUNT_INACTIVE", "This account is not active. Contact support.", 403);
  }

  const { deviceId } = await getOrCreateDeviceId();
  const deviceFingerprint = fingerprintDevice(deviceId, meta.userAgent);
  const trustedDevice = await prisma.trustedDevice.findUnique({
    where: { userId_deviceFingerprint: { userId: user.id, deviceFingerprint } },
  });
  const isDeviceTrusted = Boolean(trustedDevice?.trusted);

  if (user.securitySetting?.mfaEnabled && !isDeviceTrusted) {
    await setPendingMfaCookie(user.id);
    return { status: "mfa_required" };
  }

  await finalizeLogin(user.id, {
    deviceFingerprint,
    deviceName: meta.userAgent,
    isNewDevice: !trustedDevice,
    rememberDevice: input.rememberDevice,
    meta,
  });

  return { status: "success" };
}

export async function verifyMfaAndLogin(input: MfaVerifyInput, meta: RequestMeta): Promise<void> {
  const userId = await readPendingMfaUserId();
  if (!userId) {
    throw new AuthError("MFA_SESSION_EXPIRED", "Your sign-in attempt has expired. Please sign in again.", 401);
  }

  const [user, security] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.securitySetting.findUnique({ where: { userId } }),
  ]);

  if (!user || !security?.mfaSecretEncrypted) {
    throw new AuthError("MFA_NOT_CONFIGURED", "MFA is not set up correctly for this account.", 400);
  }

  const secret = decryptSecret(security.mfaSecretEncrypted);
  const codeValid = verifyTotpCode(secret, user.email, input.code);

  if (!codeValid) {
    await prisma.loginEvent.create({
      data: {
        userId,
        ipAddress: meta.ipAddress ?? undefined,
        userAgent: meta.userAgent ?? undefined,
        success: false,
        riskFlag: "MFA_FAILED",
      },
    });
    throw new AuthError("INVALID_MFA_CODE", "That code is incorrect or has expired.", 401);
  }

  await clearPendingMfaCookie();

  const { deviceId } = await getOrCreateDeviceId();
  const deviceFingerprint = fingerprintDevice(deviceId, meta.userAgent);
  const trustedDevice = await prisma.trustedDevice.findUnique({
    where: { userId_deviceFingerprint: { userId, deviceFingerprint } },
  });

  await finalizeLogin(userId, {
    deviceFingerprint,
    deviceName: meta.userAgent,
    isNewDevice: !trustedDevice,
    rememberDevice: input.rememberDevice,
    meta,
  });
}
