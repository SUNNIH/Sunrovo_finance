import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getAccountsForUser } from "@/features/banking/accounts";
import { listWithdrawalAllowlistEntries } from "@/features/authentication/account-security";
import { WithdrawClient } from "./withdraw-client";

export const metadata: Metadata = { title: "Withdraw" };

export default async function WithdrawPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [accounts, securitySetting, allowlistEntries] = await Promise.all([
    getAccountsForUser(user.id),
    prisma.securitySetting.findUnique({
      where: { userId: user.id },
      select: { transactionPinHash: true, withdrawalAllowlistEnabled: true },
    }),
    listWithdrawalAllowlistEntries(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      <div>
        <h1 className="text-page-title-mobile font-semibold tracking-tight text-text-primary sm:text-page-title">
          Withdraw Funds
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Request withdrawals to external bank accounts.
        </p>
      </div>
      <WithdrawClient
        accounts={accounts.map((a) => ({
          id: a.id,
          nickname: a.nickname,
          type: a.type,
          currencySymbol: a.currencySymbol,
          accountNumber: a.accountNumber,
          balanceCache: a.balanceCache.toString(),
        }))}
        hasPin={Boolean(securitySetting?.transactionPinHash)}
        allowlistEnabled={securitySetting?.withdrawalAllowlistEnabled ?? false}
        allowlistEntries={allowlistEntries.map((e) => ({
          id: e.id,
          destination: e.destination,
          assetSymbol: e.assetSymbol,
          network: e.network,
          label: e.label,
        }))}
      />
    </div>
  );
}
