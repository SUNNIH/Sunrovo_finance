export const UNSCOPED_ALLOWLIST_VALUE = "";

export interface WithdrawalAllowlistScope {
  destination: string;
  assetSymbol?: string | null;
  network?: string | null;
}

export function normalizeWithdrawalNetwork(network?: string | null): string {
  return network?.trim().toUpperCase() || UNSCOPED_ALLOWLIST_VALUE;
}

export function normalizeWithdrawalAllowlistScope(input: WithdrawalAllowlistScope) {
  return {
    destination: input.destination.trim(),
    assetSymbol: input.assetSymbol?.trim().toUpperCase() || UNSCOPED_ALLOWLIST_VALUE,
    network: normalizeWithdrawalNetwork(input.network),
  };
}

/** A blank stored scope explicitly means "all assets" or "all networks". */
export function isDestinationAllowlisted(
  entry: WithdrawalAllowlistScope,
  request: WithdrawalAllowlistScope
): boolean {
  const normalizedEntry = normalizeWithdrawalAllowlistScope(entry);
  const normalizedRequest = normalizeWithdrawalAllowlistScope(request);
  return normalizedEntry.destination === normalizedRequest.destination
    && (normalizedEntry.assetSymbol === UNSCOPED_ALLOWLIST_VALUE || normalizedEntry.assetSymbol === normalizedRequest.assetSymbol)
    && (normalizedEntry.network === UNSCOPED_ALLOWLIST_VALUE || normalizedEntry.network === normalizedRequest.network);
}
