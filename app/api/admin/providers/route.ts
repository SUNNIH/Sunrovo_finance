import { getCurrentAdmin } from "@/lib/auth/admin-api";
import { verifyCsrf } from "@/lib/auth/csrf";
import { listProviderHealth, refreshBybitHealth } from "@/features/admin/operations";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";
export async function GET() { const admin = await getCurrentAdmin(); if (!admin) return apiError("FORBIDDEN", "Administrator access is required.", 403); return apiSuccess({ providers: await listProviderHealth() }); }
export async function POST(request: Request) { const admin = await getCurrentAdmin(); if (!admin) return apiError("FORBIDDEN", "Administrator access is required.", 403); if (!(await verifyCsrf(request))) return apiError("CSRF_INVALID", "Your session could not be verified. Refresh and try again.", 403); return apiSuccess({ provider: await refreshBybitHealth(admin.id) }); }
