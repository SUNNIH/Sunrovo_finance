import { getCurrentUser } from "@/lib/auth/session";
import { listTransactions } from "@/features/banking/transactions";
import { TRANSACTION_TYPES, TRANSACTION_STATUSES } from "@/lib/validation/banking";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";
import type { TransactionType, TransactionStatus } from "@prisma/client";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  }

  const url = new URL(request.url);
  const params = url.searchParams;

  const typeParam = params.get("type");
  const statusParam = params.get("status");

  const result = await listTransactions(user.id, {
    search: params.get("search") ?? undefined,
    type: typeParam && (TRANSACTION_TYPES as readonly string[]).includes(typeParam) ? (typeParam as TransactionType) : undefined,
    status: statusParam && (TRANSACTION_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as TransactionStatus) : undefined,
    currency: params.get("currency") ?? undefined,
    accountId: params.get("accountId") ?? undefined,
    from: params.get("from") ? new Date(params.get("from")!) : undefined,
    to: params.get("to") ? new Date(params.get("to")!) : undefined,
    cursor: params.get("cursor") ?? undefined,
    limit: params.get("limit") ? Number(params.get("limit")) : undefined,
  });

  return apiSuccess(result);
}
