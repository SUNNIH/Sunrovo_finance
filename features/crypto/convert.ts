import "server-only";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { SUPPORTED_PAIRS } from "@/lib/bybit/instruments";
import { getTicker } from "@/lib/bybit/client";
import { getAssetPrecision } from "@/lib/money/format";
import { ensureAssetBalanceAndLedgerAccount } from "./wallet-helpers";
import { postLedgerEntries } from "@/lib/ledger/postLedgerEntries";
import { getOrCreatePlatformLedgerAccount, cryptoInventoryPoolName, tradingSettlementPoolName, feeRevenuePoolName } from "@/lib/ledger/platform-accounts";
import type { PostingLeg } from "@/lib/ledger/types";
import { AuthError } from "@/features/authentication/errors";

const CONVERSION_FEE_RATE = "0.0015"; // 0.15% spread, simulated
const QUOTE_TTL_MS = 30_000;

/**
 * Resolves an approximate USD-denominated price for any supported asset
 * (including USDT itself, treated as 1:1). Only asset combinations
 * involving USDT as one side are supported for the MVP converter — e.g.
 * BTC->USDT, USDT->ETH — not direct BTC->ETH. This mirrors what most
 * simplified "convert" flows on real platforms offer at this stage
 * (spec: "simplified cryptocurrency conversion service").
 */
async function getUsdtPrice(assetSymbol: string): Promise<Decimal> {
  if (assetSymbol === "USDT") return new Decimal(1);
  const pair = SUPPORTED_PAIRS.find((p) => p.baseAsset === assetSymbol && p.quoteAsset === "USDT");
  if (!pair) throw new AuthError("UNSUPPORTED_ASSET", `${assetSymbol} cannot be converted directly.`, 422);
  const ticker = await getTicker(pair.symbol);
  return new Decimal(ticker.lastPrice);
}

export async function createConversionQuote(userId: string, fromAsset: string, toAsset: string, fromAmount: string) {
  if (fromAsset === toAsset) {
    throw new AuthError("SAME_ASSET", "Choose two different assets to convert between.", 422);
  }
  if (fromAsset !== "USDT" && toAsset !== "USDT") {
    throw new AuthError(
      "UNSUPPORTED_CONVERSION",
      "Conversions must be to or from USDT for now (e.g. BTC → USDT, USDT → ETH).",
      422
    );
  }

  const fromPriceUsdt = await getUsdtPrice(fromAsset);
  const toPriceUsdt = await getUsdtPrice(toAsset);
  const rate = fromPriceUsdt.div(toPriceUsdt);

  const amountIn = new Decimal(fromAmount);
  const grossOut = amountIn.mul(rate);
  const fee = grossOut.mul(CONVERSION_FEE_RATE);
  const netOut = grossOut.sub(fee);

  const toPrecision = getAssetPrecision(toAsset);
  const fromPrecision = getAssetPrecision(fromAsset);

  const quote = await prisma.conversionQuote.create({
    data: {
      userId,
      fromAsset,
      toAsset,
      fromAmount: amountIn.toFixed(fromPrecision),
      toAmount: netOut.toFixed(toPrecision),
      rate: rate.toFixed(18),
      feeAmount: fee.toFixed(toPrecision),
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS),
    },
  });

  return quote;
}

