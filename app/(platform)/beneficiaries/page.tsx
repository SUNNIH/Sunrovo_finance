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
      <div>
        <h1 className="text-page-title-mobile text-text-primary sm:text-page-title">Beneficiaries</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Saved recipients for faster transfers. Adding a new one requires your password.
        </p>
      </div>
      <BeneficiariesClient initialBeneficiaries={serializable} />
    </div>
  );
}
