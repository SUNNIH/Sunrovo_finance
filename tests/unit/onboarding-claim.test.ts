import { describe, expect, it } from "vitest";
import { AuthError } from "@/features/authentication/errors";
import { assertOnboardingClaimWon, incompleteOnboardingClaimWhere } from "@/features/authentication/onboarding";

describe("onboarding claim", () => {
  it("targets only a profile that has not completed onboarding", () => {
    expect(incompleteOnboardingClaimWhere("user_1")).toEqual({
      userId: "user_1",
      onboardingCompletedAt: null,
    });
  });

  it("lets exactly one winner proceed to provisioning", () => {
    expect(() => assertOnboardingClaimWon(1)).not.toThrow();
  });

  it("treats a duplicate or concurrent loser as already onboarded", () => {
    expect(() => assertOnboardingClaimWon(0)).toThrow(AuthError);
    try {
      assertOnboardingClaimWon(0);
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      const blocked = error as AuthError;
      expect(blocked.code).toBe("ALREADY_ONBOARDED");
      expect(blocked.status).toBe(409);
    }
  });
});
