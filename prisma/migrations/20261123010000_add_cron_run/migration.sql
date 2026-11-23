-- ==============================================================================
-- Migration: 20261123010000_add_cron_run
-- Target: PostgreSQL / Supabase
-- Description: Add CronRun table for background job heartbeats with RLS defense-in-depth
-- ==============================================================================

-- 1. Create CronRun Table
CREATE TABLE IF NOT EXISTS "CronRun" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER DEFAULT 0,
    "recordsProcessed" INTEGER DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CronRun_pkey" PRIMARY KEY ("id")
);

-- 2. Performance & Health Check Indexes
CREATE INDEX IF NOT EXISTS "CronRun_jobName_startedAt_idx" ON "CronRun"("jobName", "startedAt" DESC);
CREATE INDEX IF NOT EXISTS "CronRun_startedAt_idx" ON "CronRun"("startedAt" DESC);
CREATE INDEX IF NOT EXISTS "CronRun_status_idx" ON "CronRun"("status");

-- 3. Enable Defense-in-depth Row Level Security (RLS)
ALTER TABLE "CronRun" ENABLE ROW LEVEL SECURITY;

-- 4. Strip direct PostgREST privileges from anon and authenticated roles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE "CronRun" FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE "CronRun" FROM authenticated;
    END IF;
END $$;

-- 5. Explicit Service Role policy
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'CronRun' AND policyname = 'service_role_all_cron_run'
    ) THEN
        CREATE POLICY service_role_all_cron_run ON "CronRun"
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;
