import { getCurrentUser } from "@/lib/auth/session";
import { listCardTransactions } from "@/features/treasury/cards";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);

  const { id } = await params;
  try {
    const transactions = await listCardTransactions(user.id, id);
    return apiSuccess({ transactions });
  } catch (error) {
    if (error instanceof AuthError) return apiError(error.code, error.message, error.status);
    console.error("list card transactions failed", error);
    return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
