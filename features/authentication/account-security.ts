import "server-only";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { destroyAllSessionsForUser, getCurrentSessionId } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/log";
import type { ChangePasswordInput, AntiPhishingPhraseInput } from "@/lib/validation/treasury";
import { AuthError } from "@/features/authentication/errors";

export async function changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw new AuthError("INVALID_PASSWORD", "Your current password is incorrect.", 401);
  }

  const passwordHash = await hashPassword(input.newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  // Security memory: a password change invalidates every existing session.
  await destroyAllSessionsForUser(userId);

  await writeAuditLog({ actorUserId: userId, actorRole: "USER", action: "security.change_password", targetType: "User", targetId: userId });
}

export async function listTrustedDevices(userId: string) {
  return prisma.trustedDevice.findMany({ where: { userId, trusted: true }, orderBy: { lastSeenAt: "desc" } });
}

export async function revokeTrustedDevice(userId: string, deviceId: string): Promise<void> {
  const device = await prisma.trustedDevice.findUnique({ where: { id: deviceId } });
  if (!device || device.userId !== userId) {
    throw new AuthError("DEVICE_NOT_FOUND", "Device not found.", 404);
  }
  await prisma.trustedDevice.update({ where: { id: deviceId }, data: { trusted: false } });
  await writeAuditLog({ actorUserId: userId, actorRole: "USER", action: "security.revoke_device", targetType: "TrustedDevice", targetId: deviceId });
}

export async function listActiveSessions(userId: string) {
  const [sessions, currentSessionId] = await Promise.all([
    prisma.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
    getCurrentSessionId(),
  ]);
  return sessions.map((session) => ({ ...session, isCurrent: session.id === currentSessionId }));
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) {
    throw new AuthError("SESSION_NOT_FOUND", "Session not found.", 404);
  }
  await prisma.session.delete({ where: { id: sessionId } });
  await writeAuditLog({ actorUserId: userId, actorRole: "USER", action: "security.revoke_session", targetType: "Session", targetId: sessionId });
}

/** Revokes every session for this user except the one making the request. */
export async function revokeAllOtherSessions(userId: string): Promise<void> {
  const currentSessionId = await getCurrentSessionId();
  await prisma.session.deleteMany({
    where: {
      userId,
      ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
    },
  });
  await writeAuditLog({ actorUserId: userId, actorRole: "USER", action: "security.revoke_all_sessions", targetType: "User", targetId: userId });
}

export async function listLoginHistory(userId: string, limit = 20) {
  return prisma.loginEvent.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
}

export async function setAntiPhishingPhrase(userId: string, input: AntiPhishingPhraseInput): Promise<void> {
  await prisma.securitySetting.update({ where: { userId }, data: { antiPhishingPhrase: input.phrase } });
  await writeAuditLog({ actorUserId: userId, actorRole: "USER", action: "security.set_anti_phishing_phrase", targetType: "User", targetId: userId });
}

export async function toggleWithdrawalAllowlist(userId: string, enabled: boolean): Promise<void> {
  await prisma.securitySetting.update({ where: { userId }, data: { withdrawalAllowlistEnabled: enabled } });
  await writeAuditLog({
    actorUserId: userId,
    actorRole: "USER",
    action: enabled ? "security.enable_withdrawal_allowlist" : "security.disable_withdrawal_allowlist",
    targetType: "User",
    targetId: userId,
  });
}

export async function listWithdrawalAllowlistEntries(userId: string) {
  return prisma.withdrawalAllowlistEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function addWithdrawalAllowlistEntry(
  userId: string,
  input: { destination: string; assetSymbol?: string | null; network?: string | null; label?: string | null }
) {
  const entry = await prisma.withdrawalAllowlistEntry.create({
    data: {
      userId,
      destination: input.destination.trim(),
      assetSymbol: input.assetSymbol?.toUpperCase() || "",
network: input.network?.trim() || "",
      label: input.label?.trim() || null,
    },
  });
  await writeAuditLog({
    actorUserId: userId,
    actorRole: "USER",
    action: "security.add_withdrawal_allowlist_entry",
    targetType: "WithdrawalAllowlistEntry",
    targetId: entry.id,
    metadata: { assetSymbol: entry.assetSymbol, network: entry.network },
  });
  return entry;
}

export async function removeWithdrawalAllowlistEntry(userId: string, entryId: string): Promise<void> {
  const entry = await prisma.withdrawalAllowlistEntry.findFirst({ where: { id: entryId, userId } });
  if (!entry) throw new AuthError("ALLOWLIST_ENTRY_NOT_FOUND", "Allowlist entry not found.", 404);
  await prisma.withdrawalAllowlistEntry.delete({ where: { id: entry.id } });
  await writeAuditLog({
    actorUserId: userId,
    actorRole: "USER",
    action: "security.remove_withdrawal_allowlist_entry",
    targetType: "WithdrawalAllowlistEntry",
    targetId: entry.id,
  });
}

export async function deactivateAccount(userId: string, currentPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) {
    throw new AuthError("INVALID_PASSWORD", "Your current password is incorrect.", 401);
  }

  await prisma.user.update({ where: { id: userId }, data: { status: "DEACTIVATED" } });
  await destroyAllSessionsForUser(userId);

  await writeAuditLog({ actorUserId: userId, actorRole: "USER", action: "security.deactivate_account", targetType: "User", targetId: userId });
}
