-- ==============================================================================
-- Migration: 20261122190000_add_creator_metric_snapshot
-- Target: PostgreSQL / Supabase
-- Description: Historical weekly creator metric snapshots with defense-in-depth RLS
-- ==============================================================================

-- 1. Create Enums if not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MetricPlatform') THEN
        CREATE TYPE "MetricPlatform" AS ENUM ('INSTAGRAM', 'YOUTUBE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MetricViewsQuality') THEN
        CREATE TYPE "MetricViewsQuality" AS ENUM ('API', 'UNAVAILABLE');
    END IF;
END $$;

-- 2. Create CreatorMetricSnapshot Table
CREATE TABLE IF NOT EXISTS "CreatorMetricSnapshot" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "platform" "MetricPlatform" NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followers" INTEGER NOT NULL,
    "avgLikes" INTEGER,
    "avgComments" INTEGER,
    "avgViews" INTEGER,
    "avgReach" INTEGER,
    "engagementRateBps" INTEGER,
    "postsSampled" INTEGER NOT NULL,
    "viewsQuality" "MetricViewsQuality" NOT NULL,
    "flagsJson" JSONB,

    CONSTRAINT "CreatorMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- 3. Composite Index for performant historical queries and weekly deduplication
CREATE INDEX IF NOT EXISTS "CreatorMetricSnapshot_influencerId_platform_capturedAt_idx" 
    ON "CreatorMetricSnapshot"("influencerId", "platform", "capturedAt" DESC);

-- 4. Foreign key to InfluencerProfile
ALTER TABLE "CreatorMetricSnapshot" DROP CONSTRAINT IF EXISTS "CreatorMetricSnapshot_influencerId_fkey";
ALTER TABLE "CreatorMetricSnapshot" ADD CONSTRAINT "CreatorMetricSnapshot_influencerId_fkey" 
    FOREIGN KEY ("influencerId") REFERENCES "InfluencerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Enable Defense-in-depth Row Level Security (RLS)
ALTER TABLE "CreatorMetricSnapshot" ENABLE ROW LEVEL SECURITY;

-- 6. Strip direct PostgREST privileges from anon and authenticated roles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE "CreatorMetricSnapshot" FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE "CreatorMetricSnapshot" FROM authenticated;
    END IF;
END $$;

-- 7. Explicit Service Role policy
DROP POLICY IF EXISTS "creator_metric_snapshot_service_role_all" ON "CreatorMetricSnapshot";
CREATE POLICY "creator_metric_snapshot_service_role_all" ON "CreatorMetricSnapshot"
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
