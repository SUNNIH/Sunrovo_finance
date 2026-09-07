import { getCurrentUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { beneficiaryCreateSchema } from "@/lib/validation/banking";
import { listBeneficiaries, createBeneficiary } from "@/features/banking/beneficiaries";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";
import { getRequestMeta } from "@/lib/utilities/request-meta";
import { checkRateLimit, RATE_LIMIT_RULES } from "@/lib/rate-limit/limiter";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  }

  const beneficiaries = await listBeneficiaries(user.id);
  return apiSuccess({ beneficiaries });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  }

  if (!(await verifyCsrf(request))) {
    return apiError("CSRF_INVALID", "Your session could not be verified. Refresh the page and try again.", 403);
  }

  const meta = getRequestMeta(request);
  const rateLimit = checkRateLimit(RATE_LIMIT_RULES.beneficiaryCreate, `${meta.ipAddress ?? "unknown"}:${user.id}`);
  if (!rateLimit.allowed) {
    return apiError("RATE_LIMITED", "Too many attempts. Please try again later.", 429);
  }

  const body = await request.json().catch(() => null);
  const parsed = beneficiaryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.", 422);
  }

  try {
    const beneficiary = await createBeneficiary(user.id, parsed.data);
    return apiSuccess({ beneficiary }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.code, error.message, error.status);
    }
    console.error("beneficiary create failed", error);
    return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
