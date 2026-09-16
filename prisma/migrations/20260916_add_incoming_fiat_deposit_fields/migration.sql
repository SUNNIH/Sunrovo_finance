-- AddIncomingFiatDepositFields
-- Add optional fields to Deposit model to support pending incoming fiat bank-transfer requests

ALTER TABLE "deposits" ADD COLUMN "bankAccountId" TEXT;
ALTER TABLE "deposits" ADD COLUMN "sendingBank" TEXT;
ALTER TABLE "deposits" ADD COLUMN "senderName" TEXT;
ALTER TABLE "deposits" ADD COLUMN "transferReference" TEXT;
ALTER TABLE "deposits" ADD COLUMN "customerNote" TEXT;
ALTER TABLE "deposits" ADD COLUMN "reviewedByAdminId" TEXT;
ALTER TABLE "deposits" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "deposits" ADD COLUMN "rejectionReason" TEXT;

-- Add indexes for status and bank account filtering
CREATE INDEX "deposits_status_idx" ON "deposits"("status");
CREATE INDEX "deposits_bankAccountId_idx" ON "deposits"("bankAccountId");

-- Add foreign keys for target bank account and admin reviewer
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_bankAccountId_fkey" 
  FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "deposits" ADD CONSTRAINT "deposits_reviewedByAdminId_fkey" 
  FOREIGN KEY ("reviewedByAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
