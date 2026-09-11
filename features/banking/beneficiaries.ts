import "server-only";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { writeAuditLog } from "@/lib/audit/log";
import type { BeneficiaryCreateInput, BeneficiaryUpdateInput } from "@/lib/validation/banking";
import { AuthError } from "@/features/authentication/errors";

export async function listBeneficiaries(userId: string) {
  return prisma.beneficiary.findMany({
    where: { userId },
    orderBy: [{ isFavorite: "desc" }, { createdAt: "desc" }],
  });
}

export async function createBeneficiary(userId: string, input: BeneficiaryCreateInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw new AuthError("INVALID_PASSWORD", "Your current password is incorrect.", 401);
  }

  if (input.type === "INTERNAL_PLT") {
    const destination = await prisma.bankAccount.findUnique({ where: { accountNumber: input.accountNumber } });
    if (!destination) {
      throw new AuthError("ACCOUNT_NOT_FOUND", "No FHT account was found with that account number.", 404);
    }
    if (destination.userId === userId) {
      throw new AuthError("CANNOT_ADD_SELF", "You can't add one of your own accounts as a beneficiary.", 422);
    }
  }

  const beneficiary = await prisma.beneficiary.create({
    data: {
      userId,
      type: input.type,
      nickname: input.nickname,
      accountName: input.accountName,
      accountNumber: input.accountNumber,
      bankName: input.type === "EXTERNAL_BANK" ? input.bankName : undefined,
    },
  });

  await writeAuditLog({
    actorUserId: userId,
    actorRole: "USER",
    action: "beneficiary.create",
    targetType: "Beneficiary",
    targetId: beneficiary.id,
  });

  return beneficiary;
}

export async function updateBeneficiary(userId: string, beneficiaryId: string, input: BeneficiaryUpdateInput) {
  const existing = await prisma.beneficiary.findUnique({ where: { id: beneficiaryId } });
  if (!existing || existing.userId !== userId) {
    throw new AuthError("BENEFICIARY_NOT_FOUND", "Beneficiary not found.", 404);
  }

  return prisma.beneficiary.update({
    where: { id: beneficiaryId },
    data: {
      nickname: input.nickname ?? undefined,
      isFavorite: input.isFavorite ?? undefined,
    },
  });
}

export async function deleteBeneficiary(userId: string, beneficiaryId: string) {
  const existing = await prisma.beneficiary.findUnique({ where: { id: beneficiaryId } });
  if (!existing || existing.userId !== userId) {
    throw new AuthError("BENEFICIARY_NOT_FOUND", "Beneficiary not found.", 404);
  }

  await prisma.beneficiary.delete({ where: { id: beneficiaryId } });

  await writeAuditLog({
    actorUserId: userId,
    actorRole: "USER",
    action: "beneficiary.delete",
    targetType: "Beneficiary",
    targetId: beneficiaryId,
  });
}
