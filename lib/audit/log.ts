import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Immutable audit trail (security memory: "Record audit events").
 * Every sensitive action — auth events, future financial mutations,
 * admin actions — should call this. Failures to write an audit log must
 * never take down the primary action, so this swallows its own errors
 * after logging to the server console; callers should not `await` this
 * in a way that blocks the user-facing response on audit-log latency.
 */
export interface AuditEventInput {
  actorUserId?: string | null;
  actorRole?: "USER" | "ADMIN" | null;
  action: string;
  targetType: string;
  targetId: string;
  /**
   * Must be plain JSON-serializable data (matches Prisma's own
   * `Json?` column type for AuditLog.metadata) — not `unknown`, since
   * an `unknown` value could smuggle in something unserializable, and
   * typing it loosely as `Record<string, unknown>` doesn't actually
   * satisfy Prisma's generated input type (unknown isn't assignable to
   * InputJsonValue), which is exactly what was masked until `prisma
   * generate` ran against real generated types.
   */
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function writeAuditLog(event: AuditEventInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: event.actorUserId ?? undefined,
        actorRole: event.actorRole ?? undefined,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        metadata: event.metadata ?? undefined,
        ipAddress: event.ipAddress ?? undefined,
        userAgent: event.userAgent ?? undefined,
      },
    });
  } catch (error) {
    // Never log secrets here — event.metadata must already be scrubbed
    // by the caller (no passwords/OTPs/tokens).
    console.error("Failed to write audit log", { action: event.action, error });
  }
}
