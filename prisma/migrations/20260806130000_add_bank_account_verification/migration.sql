- Migration: add_bank_account_verification
-- Adds ownership-verification fields to the BankAccount table.
-- isVerified: false until Razorpay Fund Account Validation (penny-drop) confirms
--             account-holder name matches user KYC identity.
-- verifiedAt: timestamp of successful verification.

ALTER TABLE "BankAccount"
  ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "verifiedAt"  TIMESTAMP WITH TIME ZONE;
