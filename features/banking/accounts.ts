import "server-only";
import { prisma } from "@/lib/db/prisma";
import { AuthError } from "@/features/authentication/errors";

export async function getAccountsForUser(userId: string) {
  return prisma.bankAccount.findMany({
    where: { userId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
}

/** Throws if the account doesn't exist or doesn't belong to this user — never leaks which. */
export async function getOwnedAccountOrThrow(userId: string, accountId: string) {
  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
  if (!account || account.userId !== userId) {
    throw new AuthError("ACCOUNT_NOT_FOUND", "Account not found.", 404);
  }
  return account;
}
