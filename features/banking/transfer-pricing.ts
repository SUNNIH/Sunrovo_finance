import { Money } from "@/lib/money/money";

/** Flat demo fee for simulated external-bank transfers. Internal PLT transfers are free. */
export const EXTERNAL_TRANSFER_FEE = "2.50";

export type TransferDestinationKind = "own_account" | "internal_beneficiary" | "external_beneficiary";

/**
 * Pure fee-pricing logic, deliberately split out from transfers.ts (which
 * pulls in the Prisma client at module scope) so it can be unit-tested
 * without needing a live database connection or a generated Prisma client.
 */
export function computeTransferFee(destinationKind: TransferDestinationKind, currency: string): Money {
  return destinationKind === "external_beneficiary"
    ? Money.fromString(EXTERNAL_TRANSFER_FEE, currency)
    : Money.zero(currency);
}
