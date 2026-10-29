DO $$ BEGIN
  CREATE TYPE "ProductFulfillmentStatus" AS ENUM (
    'NOT_REQUIRED',
    'ADDRESS_PENDING',
    'READY_TO_DISPATCH',
    'DISPATCHED',
    'RECEIVED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Deal"
  ADD COLUMN IF NOT EXISTS "influencerPayout" INTEGER,
  ADD COLUMN IF NOT EXISTS "reservedFromWallet" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "requiresProduct" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "productName" TEXT,
  ADD COLUMN IF NOT EXISTS "productValue" INTEGER,
  ADD COLUMN IF NOT EXISTS "productHandlingFee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "productFulfillmentStatus" "ProductFulfillmentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS "shippingAddress" JSONB,
  ADD COLUMN IF NOT EXISTS "dispatchTrackingNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "dispatchCarrier" TEXT,
  ADD COLUMN IF NOT EXISTS "dispatchedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "productReceivedAt" TIMESTAMP(3);

UPDATE "Deal"
SET "influencerPayout" = "amount"
WHERE "influencerPayout" IS NULL;

UPDATE "Deal" AS d
SET
  "requiresProduct" = c."requiresProduct",
  "productName" = c."productName",
  "productValue" = c."productValue",
  "productFulfillmentStatus" = CASE
    WHEN c."requiresProduct" THEN 'ADDRESS_PENDING'
    ELSE d."productFulfillmentStatus"
  END
FROM "Campaign" AS c
WHERE d."campaignId" = c."id";

UPDATE "Deal"
SET "requiresPostVerification" = false
WHERE status IN ('CONTENT_APPROVED', 'COMPLETED')
  AND "requiresPostVerification";

CREATE INDEX IF NOT EXISTS "Deal_productFulfillmentStatus_idx"
  ON "Deal"("productFulfillmentStatus");

CREATE UNIQUE INDEX IF NOT EXISTS "Deal_campaign_influencer_open_unique"
  ON "Deal"("campaignId", "influencerId")
  WHERE "deletedAt" IS NULL AND status <> 'CANCELLED';
