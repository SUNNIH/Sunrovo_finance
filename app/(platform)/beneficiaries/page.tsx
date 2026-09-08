import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { listBeneficiaries } from "@/features/banking/beneficiaries";
import { BeneficiariesClient } from "./beneficiaries-client";

export const metadata: Metadata = { title: "Beneficiaries" };

export default async function BeneficiariesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const beneficiaries = await listBeneficiaries(user.id);

  const serializable = beneficiaries.map((b) => ({
    id: b.id,
    type: b.type,
    nickname: b.nickname,
    accountName: b.accountName,
    accountNumber: b.accountNumber,
    bankName: b.bankName,
    isFavorite: b.isFavorite,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title-mobile sm:text-page-title font-semibold tracking-tight text-text-primary">
          Saved Beneficiaries
        </h1>
        <p className="text-sm text-text-secondary max-w-2xl">
          Authorized recipients for instant and scheduled transfers. Adding or modifying recipients is protected with password authentication.
        </p>
      </div>
      <BeneficiariesClient initialBeneficiaries={serializable} />
    </div>
  );
}
