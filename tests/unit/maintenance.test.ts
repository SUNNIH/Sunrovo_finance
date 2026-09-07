import { describe, expect, it } from "vitest";
import { AuthError } from "@/features/authentication/errors";
import { rejectIfMaintenanceMode } from "@/lib/maintenance";

describe("rejectIfMaintenanceMode", () => {
  it("allows mutations when maintenance is off", () => {
    expect(() => rejectIfMaintenanceMode(false, "ignored")).not.toThrow();
  });

  it("blocks mutations with a 503 and the configured customer message", () => {
    try {
      rejectIfMaintenanceMode(true, "  Scheduled ledger freeze.  ");
      throw new Error("expected AuthError");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      const blocked = error as AuthError;
      expect(blocked.code).toBe("MAINTENANCE_MODE");
      expect(blocked.status).toBe(503);
      expect(blocked.message).toBe("Scheduled ledger freeze.");
    }
  });
});
