import { createHash } from "node:crypto";
import { NETWORK_BY_ASSET, PREFIX_BY_ASSET } from "./deposit-networks";

/**
 * Deterministic, obviously-fake deposit address — never a real, funded
 * blockchain address (product rule: "Never present a generated demo
 * address as a genuine custody address"). Stable per user+asset so the
 * same "address" is shown every time the user visits, matching real
 * deposit-address UX, without ever being usable on an actual chain.
 *
 * SERVER-ONLY: Uses node:crypto for deterministic hash generation.
 */
export function getDemoDepositAddress(userId: string, assetSymbol: string): { address: string; network: string } {
  const hash = createHash("sha256").update(`${userId}:${assetSymbol}`).digest("hex").slice(0, 32);
  const prefix = PREFIX_BY_ASSET[assetSymbol] ?? "demo";
  return {
    address: `${prefix}${hash}`,
    network: NETWORK_BY_ASSET[assetSymbol] ?? "Demo Network",
  };
}
