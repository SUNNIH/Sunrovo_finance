import * as React from "react";
import { cn } from "@/lib/utilities/cn";

export interface CryptoAssetMeta {
  name: string;
  symbol: string;
  glyph: string;
  isFictional?: boolean;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export const KNOWN_CRYPTO_ASSETS: Record<string, CryptoAssetMeta> = {
  BTC: {
    name: "Bitcoin",
    symbol: "BTC",
    glyph: "₿",
    bgClass: "bg-[#F7931A]/10 dark:bg-[#F7931A]/20",
    textClass: "text-[#F7931A]",
    borderClass: "border-[#F7931A]/30",
  },
  ETH: {
    name: "Ethereum",
    symbol: "ETH",
    glyph: "Ξ",
    bgClass: "bg-[#627EEA]/10 dark:bg-[#627EEA]/20",
    textClass: "text-[#627EEA]",
    borderClass: "border-[#627EEA]/30",
  },
  SOL: {
    name: "Solana",
    symbol: "SOL",
    glyph: "◎",
    bgClass: "bg-[#14F195]/10 dark:bg-[#14F195]/20",
    textClass: "text-[#10B981] dark:text-[#14F195]",
    borderClass: "border-[#14F195]/30",
  },
  XRP: {
    name: "XRP",
    symbol: "XRP",
    glyph: "✕",
    bgClass: "bg-surface-hover",
    textClass: "text-text-primary",
    borderClass: "border-border-strong",
  },
  USDT: {
    name: "Tether USD",
    symbol: "USDT",
    glyph: "₮",
    bgClass: "bg-[#26A17B]/10 dark:bg-[#26A17B]/20",
    textClass: "text-[#26A17B]",
    borderClass: "border-[#26A17B]/30",
  },
  PLT: {
    name: "PLT Token",
    symbol: "PLT",
    glyph: "P",
    isFictional: true,
    bgClass: "bg-primary-soft",
    textClass: "text-primary",
    borderClass: "border-primary/30",
  },
};

export function getCryptoAssetMeta(symbol: string): CryptoAssetMeta {
  const upper = symbol.toUpperCase();
  if (KNOWN_CRYPTO_ASSETS[upper]) {
    return KNOWN_CRYPTO_ASSETS[upper]!;
  }
  return {
    name: upper,
    symbol: upper,
    glyph: upper.slice(0, 3),
    bgClass: "bg-surface-hover",
    textClass: "text-text-secondary",
    borderClass: "border-border",
  };
}

interface CryptoAssetIconProps extends React.HTMLAttributes<HTMLDivElement> {
  symbol: string;
  size?: "sm" | "md" | "lg";
  showBadge?: boolean;
}

export function CryptoAssetIcon({
  symbol,
  size = "md",
  showBadge = false,
  className,
  ...props
}: CryptoAssetIconProps) {
  const meta = getCryptoAssetMeta(symbol);

  const sizeClasses = {
    sm: "h-7 w-7 text-xs rounded-md",
    md: "h-9 w-9 text-sm rounded-lg",
    lg: "h-11 w-11 text-base rounded-xl",
  }[size];

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center font-bold border transition-transform duration-150",
        meta.bgClass,
        meta.textClass,
        meta.borderClass,
        sizeClasses,
        className
      )}
      aria-hidden="true"
      {...props}
    >
      <span>{meta.glyph}</span>
      {showBadge && meta.isFictional && (
        <span
          className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-warning ring-2 ring-background"
          title="PLT Token"
        />
      )}
    </div>
  );
}
