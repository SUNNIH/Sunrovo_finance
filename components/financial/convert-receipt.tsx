"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight, Wallet, History, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CryptoAssetIcon, getCryptoAssetMeta } from "@/components/financial/crypto-asset-icon";

export interface ConversionReceiptData {
  id: string;
  fromAsset: string;
  toAsset: string;
  fromAmount: string;
  toAmount: string;
  feeAmount: string;
  status: string;
  createdAt?: string | Date;
}

interface ConvertReceiptProps {
  conversion: ConversionReceiptData;
  onReset: () => void;
}

export function ConvertReceipt({ conversion, onReset }: ConvertReceiptProps) {
  const fromMeta = getCryptoAssetMeta(conversion.fromAsset);
  const toMeta = getCryptoAssetMeta(conversion.toAsset);

  const formattedDate = conversion.createdAt
    ? new Date(conversion.createdAt).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <Card className="mx-auto w-full max-w-lg rounded-2xl border-border bg-surface shadow-xs animate-fade-in-up">
      <CardContent className="flex flex-col gap-6 p-6 sm:p-8">
        {/* Success Header */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success shadow-xs ring-4 ring-success/10">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </div>
          <h2 className="text-section-title text-text-primary">Conversion Settled</h2>
          <p className="mt-1 text-xs text-text-secondary sm:text-sm">
            Your asset conversion has been confirmed and settled to your crypto wallet.
          </p>
        </div>

        {/* Conversion Flow Visual */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated p-4">
          {/* From */}
          <div className="flex items-center gap-3">
            <CryptoAssetIcon symbol={conversion.fromAsset} size="md" showBadge />
            <div className="flex flex-col">
              <span className="text-xs text-text-tertiary">Converted</span>
              <span className="financial-value font-mono text-sm font-semibold text-text-primary sm:text-base">
                {conversion.fromAmount} {conversion.fromAsset}
              </span>
              <span className="text-[11px] text-text-tertiary">{fromMeta.name}</span>
            </div>
          </div>

          <ArrowRight className="h-5 w-5 text-text-tertiary shrink-0" aria-hidden="true" />

          {/* To */}
          <div className="flex items-center gap-3 text-right">
            <div className="flex flex-col">
              <span className="text-xs text-text-tertiary">Received</span>
              <span className="financial-value font-mono text-sm font-semibold text-success sm:text-base">
                +{conversion.toAmount} {conversion.toAsset}
              </span>
              <span className="text-[11px] text-text-tertiary">{toMeta.name}</span>
            </div>
            <CryptoAssetIcon symbol={conversion.toAsset} size="md" showBadge />
          </div>
        </div>

        {/* Transaction Metadata Breakdown */}
        <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border bg-surface-elevated px-4 py-1 text-xs">
          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-tertiary">Status</span>
            <Badge variant="success" className="text-[11px] font-semibold uppercase">
              {conversion.status}
            </Badge>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-tertiary">Conversion Fee</span>
            <span className="financial-value font-mono font-medium text-text-primary">
              {conversion.feeAmount} {conversion.toAsset}
            </span>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-tertiary">Reference ID</span>
            <span className="font-mono text-[11px] text-text-secondary select-all">
              {conversion.id}
            </span>
          </div>

          {formattedDate && (
            <div className="flex items-center justify-between py-2.5">
              <span className="text-text-tertiary">Timestamp</span>
              <span className="font-mono text-[11px] text-text-secondary">
                {formattedDate}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5 pt-2">
          <Button
            type="button"
            onClick={onReset}
            size="lg"
            className="touch-target w-full font-semibold cursor-pointer"
          >
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            New Conversion
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Link href="/wallets" className="w-full">
              <Button
                type="button"
                variant="outline"
                className="touch-target w-full text-xs font-semibold cursor-pointer"
              >
                <Wallet className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                View Wallets
              </Button>
            </Link>

            <Link href="/transactions" className="w-full">
              <Button
                type="button"
                variant="outline"
                className="touch-target w-full text-xs font-semibold cursor-pointer"
              >
                <History className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Transactions
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
