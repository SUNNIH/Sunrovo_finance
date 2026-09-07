import { getCurrentUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { requestCardSchema } from "@/lib/validation/treasury";
import { listCards, requestCard } from "@/features/treasury/cards";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);

  const cards = await listCards(user.id);
  return apiSuccess({ cards });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  if (!(await verifyCsrf(request))) {
    return apiError("CSRF_INVALID", "Your session could not be verified. Refresh the page and try again.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = requestCardSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid input.", 422);
  }

  try {
    const card = await requestCard(user.id, parsed.data);
    return apiSuccess({ card }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return apiError(error.code, error.message, error.status);
    console.error("card request failed", error);
    return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
