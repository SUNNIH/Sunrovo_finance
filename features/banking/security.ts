import "server-only";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { hashTransactionPin } from "@/lib/auth/transaction-pin";
import { writeAuditLog } from "@/lib/audit/log";
import type { SetTransactionPinInput } from "@/lib/validation/banking";
import { AuthError } from "@/features/authentication/errors";

export async function setTransactionPin(userId: string, input: SetTransactionPinInput): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw new AuthError("INVALID_PASSWORD", "Your current password is incorrect.", 401);
  }

  const pinHash = await hashTransactionPin(input.pin);
  await prisma.securitySetting.update({ where: { userId }, data: { transactionPinHash: pinHash } });

  await writeAuditLog({
    actorUserId: userId,
    actorRole: "USER",
    action: "security.transaction_pin_set",
    targetType: "User",
    targetId: userId,
  });
}

export async function hasTransactionPin(userId: string): Promise<boolean> {
  const security = await prisma.securitySetting.findUnique({ where: { userId } });
  return Boolean(security?.transactionPinHash);
}
