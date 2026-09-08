import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { getAccountsForUser } from "@/features/banking/accounts";
import { listBeneficiaries } from "@/features/banking/beneficiaries";
import { TransferWizard } from "./transfer-wizard";

export const metadata: Metadata = { title: "Transfer Money" };

interface TransfersPageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function TransfersPage({ searchParams }: TransfersPageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { from } = await searchParams;
  const [accounts, beneficiaries] = await Promise.all([
    getAccountsForUser(user.id),
    listBeneficiaries(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title-mobile sm:text-page-title font-semibold tracking-tight text-text-primary">
          Transfer Money
        </h1>
        <p className="text-sm text-text-secondary max-w-2xl">
          Move funds between your PLT accounts or send to authorized beneficiaries. All transfers are verified and logged on the PLT ledger.
        </p>
      </div>

      <TransferWizard
        accounts={accounts.map((a) => ({
          id: a.id,
          nickname: a.nickname,
          type: a.type,
          accountNumber: a.accountNumber,
          currencySymbol: a.currencySymbol,
          balanceCache: a.balanceCache.toString(),
        }))}
        beneficiaries={beneficiaries.map((b) => ({
          id: b.id,
          type: b.type,
          nickname: b.nickname,
          accountName: b.accountName,
          accountNumber: b.accountNumber,
          bankName: b.bankName,
          isFavorite: b.isFavorite,
        }))}
        initialSourceAccountId={from}
      />
    </div>
  );
}
