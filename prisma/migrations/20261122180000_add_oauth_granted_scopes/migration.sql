-- AlterTable: Add grantedScopes array to OAuthAccount
ALTER TABLE "OAuthAccount" ADD COLUMN IF NOT EXISTS "grantedScopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill grantedScopes from existing scope for active Instagram accounts
-- Invariant: NEVER touch rows marked 'NEEDS_RECONNECT' or other transient states
UPDATE "OAuthAccount"
SET "grantedScopes" = ARRAY['instagram_business_basic']
WHERE "provider" = 'instagram'
  AND "scope" = 'instagram_business_basic'
  AND "grantedScopes" = ARRAY[]::TEXT[];
