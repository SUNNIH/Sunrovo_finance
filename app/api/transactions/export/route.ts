import { getCurrentUser } from "@/lib/auth/session";
import { listAllTransactionsForExport } from "@/features/banking/transactions";
import { toCsv } from "@/lib/utilities/csv";
import { apiError } from "@/lib/utilities/api-response";
import { transactionTextForDisplay } from "@/lib/utilities/format-transaction";
import { TRANSACTION_TYPES, TRANSACTION_STATUSES } from "@/lib/validation/banking";
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

  const rows = await listAllTransactionsForExport(user.id, {
    search: params.get("search") ?? undefined,
    type: typeParam && (TRANSACTION_TYPES as readonly string[]).includes(typeParam) ? (typeParam as TransactionType) : undefined,
    status: statusParam && (TRANSACTION_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as TransactionStatus) : undefined,
    currency: params.get("currency") ?? undefined,
    accountId: params.get("accountId") ?? undefined,
    from: params.get("from") ? new Date(params.get("from")!) : undefined,
    to: params.get("to") ? new Date(params.get("to")!) : undefined,
  });

  const csv = toCsv(
    rows.map((row) => ({
      date: row.createdAt.toISOString(),
      type: row.type,
      direction: row.direction,
      status: row.status,
      asset: row.assetSymbol,
      amount: row.amount.toString(),
      fee: row.feeAmount.toString(),
      counterparty: transactionTextForDisplay(row.counterparty) ?? "",
      narration: transactionTextForDisplay(row.narration) ?? "",
    })),
    ["date", "type", "direction", "status", "asset", "amount", "fee", "counterparty", "narration"]
  );

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="plt-transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
