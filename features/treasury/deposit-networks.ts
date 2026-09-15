/**
 * Deposit Network Configuration (Browser-Safe)
 *
 * Shared configuration for supported crypto assets and their networks.
 * NO node:* imports - safe for client components.
 *
 * Used by:
 * - Client: deposit-client.tsx (asset/network display)
 * - Server: demo-address.ts (address generation)
 */

export const NETWORK_BY_ASSET: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum (ERC-20)",
  SOL: "Solana",
  XRP: "XRP Ledger",
  USDT: "Ethereum (ERC-20)",
  PLT: "PLT Demo Network",
};

export const PREFIX_BY_ASSET: Record<string, string> = {
  BTC: "bc1demo",
  ETH: "0xdemo",
  SOL: "SoLDemo",
  XRP: "rDemo",
  USDT: "0xdemo",
  PLT: "pltdemo",
};
