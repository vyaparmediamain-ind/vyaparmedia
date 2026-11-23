-- ==============================================================================
-- Migration: 20261122200000_add_fair_pricing_models
-- Target: PostgreSQL / Supabase
-- Description: Add Fair Pricing fields to InfluencerProfile, PricingEvaluation, and versioned PricingConfig with RLS
-- ==============================================================================

-- 1. Add Fair Pricing fields to InfluencerProfile
ALTER TABLE "InfluencerProfile" ADD COLUMN IF NOT EXISTS "fairRateMinPaise" INTEGER;
ALTER TABLE "InfluencerProfile" ADD COLUMN IF NOT EXISTS "fairRateMaxPaise" INTEGER;
ALTER TABLE "InfluencerProfile" ADD COLUMN IF NOT EXISTS "fairRateConfidence" TEXT;
ALTER TABLE "InfluencerProfile" ADD COLUMN IF NOT EXISTS "fairRateDataQuality" TEXT;
ALTER TABLE "InfluencerProfile" ADD COLUMN IF NOT EXISTS "fairRateComputedAt" TIMESTAMP(3);
ALTER TABLE "InfluencerProfile" ADD COLUMN IF NOT EXISTS "fairRateEngineVersion" TEXT;

-- 2. Create PricingEvaluation Table
CREATE TABLE IF NOT EXISTS "PricingEvaluation" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "platform" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "inputsHash" TEXT NOT NULL,
    "inputsJson" JSONB NOT NULL,
    "outputJson" JSONB NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "configVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingEvaluation_pkey" PRIMARY KEY ("id")
);

-- 3. Create PricingConfig Table
CREATE TABLE IF NOT EXISTS "PricingConfig" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "configJson" JSONB NOT NULL,
    "description" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingConfig_pkey" PRIMARY KEY ("id")
);

-- 4. Unique & Performance Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "PricingConfig_version_key" ON "PricingConfig"("version");
CREATE INDEX IF NOT EXISTS "PricingConfig_isActive_idx" ON "PricingConfig"("isActive");

CREATE INDEX IF NOT EXISTS "PricingEvaluation_influencerId_createdAt_idx" 
    ON "PricingEvaluation"("influencerId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "PricingEvaluation_inputsHash_idx" 
    ON "PricingEvaluation"("inputsHash");
CREATE INDEX IF NOT EXISTS "PricingEvaluation_requestedByUserId_idx" 
    ON "PricingEvaluation"("requestedByUserId");

-- 5. Foreign Key Constraints
ALTER TABLE "PricingEvaluation" DROP CONSTRAINT IF EXISTS "PricingEvaluation_influencerId_fkey";
ALTER TABLE "PricingEvaluation" ADD CONSTRAINT "PricingEvaluation_influencerId_fkey" 
    FOREIGN KEY ("influencerId") REFERENCES "InfluencerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PricingEvaluation" DROP CONSTRAINT IF EXISTS "PricingEvaluation_requestedByUserId_fkey";
ALTER TABLE "PricingEvaluation" ADD CONSTRAINT "PricingEvaluation_requestedByUserId_fkey" 
    FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Enable Defense-in-depth Row Level Security (RLS)
ALTER TABLE "PricingEvaluation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PricingConfig" ENABLE ROW LEVEL SECURITY;

-- 7. Strip direct PostgREST privileges from anon and authenticated roles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE "PricingEvaluation" FROM anon;
        REVOKE ALL ON TABLE "PricingConfig" FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE "PricingEvaluation" FROM authenticated;
        REVOKE ALL ON TABLE "PricingConfig" FROM authenticated;
    END IF;
END $$;

-- 8. Explicit Service Role policies
DROP POLICY IF EXISTS "pricing_evaluation_service_role_all" ON "PricingEvaluation";
CREATE POLICY "pricing_evaluation_service_role_all" ON "PricingEvaluation"
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "pricing_config_service_role_all" ON "PricingConfig";
CREATE POLICY "pricing_config_service_role_all" ON "PricingConfig"
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
