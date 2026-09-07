import { getCurrentAdmin } from "@/lib/auth/admin-api";
import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function GET(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return apiError("FORBIDDEN", "Administrator access is required.", 403);
  const url = new URL(request.url);
  const take = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100) || 100, 1), 200);
  const action = url.searchParams.get("action")?.trim();
  const logs = await prisma.auditLog.findMany({
    where: action ? { action: { contains: action, mode: "insensitive" } } : undefined,
    include: { actorUser: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return apiSuccess({ logs });
}
