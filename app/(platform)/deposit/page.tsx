import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { getAccountsForUser } from "@/features/banking/accounts";
import { DepositClient } from "./deposit-client";

export const metadata: Metadata = { title: "Deposit" };

export default async function DepositPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const accounts = await getAccountsForUser(user.id);

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      <div>
        <h1 className="text-page-title-mobile font-semibold tracking-tight text-text-primary sm:text-page-title">
          Deposit
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Add simulated demo funds to your fiat accounts or spot wallet.
        </p>
      </div>
      <DepositClient
        accounts={accounts.map((a) => ({
          id: a.id,
          nickname: a.nickname,
          type: a.type,
          currencySymbol: a.currencySymbol,
          accountNumber: a.accountNumber,
          balanceCache: a.balanceCache.toString(),
        }))}
      />
    </div>
  );
}
