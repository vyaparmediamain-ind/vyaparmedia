-- ==============================================================================
-- Supabase Row Level Security (RLS) & PostgREST Lockdown Script
-- Resolves Supabase Security Linter Warnings:
-- - 0013_rls_disabled_in_public
-- - 0023_sensitive_columns_exposed
-- - 0008_rls_enabled_no_policy
-- ==============================================================================

-- 1. Dynamically enable Row Level Security and add lockdown policies on all tables
DO  
DECLARE 
    tbl RECORD;
BEGIN 
    FOR tbl IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename NOT LIKE '_prisma%'
    ) 
    LOOP 
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.tablename);
        EXECUTE format('DROP POLICY IF EXISTS  deny_direct_access ON public.%I;', tbl.tablename);
        EXECUTE format('CREATE POLICY deny_direct_access ON public.%I FOR ALL TO anon, authenticated USING (false);', tbl.tablename);
    END LOOP; 
END ;

-- 2. Revoke all permissions from Supabase PostgREST roles ('anon' and 'authenticated')
DO 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
        REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;
        
        ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated;
    END IF;
END ;
