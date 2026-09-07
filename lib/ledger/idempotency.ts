/**
 * Idempotency pattern for financial mutation endpoints (data memory:
 * "Financial mutation endpoints require idempotency").
 *
 * Every mutating financial route (POST /api/transfers, /api/orders,
 * /api/conversions, /api/deposits, /api/withdrawals, card operations)
 * must:
 *   1. Require an `Idempotency-Key` header (or body field) from the client.
 *   2. Look up an existing record with that key BEFORE doing any work.
 *   3. If found, return the original result unchanged (never re-run side
 *      effects, never re-post ledger entries).
 *   4. If not found, perform the mutation inside a single Prisma
 *      transaction that also creates the record carrying that key, so a
 *      concurrent duplicate request cannot race past this check.
 *
 * Each domain model (Transfer, CryptoOrder, Conversion, Deposit,
 * Withdrawal) has its own `idempotencyKey @unique` column rather than a
 * shared table, so a duplicate insert fails fast on the DB unique
 * constraint even under concurrent requests — this helper standardises
 * the read-first / catch-unique-violation shape around that column.
 */

export const IDEMPOTENCY_HEADER = "Idempotency-Key" as const;

export class MissingIdempotencyKeyError extends Error {
  constructor() {
    super("This financial operation requires an Idempotency-Key header.");
    this.name = "MissingIdempotencyKeyError";
  }
}

/** Postgres/Prisma unique-constraint violation code. */
const UNIQUE_VIOLATION_CODE = "P2002";

export function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION_CODE
  );
}

/**
 * Runs `execute` and, if it fails because another concurrent request just
 * inserted the same idempotency key, falls back to `loadExisting` instead
 * of surfacing a spurious 500. Callers still perform the initial
 * read-first check themselves for the common (non-racing) case.
 */
export async function withIdempotentFallback<T>(
  execute: () => Promise<T>,
  loadExisting: () => Promise<T | null>
): Promise<T> {
  try {
    return await execute();
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      const existing = await loadExisting();
      if (existing) return existing;
    }
    throw error;
  }
}
