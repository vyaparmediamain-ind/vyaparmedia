-- ==============================================================================
-- Migration: 20261122230000_add_campaign_daily_metric
-- Target: PostgreSQL / Supabase
-- Description: Add CampaignDailyMetric table with RLS and service role policy
-- ==============================================================================

-- 1. Create CampaignDailyMetric Table
CREATE TABLE IF NOT EXISTS "CampaignDailyMetric" (
    "campaignId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "briefViews" INTEGER NOT NULL DEFAULT 0,
    "uniqueBriefViewers" INTEGER NOT NULL DEFAULT 0,
    "applications" INTEGER NOT NULL DEFAULT 0,
    "shortlisted" INTEGER NOT NULL DEFAULT 0,
    "hired" INTEGER NOT NULL DEFAULT 0,
    "contentSubmitted" INTEGER NOT NULL DEFAULT 0,
    "postsLive" INTEGER NOT NULL DEFAULT 0,
    "deliveredViews" BIGINT NOT NULL DEFAULT 0,
    "apiViewsShareBps" INTEGER NOT NULL DEFAULT 0,
    "engagements" BIGINT NOT NULL DEFAULT 0,
    "escrowFundedPaise" BIGINT NOT NULL DEFAULT 0,
    "escrowReleasedPaise" BIGINT NOT NULL DEFAULT 0,
    "platformFeePaise" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignDailyMetric_pkey" PRIMARY KEY ("campaignId", "date")
);

-- 2. Foreign Key Constraint to Campaign
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CampaignDailyMetric_campaignId_fkey'
    ) THEN
        ALTER TABLE "CampaignDailyMetric"
            ADD CONSTRAINT "CampaignDailyMetric_campaignId_fkey"
            FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS "CampaignDailyMetric_date_idx" ON "CampaignDailyMetric"("date");
CREATE INDEX IF NOT EXISTS "CampaignDailyMetric_campaignId_idx" ON "CampaignDailyMetric"("campaignId");

-- 4. Enable Defense-in-depth Row Level Security (RLS)
ALTER TABLE "CampaignDailyMetric" ENABLE ROW LEVEL SECURITY;

-- 5. Strip direct PostgREST privileges from anon and authenticated roles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE "CampaignDailyMetric" FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE "CampaignDailyMetric" FROM authenticated;
    END IF;
END $$;

-- 6. Explicit Service Role policy
DROP POLICY IF EXISTS "campaign_daily_metric_service_role_all" ON "CampaignDailyMetric";
CREATE POLICY "campaign_daily_metric_service_role_all" ON "CampaignDailyMetric"
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
