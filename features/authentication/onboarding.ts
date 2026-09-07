import "server-only";

import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import type { OnboardingInput } from "@/lib/validation/auth";
import { provisionDefaultAccountsForUser } from "./provision-accounts";
import { AuthError } from "./errors";

export function incompleteOnboardingClaimWhere(userId: string) {
  return {
    userId,
    onboardingCompletedAt: null,
  };
}

export function assertOnboardingClaimWon(updatedCount: number) {
  if (updatedCount !== 1) {
    throw new AuthError(
      "ALREADY_ONBOARDED",
      "Onboarding has already been completed.",
      409
    );
  }
}

export async function completeOnboarding(
  userId: string,
  input: OnboardingInput
) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      userId: true,
    },
  });

  if (!profile) {
    throw new AuthError(
      "PROFILE_NOT_FOUND",
      "No profile found for this account.",
      404
    );
  }

  await prisma.$transaction(async (tx) => {
    /**
     * Atomic onboarding claim.
     *
     * Only one request can move the profile from:
     *
     * onboardingCompletedAt = null
     *
     * to:
     *
     * onboardingCompletedAt = timestamp
     *
     * Concurrent requests receive count = 0
     * and are rejected.
     */
    const claim = await tx.profile.updateMany({
      where: incompleteOnboardingClaimWhere(userId),
      data: {
        onboardingCompletedAt: new Date(),
      },
    });

    assertOnboardingClaimWon(claim.count);

    await tx.profile.update({
      where: { userId },
      data: {
        country: input.country,
        preferredFiatCurrency: input.preferredFiatCurrency,
        accountType: input.accountType,
        dateOfBirth: new Date(input.dateOfBirth),
        phoneNumber: input.phoneNumber,

        // Simulated identity verification only.
        // No external KYC provider is connected.
        kycStatus: "VERIFIED",
      },
    });

    await provisionDefaultAccountsForUser(
      tx,
      userId,
      input.preferredFiatCurrency
    );

    await tx.notification.create({
      data: {
        userId,
        type: "SYSTEM",
        title: "Welcome to PLATINUM TRUST BANK",
        body:
          "Your demo accounts are ready: a Current Account, a Savings Account, and a Spot Wallet with a starting demo balance.",
      },
    });
  });

  await writeAuditLog({
    actorUserId: userId,
    actorRole: "USER",
    action: "user.complete_onboarding",
    targetType: "User",
    targetId: userId,
  });
}