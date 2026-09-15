import "server-only";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/log";

export async function getPlatformSettings() {
  return prisma.platformSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}

export async function setMaintenanceMode(adminId: string, enabled: boolean, message?: string) {
  const settings = await prisma.platformSetting.upsert({
    where: { id: "default" },
    update: { maintenanceMode: enabled, maintenanceMessage: message?.trim() || null },
    create: { id: "default", maintenanceMode: enabled, maintenanceMessage: message?.trim() || null },
  });
  await writeAuditLog({
    actorUserId: adminId,
    actorRole: "ADMIN",
    action: enabled ? "admin.enable_maintenance_mode" : "admin.disable_maintenance_mode",
    targetType: "PlatformSetting",
    targetId: settings.id,
  });
  return settings;
}

export async function listAnnouncements(includeInactive = false) {
  return prisma.announcement.findMany({
    where: includeInactive ? undefined : { isActive: true, publishedAt: { lte: new Date() } },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });
}

export async function createAnnouncement(adminId: string, title: string, body: string) {
  const announcement = await prisma.announcement.create({
    data: { title: title.trim(), body: body.trim(), createdByAdminId: adminId },
  });
  await writeAuditLog({ actorUserId: adminId, actorRole: "ADMIN", action: "admin.create_announcement", targetType: "Announcement", targetId: announcement.id });
  return announcement;
}

export async function setAnnouncementActive(adminId: string, id: string, isActive: boolean) {
  const announcement = await prisma.announcement.update({ where: { id }, data: { isActive } });
  await writeAuditLog({ actorUserId: adminId, actorRole: "ADMIN", action: isActive ? "admin.publish_announcement" : "admin.unpublish_announcement", targetType: "Announcement", targetId: id });
  return announcement;
}

export async function listProviderHealth() {
  return prisma.apiConnection.findMany({ orderBy: { provider: "asc" } });
}
