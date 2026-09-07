import "server-only";
import type { Prisma, TransactionType, TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export interface TransactionFilters {
  search?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  currency?: string;
  accountId?: string;
  from?: Date;
  to?: Date;
  cursor?: string;
  limit?: number;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function buildWhere(userId: string, filters: TransactionFilters): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId };

  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.currency) where.assetSymbol = filters.currency;
  if (filters.accountId) where.referenceId = filters.accountId;

  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  if (filters.search) {
    where.OR = [
      { narration: { contains: filters.search, mode: "insensitive" } },
      { counterparty: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function listTransactions(userId: string, filters: TransactionFilters) {
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const where = buildWhere(userId, filters);

  const rows = await prisma.transaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

  return { items, nextCursor };
}

export async function getTransactionOrThrow(userId: string, transactionId: string) {
  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!transaction || transaction.userId !== userId) return null;
  return transaction;
}

/** All matching rows, for CSV export — bounded generously rather than unbounded. */
export async function listAllTransactionsForExport(userId: string, filters: TransactionFilters) {
  const where = buildWhere(userId, filters);
  return prisma.transaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
}
