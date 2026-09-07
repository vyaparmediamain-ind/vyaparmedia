ALTER TABLE "Transaction"
  ADD COLUMN IF NOT EXISTS "razorpayOrderId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_razorpayOrderId_key"
  ON "Transaction" ("razorpayOrderId");

CREATE INDEX IF NOT EXISTS "Transaction_razorpayOrderId_idx"
  ON "Transaction" ("razorpayOrderId");
