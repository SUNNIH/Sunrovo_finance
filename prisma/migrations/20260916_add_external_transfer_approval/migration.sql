-- AddExternalTransferApproval
-- Add admin review fields to Transfer model for external bank transfer approval

ALTER TABLE "transfers" ADD COLUMN "reviewedByAdminId" TEXT;
ALTER TABLE "transfers" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "transfers" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "transfers" ADD COLUMN "reversalLedgerGroupId" TEXT;

-- Add index for status filtering
CREATE INDEX "transfers_status_idx" ON "transfers"("status");

-- Add foreign key for admin reviewer
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_reviewedByAdminId_fkey" 
  FOREIGN KEY ("reviewedByAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
