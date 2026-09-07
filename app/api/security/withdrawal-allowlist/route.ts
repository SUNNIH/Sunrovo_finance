import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { listWithdrawalAllowlistEntries, toggleWithdrawalAllowlist } from "@/features/authentication/account-security";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

const bodySchema = z.object({ enabled: z.boolean() });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  const entries = await listWithdrawalAllowlistEntries(user.id);
  return apiSuccess({ enabled: user.securitySetting?.withdrawalAllowlistEnabled ?? false, entries });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  if (!(await verifyCsrf(request))) {
    return apiError("CSRF_INVALID", "Your session could not be verified. Refresh the page and try again.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid input.", 422);

  await toggleWithdrawalAllowlist(user.id, parsed.data.enabled);
  return apiSuccess({ enabled: parsed.data.enabled });
}
