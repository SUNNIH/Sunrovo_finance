import { getCurrentAdmin } from "@/lib/auth/admin-api";
import { listProviderHealth } from "@/features/admin/operations";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function GET() { 
  const admin = await getCurrentAdmin(); 
  if (!admin) return apiError("FORBIDDEN", "Administrator access is required.", 403); 
  return apiSuccess({ providers: await listProviderHealth() }); 
}

