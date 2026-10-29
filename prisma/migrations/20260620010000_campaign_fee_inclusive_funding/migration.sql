LTER TABLE "Campaign"
  ADD COLUMN IF NOT EXISTS "fundedAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "reservedTotalAmount" INTEGER NOT NULL DEFAULT 0;

UPDATE "Campaign"
SET
  "fundedAmount" = CASE
    WHEN "fundedAmount" = 0 THEN "totalBudget"
    ELSE "fundedAmount"
  END,
  "reservedTotalAmount" = CASE
    WHEN "reservedTotalAmount" = 0 THEN "reservedAmount"
    ELSE "reservedTotalAmount"
  END
WHERE true;
