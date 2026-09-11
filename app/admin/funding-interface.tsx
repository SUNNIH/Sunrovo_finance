"use client";

import * as React from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";

type User = {
  id: string;
  email: string;
  role: string;
  profile: { fullName: string; preferredFiatCurrency: string } | null;
  bankAccounts: Array<{
    id: string;
    type: string;
    currencySymbol: string;
    accountNumber: string;
    nickname: string | null;
    balanceCache: string;
  }>;
  cryptoWallets: Array<{ id: string; label: string }>;
};

export function FundingInterface() {
  const [users, setUsers] = React.useState<User[]>([]);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [searchEmail, setSearchEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const [targetType, setTargetType] = React.useState<"account" | "wallet">("account");
  const [targetAccountId, setTargetAccountId] = React.useState("");
  const [targetWalletId, setTargetWalletId] = React.useState("");
  const [assetSymbol, setAssetSymbol] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function searchUsers() {
    setLoading(true);
    setError(null);
    try {
      const url = searchEmail
        ? `/api/admin/funding?email=${encodeURIComponent(searchEmail)}`
        : "/api/admin/funding";
      const response = await fetch(url).then((r) => r.json());
      setUsers(response.data?.users ?? []);
    } catch {
      setError("Could not load users.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void searchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectUser(user: User) {
    setSelectedUser(user);
    setTargetAccountId("");
    setTargetWalletId("");
    setAssetSymbol("");
    setAmount("");
    setReason("");
    setError(null);
    setSuccess(null);
  }

  function handleTargetTypeChange(type: "account" | "wallet") {
    setTargetType(type);
    setTargetAccountId("");
    setTargetWalletId("");
    setAssetSymbol("");
  }

  function handleAccountChange(accountId: string) {
    setTargetAccountId(accountId);
    const account = selectedUser?.bankAccounts.find((a) => a.id === accountId);
    if (account) {
      setAssetSymbol(account.currencySymbol);
    }
  }

  function handleWalletChange(walletId: string) {
    setTargetWalletId(walletId);
    setAssetSymbol("");
  }

  async function handleFund(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedUser) return;

    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      await postJson("/api/admin/funding", {
        targetUserId: selectedUser.id,
        targetAccountId: targetType === "account" ? targetAccountId : undefined,
        targetWalletId: targetType === "wallet" ? targetWalletId : undefined,
        assetSymbol,
        amount,
        reason,
      });

      setSuccess(
        `Successfully funded ${selectedUser.profile?.fullName ?? selectedUser.email} with ${amount} ${assetSymbol}.`
      );
      setTargetAccountId("");
      setTargetWalletId("");
      setAssetSymbol("");
      setAmount("");
      setReason("");
      setSelectedUser(null);
      await searchUsers();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Funding failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Funding</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger">
            {error}
          </p>
        )}
        {success && (
          <p role="alert" className="rounded-md bg-success-soft p-3 text-sm text-success">
            {success}
          </p>
        )}

        {!selectedUser ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="email"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void searchUsers();
                  }}
                  placeholder="Search by email..."
                  className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <Button onClick={searchUsers} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {users.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  {loading ? "Loading users..." : "No users found."}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex cursor-pointer items-center justify-between rounded-md border border-border p-3 hover:bg-surface-hover"
                      onClick={() => selectUser(user)}
                    >
                      <div>
                        <p className="font-medium">
                          {user.profile?.fullName ?? "No name"}
                        </p>
                        <p className="text-sm text-text-secondary">{user.email}</p>
                      </div>
                      <Button size="sm" variant="outline">
                        Select
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleFund} className="flex flex-col gap-4">
            <div className="rounded-md border border-border bg-surface-secondary p-3">
              <p className="font-medium">
                {selectedUser.profile?.fullName ?? "No name"}
              </p>
              <p className="text-sm text-text-secondary">{selectedUser.email}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSelectedUser(null)}
                className="mt-2"
              >
                Change user
              </Button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">Target type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="radio"
                    name="targetType"
                    value="account"
                    checked={targetType === "account"}
                    onChange={() => handleTargetTypeChange("account")}
                    className="h-4 w-4 text-primary"
                  />
                  Bank Account
                </label>
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="radio"
                    name="targetType"
                    value="wallet"
                    checked={targetType === "wallet"}
                    onChange={() => handleTargetTypeChange("wallet")}
                    className="h-4 w-4 text-primary"
                  />
                  Crypto Wallet
                </label>
              </div>
            </div>

            {targetType === "account" && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="account" className="text-sm font-medium text-text-primary">
                  Bank account
                </label>
                <select
                  id="account"
                  value={targetAccountId}
                  onChange={(e) => handleAccountChange(e.target.value)}
                  className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                >
                  <option value="">Select an account</option>
                  {selectedUser.bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.nickname || account.type} ({account.currencySymbol}) —{" "}
                      {account.accountNumber} — Balance: {account.balanceCache}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {targetType === "wallet" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="wallet" className="text-sm font-medium text-text-primary">
                    Crypto wallet
                  </label>
                  <select
                    id="wallet"
                    value={targetWalletId}
                    onChange={(e) => handleWalletChange(e.target.value)}
                    className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  >
                    <option value="">Select a wallet</option>
                    {selectedUser.cryptoWallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="assetSymbol"
                    className="text-sm font-medium text-text-primary"
                  >
                    Asset symbol
                  </label>
                  <input
                    id="assetSymbol"
                    type="text"
                    value={assetSymbol}
                    onChange={(e) => setAssetSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g. USDT, BTC, ETH"
                    className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="amount" className="text-sm font-medium text-text-primary">
                Amount
              </label>
              <input
                id="amount"
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="reason" className="text-sm font-medium text-text-primary">
                Reason
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for funding (min 5 characters)"
                className="min-h-20 rounded-md border border-border bg-surface p-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              />
            </div>

            <div className="rounded-md border border-warning bg-warning-soft p-3">
              <p className="text-sm text-warning-dark">
                <strong>Review before confirming:</strong>
              </p>
              <ul className="mt-1 list-inside list-disc text-sm text-warning-dark">
                <li>User: {selectedUser.profile?.fullName ?? selectedUser.email}</li>
                <li>
                  Target:{" "}
                  {targetType === "account"
                    ? selectedUser.bankAccounts.find((a) => a.id === targetAccountId)
                        ?.nickname || "Bank account"
                    : selectedUser.cryptoWallets.find((w) => w.id === targetWalletId)
                        ?.label || "Crypto wallet"}
                </li>
                <li>
                  Amount: {amount} {assetSymbol}
                </li>
                <li>Reason: {reason}</li>
              </ul>
            </div>

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Processing..." : "Confirm and fund account"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
