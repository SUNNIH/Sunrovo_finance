import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { PostingLeg, PostLedgerEntriesResult } from "./types";
import { EmptyPostingError, LedgerImbalanceError } from "./errors";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Validate that a set of posting legs is balanced (sum of debits equals
 * sum of credits, per asset) before anything is written. This is the
 * enforcement point for "ledger postings must be atomic" and "every
 * financial event must create balanced ledger entries."
 */
export function assertBalancedPosting(legs: PostingLeg[]): void {
  if (legs.length < 2) {
    throw new EmptyPostingError();
  }

  const totals = new Map<string, { debit: Decimal; credit: Decimal }>();

  for (const leg of legs) {
  const current = totals.get(leg.assetSymbol) ?? {
    debit: new Decimal(0),
    credit: new Decimal(0),
  };

  const amount = new Decimal(leg.amount);

  // Every financial posting must have
  // a strictly positive, finite amount.
  if (!amount.isFinite() || amount.lte(0)) {
    throw new Error(
      `Invalid ledger posting amount for ${leg.assetSymbol}`
    );
  }

  // Reject invalid posting directions.
  if (
    leg.direction !== "DEBIT" &&
    leg.direction !== "CREDIT"
  ) {
    throw new Error(
      `Invalid ledger posting direction for ${leg.assetSymbol}`
    );
  }

  if (leg.direction === "DEBIT") {
    current.debit = current.debit.add(amount);
  } else {
    current.credit = current.credit.add(amount);
  }

  totals.set(leg.assetSymbol, current);
}

  for (const [assetSymbol, { debit, credit }] of totals.entries()) {
    if (!debit.eq(credit)) {
      throw new LedgerImbalanceError(assetSymbol, debit.toFixed(), credit.toFixed());
    }
  }
}

/**
 * Post a balanced set of ledger entries atomically.
 *
 * Callers MUST invoke this inside an existing `prisma.$transaction`
 * (pass the transaction client, not the root PrismaClient) so that the
 * ledger rows, the domain record (Transfer/CryptoOrder/Conversion/...),
 * the user-facing Transaction row, and any balance-cache update commit or
 * roll back together.
 */
export async function postLedgerEntries(
  tx: TransactionClient,
  legs: PostingLeg[]
): Promise<PostLedgerEntriesResult> {
  assertBalancedPosting(legs);

  const groupId = randomUUID();

  await tx.ledgerEntry.createMany({
    data: legs.map((leg) => ({
      ledgerAccountId: leg.ledgerAccountId,
      direction: leg.direction,
      assetSymbol: leg.assetSymbol,
      amount: leg.amount.toString(),
      referenceType: leg.referenceType,
      referenceId: leg.referenceId,
      groupId,
    })),
  });

  return { groupId };
}

/**
 * Reconcile a BankAccount or CryptoWallet AssetBalance cache against the
 * ledger. The cache exists purely for fast reads (dashboard, account
 * lists); this function is the only sanctioned way to bring it back in
 * sync, and it always derives the value from LedgerEntry rows rather than
 * accepting a caller-supplied number.
 */
export async function reconcileLedgerAccountBalance(
  tx: TransactionClient,
  ledgerAccountId: string
): Promise<Decimal> {
  const entries = await tx.ledgerEntry.findMany({
    where: { ledgerAccountId },
    select: { direction: true, amount: true },
  });

  let balance = new Decimal(0);
  for (const entry of entries) {
    const amount = new Decimal(entry.amount.toString());
    balance = entry.direction === "DEBIT" ? balance.add(amount) : balance.sub(amount);
  }
  return balance;
}

export type { Prisma };
