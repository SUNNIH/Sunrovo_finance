import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin-api";
import { verifyCsrf } from "@/lib/auth/csrf";
import { getPlatformSettings, setMaintenanceMode } from "@/features/admin/operations";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";
const bodySchema = z.object({ enabled: z.boolean(), message: z.string().trim().max(500).optional() });
export async function GET() { const admin = await getCurrentAdmin(); if (!admin) return apiError("FORBIDDEN", "Administrator access is required.", 403); return apiSuccess({ settings: await getPlatformSettings() }); }
export async function PUT(request: Request) { const admin = await getCurrentAdmin(); if (!admin) return apiError("FORBIDDEN", "Administrator access is required.", 403); if (!(await verifyCsrf(request))) return apiError("CSRF_INVALID", "Your session could not be verified. Refresh and try again.", 403); const parsed = bodySchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid maintenance settings.", 422); return apiSuccess({ settings: await setMaintenanceMode(admin.id, parsed.data.enabled, parsed.data.message) }); }
