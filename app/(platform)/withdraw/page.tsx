import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getAccountsForUser } from "@/features/banking/accounts";
import { getWalletForUser } from "@/features/crypto/wallets";
import { listWithdrawalAllowlistEntries } from "@/features/authentication/account-security";
import { NETWORK_BY_ASSET } from "@/features/treasury/demo-address";
import { WithdrawClient } from "./withdraw-client";

export const metadata: Metadata = { title: "Withdraw" };

export default async function WithdrawPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [accounts, wallet, securitySetting, allowlistEntries] = await Promise.all([
    getAccountsForUser(user.id),
    getWalletForUser(user.id),
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
          Withdraw
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Simulated withdrawals — request transfers to external bank accounts or crypto destinations.
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
        cryptoAssets={
          wallet?.assets.map((a) => ({
            assetSymbol: a.assetSymbol,
            available: a.available.toString(),
            locked: a.locked.toString(),
          })) ?? []
        }
        hasPin={Boolean(securitySetting?.transactionPinHash)}
        allowlistEnabled={securitySetting?.withdrawalAllowlistEnabled ?? false}
        allowlistEntries={allowlistEntries.map((e) => ({
          id: e.id,
          destination: e.destination,
          assetSymbol: e.assetSymbol,
          network: e.network,
          label: e.label,
        }))}
        supportedNetworks={NETWORK_BY_ASSET}
      />
    </div>
  );
}
