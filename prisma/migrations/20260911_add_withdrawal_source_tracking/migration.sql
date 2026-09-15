-- Add source account/wallet tracking to Withdrawal for exact refund provenance
-- Migration: Add sourceAccountId and sourceWalletId to withdrawals table

ALTER TABLE "withdrawals" ADD COLUMN "sourceAccountId" TEXT;
ALTER TABLE "withdrawals" ADD COLUMN "sourceWalletId" TEXT;

-- Add foreign keys
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_sourceAccountId_fkey" 
  FOREIGN KEY ("sourceAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_sourceWalletId_fkey" 
  FOREIGN KEY ("sourceWalletId") REFERENCES "crypto_wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for performance
CREATE INDEX "withdrawals_sourceAccountId_idx" ON "withdrawals"("sourceAccountId");
CREATE INDEX "withdrawals_sourceWalletId_idx" ON "withdrawals"("sourceWalletId");