export async function executeConversion(userId: string, quoteId: string, idempotencyKey: string) {
  const namespacedKey = `${userId}:${idempotencyKey}`;
  const existing = await prisma.conversion.findUnique({ where: { idempotencyKey: namespacedKey } });
  if (existing) return existing;

  const quote = await prisma.conversionQuote.findUnique({ where: { id: quoteId } });
  if (!quote || quote.userId !== userId) {
    throw new AuthError("QUOTE_NOT_FOUND", "This conversion quote was not found.", 404);
  }
  if (quote.consumedAt) {
    throw new AuthError("QUOTE_ALREADY_USED", "This quote has already been used.", 409);
  }
  if (quote.expiresAt.getTime() < Date.now()) {
    throw new AuthError("QUOTE_EXPIRED", "This quote has expired. Get a new one.", 410);
  }

  const wallet = await prisma.cryptoWallet.findFirst({ where: { userId } });
  if (!wallet) throw new AuthError("WALLET_NOT_FOUND", "No crypto wallet found for this account.", 404);

  const result = await prisma.$transaction(async (tx) => {
    const { balance: fromBalance, ledgerAccount: fromLedger } = await ensureAssetBalanceAndLedgerAccount(tx, wallet.id, quote.fromAsset);
    const { ledgerAccount: toLedger } = await ensureAssetBalanceAndLedgerAccount(tx, wallet.id, quote.toAsset);

    if (new Decimal(fromBalance.available.toString()).lt(quote.fromAmount.toString())) {
      throw new AuthError("INSUFFICIENT_FUNDS", `Insufficient ${quote.fromAsset} balance for this conversion.`, 422);
    }

    const inventoryFromPool = await getOrCreatePlatformLedgerAccount(tx, {
      type: "EQUITY",
      assetSymbol: quote.fromAsset,
      name: quote.fromAsset === "USDT" ? tradingSettlementPoolName(quote.fromAsset) : cryptoInventoryPoolName(quote.fromAsset),
    });
    const inventoryToPool = await getOrCreatePlatformLedgerAccount(tx, {
      type: "EQUITY",
      assetSymbol: quote.toAsset,
      name: quote.toAsset === "USDT" ? tradingSettlementPoolName(quote.toAsset) : cryptoInventoryPoolName(quote.toAsset),
    });
    const feePool = await getOrCreatePlatformLedgerAccount(tx, {
      type: "REVENUE",
      assetSymbol: quote.toAsset,
      name: feeRevenuePoolName(quote.toAsset),
    });

    const legs: PostingLeg[] = [
      { ledgerAccountId: fromLedger.id, direction: "DEBIT", assetSymbol: quote.fromAsset, amount: quote.fromAmount.toString(), referenceType: "Conversion", referenceId: quote.id },
      { ledgerAccountId: inventoryFromPool.id, direction: "CREDIT", assetSymbol: quote.fromAsset, amount: quote.fromAmount.toString(), referenceType: "Conversion", referenceId: quote.id },
      { ledgerAccountId: inventoryToPool.id, direction: "DEBIT", assetSymbol: quote.toAsset, amount: new Decimal(quote.toAmount.toString()).add(quote.feeAmount.toString()).toString(), referenceType: "Conversion", referenceId: quote.id },
      { ledgerAccountId: toLedger.id, direction: "CREDIT", assetSymbol: quote.toAsset, amount: quote.toAmount.toString(), referenceType: "Conversion", referenceId: quote.id },
      { ledgerAccountId: feePool.id, direction: "CREDIT", assetSymbol: quote.toAsset, amount: quote.feeAmount.toString(), referenceType: "Conversion", referenceId: quote.id },
    ];

    const { groupId } = await postLedgerEntries(tx, legs);

    await tx.assetBalance.update({
      where: { walletId_assetSymbol: { walletId: wallet.id, assetSymbol: quote.fromAsset } },
      data: { available: { decrement: quote.fromAmount.toString() } },
    });
    await tx.assetBalance.update({
      where: { walletId_assetSymbol: { walletId: wallet.id, assetSymbol: quote.toAsset } },
      data: { available: { increment: quote.toAmount.toString() } },
    });

    const conversion = await tx.conversion.create({
      data: {
        userId,
        quoteId: quote.id,
        fromAsset: quote.fromAsset,
        toAsset: quote.toAsset,
        fromAmount: quote.fromAmount.toString(),
        toAmount: quote.toAmount.toString(),
        feeAmount: quote.feeAmount.toString(),
        idempotencyKey: namespacedKey,
        ledgerGroupId: groupId,
        status: "COMPLETED",
      },
    });

    await tx.conversionQuote.update({ where: { id: quote.id }, data: { consumedAt: new Date() } });

    await tx.transaction.createMany({
      data: [
        {
          userId,
          type: "CONVERSION",
          direction: "DEBIT",
          status: "COMPLETED",
          assetSymbol: quote.fromAsset,
          amount: quote.fromAmount.toString(),
          counterparty: `Convert to ${quote.toAsset}`,
          referenceType: "Conversion",
          referenceId: conversion.id,
          ledgerGroupId: groupId,
          isDemo: true,
        },
        {
          userId,
          type: "CONVERSION",
          direction: "CREDIT",
          status: "COMPLETED",
          assetSymbol: quote.toAsset,
          amount: quote.toAmount.toString(),
          feeAmount: quote.feeAmount.toString(),
          counterparty: `Convert from ${quote.fromAsset}`,
          referenceType: "Conversion",
          referenceId: conversion.id,
          ledgerGroupId: groupId,
          isDemo: true,
        },
      ],
    });

    return conversion;
  });

  return result;
}
