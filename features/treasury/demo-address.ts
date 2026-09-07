import { createHash } from "node:crypto";

const NETWORK_BY_ASSET: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum (ERC-20)",
  SOL: "Solana",
  XRP: "XRP Ledger",
  USDT: "Ethereum (ERC-20)",
  PLT: "PLT Demo Network",
};

const PREFIX_BY_ASSET: Record<string, string> = {
  BTC: "bc1demo",
  ETH: "0xdemo",
  SOL: "SoLDemo",
  XRP: "rDemo",
  USDT: "0xdemo",
  PLT: "pltdemo",
};

/**
 * Deterministic, obviously-fake deposit address — never a real, funded
 * blockchain address (product rule: "Never present a generated demo
 * address as a genuine custody address"). Stable per user+asset so the
 * same "address" is shown every time the user visits, matching real
 * deposit-address UX, without ever being usable on an actual chain.
 */
export function getDemoDepositAddress(userId: string, assetSymbol: string): { address: string; network: string } {
  const hash = createHash("sha256").update(`${userId}:${assetSymbol}`).digest("hex").slice(0, 32);
  const prefix = PREFIX_BY_ASSET[assetSymbol] ?? "demo";
  return {
    address: `${prefix}${hash}`,
    network: NETWORK_BY_ASSET[assetSymbol] ?? "Demo Network",
  };
}
