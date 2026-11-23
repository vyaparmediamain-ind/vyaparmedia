-- ==============================================================================
-- Migration: 20261122210000_add_telemetry_and_consent
-- Target: PostgreSQL / Supabase
-- Description: Add PageViewEvent, DailyRouteStat, DailyFunnelStat, and User consent fields with RLS
-- ==============================================================================

-- 1. Add Telemetry Consent fields to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telemetryConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telemetryConsentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telemetryConsentVersion" TEXT;

-- 2. Create PageViewEvent Table
CREATE TABLE IF NOT EXISTS "PageViewEvent" (
    "id" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT,
    "routeKey" TEXT NOT NULL,
    "targetInfluencerId" TEXT,
    "targetCampaignId" TEXT,
    "deviceType" TEXT NOT NULL,
    "referrerHost" TEXT,
    "activeMs" INTEGER NOT NULL,
    "maxScrollPct" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageViewEvent_pkey" PRIMARY KEY ("id")
);

-- 3. Create DailyRouteStat Table
CREATE TABLE IF NOT EXISTS "DailyRouteStat" (
    "date" DATE NOT NULL,
    "routeKey" TEXT NOT NULL,
    "uniqueVisitors" INTEGER NOT NULL,
    "pageViews" INTEGER NOT NULL,
    "avgActiveMs" INTEGER NOT NULL,
    "avgScrollPct" INTEGER NOT NULL,
    "bounceBps" INTEGER NOT NULL,

    CONSTRAINT "DailyRouteStat_pkey" PRIMARY KEY ("date", "routeKey")
);

-- 4. Create DailyFunnelStat Table
CREATE TABLE IF NOT EXISTS "DailyFunnelStat" (
    "date" DATE NOT NULL,
    "funnelKey" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "sessions" INTEGER NOT NULL,

    CONSTRAINT "DailyFunnelStat_pkey" PRIMARY KEY ("date", "funnelKey", "stepKey")
);

-- 5. Performance Indexes on PageViewEvent
CREATE INDEX IF NOT EXISTS "PageViewEvent_routeKey_createdAt_idx" 
    ON "PageViewEvent"("routeKey", "createdAt");

CREATE INDEX IF NOT EXISTS "PageViewEvent_targetInfluencerId_createdAt_idx" 
    ON "PageViewEvent"("targetInfluencerId", "createdAt");

CREATE INDEX IF NOT EXISTS "PageViewEvent_targetCampaignId_createdAt_idx" 
    ON "PageViewEvent"("targetCampaignId", "createdAt");

-- 6. Foreign Key Constraints
ALTER TABLE "PageViewEvent" DROP CONSTRAINT IF EXISTS "PageViewEvent_userId_fkey";
ALTER TABLE "PageViewEvent" ADD CONSTRAINT "PageViewEvent_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. Enable Defense-in-depth Row Level Security (RLS)
ALTER TABLE "PageViewEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyRouteStat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyFunnelStat" ENABLE ROW LEVEL SECURITY;

-- 8. Strip direct PostgREST privileges from anon and authenticated roles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE "PageViewEvent" FROM anon;
        REVOKE ALL ON TABLE "DailyRouteStat" FROM anon;
        REVOKE ALL ON TABLE "DailyFunnelStat" FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE "PageViewEvent" FROM authenticated;
        REVOKE ALL ON TABLE "DailyRouteStat" FROM authenticated;
        REVOKE ALL ON TABLE "DailyFunnelStat" FROM authenticated;
    END IF;
END $$;

-- 9. Explicit Service Role policies
DROP POLICY IF EXISTS "page_view_event_service_role_all" ON "PageViewEvent";
CREATE POLICY "page_view_event_service_role_all" ON "PageViewEvent"
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "daily_route_stat_service_role_all" ON "DailyRouteStat";
CREATE POLICY "daily_route_stat_service_role_all" ON "DailyRouteStat"
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "daily_funnel_stat_service_role_all" ON "DailyFunnelStat";
CREATE POLICY "daily_funnel_stat_service_role_all" ON "DailyFunnelStat"
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
