import { getCurrentAdmin } from "@/lib/auth/admin-api";
import { getUserForFunding } from "@/features/admin/funding";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return apiError("FORBIDDEN", "Administrator access is required.", 403);
  }

  try {
    const user = await getUserForFunding(params.userId);
    return apiSuccess({ user });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.code, error.message, error.status);
    }
    console.error("get user for funding failed", error);
    return apiError("INTERNAL_ERROR", "Unable to retrieve user details.", 500);
  }
}
