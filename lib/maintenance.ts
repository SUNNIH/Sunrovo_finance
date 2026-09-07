import "server-only";
import { getPlatformSettings } from "@/features/admin/operations";
import { AuthError } from "@/features/authentication/errors";

export async function assertPlatformOperational(role?: "USER" | "ADMIN") {
  if (role === "ADMIN") return;
  const settings = await getPlatformSettings();
  if (settings.maintenanceMode) {
    throw new AuthError(
      "MAINTENANCE_MODE",
      settings.maintenanceMessage || "PLT is temporarily undergoing maintenance.",
      503
    );
  }
}

export function rejectIfMaintenanceMode(
  maintenanceMode: boolean,
  message?: string
) {
  if (!maintenanceMode) return;

  throw new AuthError(
    "MAINTENANCE_MODE",
    message?.trim() || "PLT is temporarily undergoing maintenance.",
    503
  );
}