import { getCurrentUser } from "@/lib/auth/session";
import { getOwnedAccountOrThrow } from "@/features/banking/accounts";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  }

  const { id } = await params;
  try {
    const account = await getOwnedAccountOrThrow(user.id, id);
    return apiSuccess({ account });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.code, error.message, error.status);
    }
    throw error;
  }
}
