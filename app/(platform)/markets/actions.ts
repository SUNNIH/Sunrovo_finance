"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getTradingInstruments } from "@/lib/market/service";

export async function toggleWatchlist(
  assetSymbol: string,
  add: boolean
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    // Normalize and validate the symbol.
    const symbol = assetSymbol.trim().toUpperCase();

    if (!/^[A-Z0-9]{2,20}$/.test(symbol)) {
      return {
        success: false,
        error: "Invalid asset symbol",
      };
    }

    if (add) {
      // The asset must already exist in the financial registry.
      const asset = await prisma.asset.findUnique({
        where: { symbol },
      });

      if (
        !asset ||
        asset.type !== "CRYPTO" ||
        !asset.isActive
      ) {
        return {
          success: false,
          error: "Asset is not supported",
        };
      }

      // Confirm the asset belongs to an active market.
      const instruments = await getTradingInstruments({
        activeOnly: true,
      });

      const supported = instruments.some(
        (instrument) => instrument.baseAsset === symbol
      );

      if (!supported) {
        return {
          success: false,
          error: "No active market found for this asset",
        };
      }

      await prisma.watchlist.upsert({
        where: {
          userId_assetSymbol: {
            userId: user.id,
            assetSymbol: symbol,
          },
        },
        create: {
          userId: user.id,
          assetSymbol: symbol,
        },
        update: {},
      });
    } else {
      // Removing a favorite must work even if Bybit is offline.
      await prisma.watchlist.deleteMany({
        where: {
          userId: user.id,
          assetSymbol: symbol,
        },
      });
    }

    revalidatePath("/markets");

    return { success: true };
  } catch (error) {
    console.error("Failed to toggle watchlist:", error);

    return {
      success: false,
      error: "Failed to update watchlist",
    };
  }
}