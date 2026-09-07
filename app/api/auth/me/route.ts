import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess } from "@/lib/utilities/api-response";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiSuccess({ user: null });
  }

  return apiSuccess({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.profile?.fullName ?? null,
      onboardingCompletedAt: user.profile?.onboardingCompletedAt ?? null,
      mfaEnabled: user.securitySetting?.mfaEnabled ?? false,
    },
  });
}
