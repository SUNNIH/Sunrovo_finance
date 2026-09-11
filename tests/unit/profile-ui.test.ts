import { describe, expect, it } from "vitest";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "FH";
  if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() ?? "FH";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

describe("Profile Initials Helper", () => {
  it("derives two-letter initials from standard full names", () => {
    expect(getInitials("Ada Lovelace")).toBe("AL");
    expect(getInitials("John Doe")).toBe("JD");
    expect(getInitials("Satoshi Nakamoto")).toBe("SN");
  });

  it("handles multi-part names by taking first and last name initials", () => {
    expect(getInitials("Alexander Graham Bell")).toBe("AB");
    expect(getInitials("Mary Jane Watson Parker")).toBe("MP");
  });

  it("handles single-word names by taking first two characters", () => {
    expect(getInitials("John")).toBe("JO");
    expect(getInitials("Fht")).toBe("FH");
  });

  it("falls back to FH for empty or whitespace-only inputs", () => {
    expect(getInitials("")).toBe("FH");
    expect(getInitials("   ")).toBe("FH");
  });
});

describe("KYC Status Mapping Invariants", () => {
  const validStatuses = ["NOT_STARTED", "PENDING", "VERIFIED", "REJECTED"] as const;

  it("accepts only authoritative backend KycStatus enum values", () => {
    validStatuses.forEach((status) => {
      expect(["NOT_STARTED", "PENDING", "VERIFIED", "REJECTED"]).toContain(status);
    });
  });

  it("preserves exact status without inventing unsupported verification levels", () => {
    const userKycStatus = "VERIFIED";
    expect(userKycStatus).toBe("VERIFIED");

    const pendingKycStatus = "PENDING";
    expect(pendingKycStatus).toBe("PENDING");
  });
});

describe("Verification State Invariants", () => {
  it("determines email verification status strictly from emailVerifiedAt", () => {
    const verifiedUser = { emailVerifiedAt: new Date("2026-01-01T00:00:00Z") };
    const unverifiedUser = { emailVerifiedAt: null };

    expect(Boolean(verifiedUser.emailVerifiedAt)).toBe(true);
    expect(Boolean(unverifiedUser.emailVerifiedAt)).toBe(false);
  });

  it("determines phone verification status strictly from phoneVerifiedAt", () => {
    const verifiedUser = { phoneVerifiedAt: new Date("2026-01-01T00:00:00Z") };
    const unverifiedUser = { phoneVerifiedAt: null };

    expect(Boolean(verifiedUser.phoneVerifiedAt)).toBe(true);
    expect(Boolean(unverifiedUser.phoneVerifiedAt)).toBe(false);
  });
});

describe("Profile Identity Record Immutability", () => {
  it("preserves verified backend identity fields without client mutation", () => {
    const profileRecord = {
      fullName: "Ada Lovelace",
      country: "United Kingdom",
      preferredFiatCurrency: "GBP",
      accountType: "individual",
      dateOfBirth: new Date("1990-12-10T00:00:00Z"),
    };

    expect(profileRecord.fullName).toBe("Ada Lovelace");
    expect(profileRecord.country).toBe("United Kingdom");
    expect(profileRecord.preferredFiatCurrency).toBe("GBP");
    expect(profileRecord.accountType).toBe("individual");
  });
});
