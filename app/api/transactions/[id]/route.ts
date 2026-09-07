import { getCurrentUser } from "@/lib/auth/session";
import { getTransactionOrThrow } from "@/features/banking/transactions";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  }

  const { id } = await params;
  const transaction = await getTransactionOrThrow(user.id, id);
  if (!transaction) {
    return apiError("TRANSACTION_NOT_FOUND", "Transaction not found.", 404);
  }

  return apiSuccess({ transaction });
}
