-- ==============================================================================
-- Migration: 20261122220000_add_daily_traffic_breakdown
-- Target: PostgreSQL / Supabase
-- Description: Add DailyTrafficBreakdown table with RLS and service role policy
-- ==============================================================================

-- 1. Create DailyTrafficBreakdown Table
CREATE TABLE IF NOT EXISTS "DailyTrafficBreakdown" (
    "date" DATE NOT NULL,
    "dimension" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "visitors" INTEGER NOT NULL,
    "pageViews" INTEGER NOT NULL,

    CONSTRAINT "DailyTrafficBreakdown_pkey" PRIMARY KEY ("date", "dimension", "key")
);

-- 2. Performance Index on (date, dimension)
CREATE INDEX IF NOT EXISTS "DailyTrafficBreakdown_date_dimension_idx" 
    ON "DailyTrafficBreakdown"("date", "dimension");

-- 3. Enable Defense-in-depth Row Level Security (RLS)
ALTER TABLE "DailyTrafficBreakdown" ENABLE ROW LEVEL SECURITY;

-- 4. Strip direct PostgREST privileges from anon and authenticated roles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE "DailyTrafficBreakdown" FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE "DailyTrafficBreakdown" FROM authenticated;
    END IF;
END $$;

-- 5. Explicit Service Role policy
DROP POLICY IF EXISTS "daily_traffic_breakdown_service_role_all" ON "DailyTrafficBreakdown";
CREATE POLICY "daily_traffic_breakdown_service_role_all" ON "DailyTrafficBreakdown"
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
