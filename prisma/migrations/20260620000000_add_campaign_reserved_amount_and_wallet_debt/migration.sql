- AlterTable
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "reservedAmount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "debt" INTEGER NOT NULL DEFAULT 0;

-- Backfill Campaign.reservedAmount with sum of active deals
UPDATE "Campaign" c SET "reservedAmount" = COALESCE((
  SELECT SUM(d.amount) FROM "Deal" d
  WHERE d."campaignId" = c.id AND d."deletedAt" IS NULL AND d.status != 'CANCELLED'
), 0) WHERE true;