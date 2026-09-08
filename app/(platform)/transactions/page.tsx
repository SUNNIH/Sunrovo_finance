import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { listTransactions } from "@/features/banking/transactions";
import { TransactionsClient } from "./transactions-client";

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { items, nextCursor } = await listTransactions(user.id, {});

  const serializable = items.map((t) => ({
    id: t.id,
    type: t.type,
    direction: t.direction,
    status: t.status,
    assetSymbol: t.assetSymbol,
    amount: t.amount.toString(),
    feeAmount: t.feeAmount.toString(),
    counterparty: t.counterparty,
    narration: t.narration,
    isDemo: t.isDemo,
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      <div>
        <h1 className="text-page-title-mobile font-semibold tracking-tight text-text-primary sm:text-page-title">
          Transactions
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Your full transfer, deposit, trade, and conversion history.
        </p>
      </div>
      <TransactionsClient initialItems={serializable} initialCursor={nextCursor} />
    </div>
  );
}
