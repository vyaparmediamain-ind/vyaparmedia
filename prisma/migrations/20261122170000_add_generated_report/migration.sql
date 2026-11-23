-- ==============================================================================
-- Migration: 20261122170000_add_generated_report
-- Target: PostgreSQL / Supabase
-- Description: Cryptographic report registry for public QR verification with RLS
-- ==============================================================================

-- 1. Create GeneratedReport table
CREATE TABLE IF NOT EXISTS "GeneratedReport" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopeId" TEXT,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedReport_pkey" PRIMARY KEY ("id")
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS "GeneratedReport_userId_idx" ON "GeneratedReport"("userId");
CREATE INDEX IF NOT EXISTS "GeneratedReport_createdAt_idx" ON "GeneratedReport"("createdAt");

-- 3. Enable Defense-in-depth Row Level Security (RLS)
ALTER TABLE "GeneratedReport" ENABLE ROW LEVEL SECURITY;

-- 4. Strip direct PostgREST privileges from anon and authenticated roles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE "GeneratedReport" FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE "GeneratedReport" FROM authenticated;
    END IF;
END $$;

-- 5. Explicit Service Role policy
DROP POLICY IF EXISTS "generated_report_service_role_all" ON "GeneratedReport";
CREATE POLICY "generated_report_service_role_all" ON "GeneratedReport"
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
