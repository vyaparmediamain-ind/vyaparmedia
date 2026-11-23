-- ==============================================================================
-- Migration: 20261122150000_add_feature_flag
-- Target: PostgreSQL / Supabase
-- Description: Progressive feature rollout flags with RLS and role allow-lists
-- ==============================================================================

-- 1. Create FeatureFlag table
CREATE TABLE IF NOT EXISTS "FeatureFlag" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPercent" INTEGER NOT NULL DEFAULT 100,
    "allowRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);

-- 2. Performance index for active flags filter
CREATE INDEX IF NOT EXISTS "FeatureFlag_enabled_idx" ON "FeatureFlag"("enabled");

-- 3. Enable Defense-in-depth Row Level Security (RLS)
ALTER TABLE "FeatureFlag" ENABLE ROW LEVEL SECURITY;

-- 4. Strip direct PostgREST privileges from anon and authenticated roles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE "FeatureFlag" FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE "FeatureFlag" FROM authenticated;
    END IF;
END $$;

-- 5. Explicit Service Role policy
DROP POLICY IF EXISTS "feature_flag_service_role_all" ON "FeatureFlag";
CREATE POLICY "feature_flag_service_role_all" ON "FeatureFlag"
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- 6. Seed initial feature flags (all initially disabled per rollout specification)
INSERT INTO "FeatureFlag" ("key", "enabled", "rolloutPercent", "allowRoles", "description", "updatedAt")
VALUES
    ('creator_metrics', false, 100, ARRAY[]::TEXT[], 'Advanced creator audience and benchmark analytics on profiles', NOW()),
    ('fair_price', false, 100, ARRAY[]::TEXT[], 'AI fair-price guidance and automated quote recommendation engine', NOW()),
    ('fair_price_public_badge', false, 100, ARRAY[]::TEXT[], 'Public fair-pricing trust badge on creator discovery cards', NOW()),
    ('instagram_insights', false, 100, ARRAY[]::TEXT[], 'Instagram Graph API media insights and reach integration', NOW()),
    ('telemetry_anonymous', false, 100, ARRAY[]::TEXT[], 'Anonymous public deal view telemetry collection', NOW()),
    ('telemetry_identified', false, 100, ARRAY[]::TEXT[], 'Verified creator post engagement telemetry collection', NOW()),
    ('campaign_hub', false, 100, ARRAY[]::TEXT[], 'Next-generation unified campaign operations hub', NOW()),
    ('branded_reports', false, 100, ARRAY[]::TEXT[], 'Custom branded corporate executive PDF/print reports', NOW()),
    ('report_verification', false, 100, ARRAY[]::TEXT[], 'Cryptographic verification and public audit URLs for reports', NOW())
ON CONFLICT ("key") DO NOTHING;
