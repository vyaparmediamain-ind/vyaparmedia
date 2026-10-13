-- ==============================================================================
-- Migration: 20261011010000_protect_platform_treasury_triggers
-- Target: PostgreSQL / Supabase
-- Description: Move runtime DDL triggers from src/lib/db.ts into a canonical migration.
--              Protects virtual user PLATFORM_TREASURY and its wallet from deletion.
-- ==============================================================================

CREATE OR REPLACE FUNCTION protect_platform_treasury() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.id = 'PLATFORM_TREASURY' THEN
        RAISE EXCEPTION 'TREASURY SECURITY: Deletion of the virtual user PLATFORM_TREASURY is prohibited.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION protect_platform_treasury_wallet() RETURNS TRIGGER AS $$
BEGIN
    IF OLD."userId" = 'PLATFORM_TREASURY' THEN
        RAISE EXCEPTION 'TREASURY SECURITY: Deletion of the PLATFORM_TREASURY wallet is prohibited.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_protect_treasury') THEN
        CREATE TRIGGER trg_protect_treasury
        BEFORE DELETE ON "User"
        FOR EACH ROW EXECUTE FUNCTION protect_platform_treasury();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_protect_treasury_wallet') THEN
        CREATE TRIGGER trg_protect_treasury_wallet
        BEFORE DELETE ON "Wallet"
        FOR EACH ROW EXECUTE FUNCTION protect_platform_treasury_wallet();
    END IF;
END $$;
