import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin-api";
import { verifyCsrf } from "@/lib/auth/csrf";
import { createAnnouncement, listAnnouncements, setAnnouncementActive } from "@/features/admin/operations";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

const createSchema = z.object({ title: z.string().trim().min(3).max(120), body: z.string().trim().min(3).max(2000) });
const updateSchema = z.object({ id: z.string().min(1), isActive: z.boolean() });

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return apiError("FORBIDDEN", "Administrator access is required.", 403);
  return apiSuccess({ announcements: await listAnnouncements(true) });
}
export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return apiError("FORBIDDEN", "Administrator access is required.", 403);
  if (!(await verifyCsrf(request))) return apiError("CSRF_INVALID", "Your session could not be verified. Refresh and try again.", 403);
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid announcement.", 422);
  return apiSuccess({ announcement: await createAnnouncement(admin.id, parsed.data.title, parsed.data.body) }, { status: 201 });
}
export async function PATCH(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return apiError("FORBIDDEN", "Administrator access is required.", 403);
  if (!(await verifyCsrf(request))) return apiError("CSRF_INVALID", "Your session could not be verified. Refresh and try again.", 403);
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid announcement update.", 422);
  return apiSuccess({ announcement: await setAnnouncementActive(admin.id, parsed.data.id, parsed.data.isActive) });
}
