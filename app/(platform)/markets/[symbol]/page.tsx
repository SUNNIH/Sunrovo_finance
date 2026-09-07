import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getAssetDetail } from "@/features/crypto/markets";
import { prisma } from "@/lib/db/prisma";
import { AssetDetailClient } from "./asset-detail-client";

interface AssetDetailPageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: AssetDetailPageProps): Promise<Metadata> {
  const { symbol } = await params;
  return { title: symbol.toUpperCase() };
}

export default async function AssetDetailPage({ params }: AssetDetailPageProps) {
  const { symbol } = await params;
  const user = await getCurrentUser();

  let detail;
  try {
    detail = await getAssetDetail(symbol.toUpperCase());
  } catch {
    notFound();
  }

  let holding: string | null = null;
  if (user) {
    const wallet = await prisma.cryptoWallet.findFirst({ where: { userId: user.id } });
    if (wallet) {
      const balance = await prisma.assetBalance.findUnique({
        where: { walletId_assetSymbol: { walletId: wallet.id, assetSymbol: detail.pair.baseAsset } },
      });
      holding = balance?.available.toString() ?? "0";
    }
    const isFavorite = await prisma.watchlist.findUnique({
      where: { userId_assetSymbol: { userId: user.id, assetSymbol: detail.pair.baseAsset } },
    });
    return (
      <AssetDetailClient
        pair={detail.pair}
        initialTicker={detail.ticker}
        candles={detail.candles}
        orderBook={detail.orderBook}
        trades={detail.trades}
        holding={holding}
        initialIsFavorite={Boolean(isFavorite)}
      />
    );
  }

  return (
    <AssetDetailClient
      pair={detail.pair}
      initialTicker={detail.ticker}
      candles={detail.candles}
      orderBook={detail.orderBook}
      trades={detail.trades}
      holding={null}
      initialIsFavorite={false}
    />
  );
}
