"use client";

import * as React from "react";
import { CreditCard, Lock, Plus, ShieldAlert, Unlock } from "lucide-react";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";

interface CardView {
  id: string;
  formFactor: "PHYSICAL" | "VIRTUAL";
  maskedNumber: string;
  expiryMonth: number;
  expiryYear: number;
  status: "ACTIVE" | "FROZEN" | "LOST" | "CANCELLED";
  spendingLimit: string | null;
  currencySymbol: string;
}

interface CardTransactionView {
  id: string;
  merchant: string;
  amount: string;
  currencySymbol: string;
  createdAt: string;
}

const STATUS_VARIANT: Record<CardView["status"], "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "success",
  FROZEN: "warning",
  LOST: "danger",
  CANCELLED: "neutral",
};

export function CardsClient({ initialCards }: { initialCards: CardView[] }) {
  const [cards, setCards] = React.useState(initialCards);
  const [requesting, setRequesting] = React.useState(false);
  const [expandedCardId, setExpandedCardId] = React.useState<string | null>(null);
  const [transactions, setTransactions] = React.useState<Record<string, CardTransactionView[]>>({});
  const [limitDrafts, setLimitDrafts] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  async function requestCard(formFactor: "PHYSICAL" | "VIRTUAL") {
    setError(null);
    setRequesting(true);
    try {
      const result = await postJson<{ card: CardView }>("/api/cards", { formFactor, currencySymbol: "USD" });
      setCards((prev) => [result.card, ...prev]);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    } finally {
      setRequesting(false);
    }
  }

  async function toggleFreeze(card: CardView) {
    const frozen = card.status !== "FROZEN";
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, status: frozen ? "FROZEN" : "ACTIVE" } : c)));
    try {
      await postJson(`/api/cards/${card.id}/freeze`, { frozen });
    } catch {
      setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, status: card.status } : c)));
    }
  }

  async function reportLost(cardId: string) {
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, status: "LOST" } : c)));
    await postJson(`/api/cards/${cardId}/report-lost`, {}).catch(() => undefined);
  }

  async function saveLimit(cardId: string) {
    const value = limitDrafts[cardId];
    if (!value) return;
    try {
      await postJson(`/api/cards/${cardId}/spending-limit`, { spendingLimit: value });
      setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, spendingLimit: value } : c)));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    }
  }

  async function toggleTransactions(cardId: string) {
    if (expandedCardId === cardId) {
      setExpandedCardId(null);
      return;
    }
    setExpandedCardId(cardId);
    if (!transactions[cardId]) {
      const response = await fetch(`/api/cards/${cardId}/transactions`);
      const payload = await response.json();
      setTransactions((prev) => ({ ...prev, [cardId]: payload.data?.transactions ?? [] }));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button onClick={() => requestCard("VIRTUAL")} disabled={requesting}>
          <Plus className="h-4 w-4" /> Request virtual card
        </Button>
        <Button variant="outline" onClick={() => requestCard("PHYSICAL")} disabled={requesting}>
          <Plus className="h-4 w-4" /> Request physical card
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}

      {cards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <CreditCard className="h-8 w-8 text-text-tertiary" aria-hidden="true" />
            <p className="text-sm text-text-secondary">No cards yet. Request one above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <Card key={card.id}>
              <CardContent className="flex flex-col gap-4 p-5">
                <div className="rounded-lg bg-gradient-to-br from-primary to-primary-hover p-4 text-primary-foreground">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">PLT {card.formFactor === "VIRTUAL" ? "Virtual" : "Debit"}</span>
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <p className="mt-6 font-mono text-lg tracking-widest financial-value">{card.maskedNumber}</p>
                  <p className="mt-1 text-xs financial-value">
                    Expires {String(card.expiryMonth).padStart(2, "0")}/{card.expiryYear}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <Badge variant={STATUS_VARIANT[card.status]}>{card.status}</Badge>
                  <span className="text-body-sm text-text-secondary">
                    Limit:{" "}
                    <span className="financial-value">{card.spendingLimit ?? "Not set"}</span> {card.currencySymbol}
                  </span>
                </div>

                {card.status !== "LOST" && card.status !== "CANCELLED" && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => toggleFreeze(card)}>
                      {card.status === "FROZEN" ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                      {card.status === "FROZEN" ? "Unfreeze" : "Freeze"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => reportLost(card.id)}>
                      <ShieldAlert className="h-3.5 w-3.5" /> Report lost
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleTransactions(card.id)}>
                      Transactions
                    </Button>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <TextField
                    label="Set spending limit"
                    id={`limit-${card.id}`}
                    inputMode="decimal"
                    value={limitDrafts[card.id] ?? ""}
                    onChange={(e) => setLimitDrafts((prev) => ({ ...prev, [card.id]: e.target.value }))}
                    className="financial-value"
                  />
                  <Button size="sm" variant="outline" onClick={() => saveLimit(card.id)}>
                    Save
                  </Button>
                </div>

                {expandedCardId === card.id && (
                  <div className="flex flex-col divide-y divide-border border-t border-border pt-2">
                    {(transactions[card.id] ?? []).length === 0 ? (
                      <p className="py-3 text-center text-body-sm text-text-secondary">No transactions yet.</p>
                    ) : (
                      transactions[card.id]!.map((txn) => (
                        <div key={txn.id} className="flex items-center justify-between py-2 text-sm">
                          <span className="text-text-primary">{txn.merchant}</span>
                          <span className="financial-value text-text-secondary">
                            {txn.amount} {txn.currencySymbol}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
