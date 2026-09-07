-- Enterprise Database Hardening Script
-- Target: PostgreSQL
-- Purpose: Move security controls into the database engine (Defense-in-Depth)

-- 1. LEDGER POLICY
-- Do not install an immutable Transaction trigger here. The application updates
-- payment transactions from PENDING to COMPLETED/FAILED, so a blanket trigger
-- would cause a production payment outage. Ledger integrity is enforced through
-- append-only business flows and explicit status transitions in application code.


-- 2. ROW LEVEL SECURITY (RLS)
-- RLS is intentionally not enabled by this standalone script because Prisma
-- requests do not set app.current_user_id. Enabling FORCE RLS without that
-- middleware makes all wallet/document reads and writes disappear.

-- 3. AUTOMATIC AUDIT: Capture Schema Changes
-- Logs all DDL changes to a dedicated history table for compliance (SOC2 requirement).
CREATE TABLE IF NOT EXISTS schema_audit (
    id SERIAL PRIMARY KEY,
    event_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    tag TEXT,
    object_type TEXT,
    schema_name TEXT,
    object_identity TEXT,
    query TEXT
);

CREATE OR REPLACE FUNCTION log_ddl_changes() RETURNS event_trigger AS $$
BEGIN
    INSERT INTO schema_audit (tag, object_type, schema_name, object_identity, query)
    VALUES (tg_tag, tg_type, tg_schema, tg_identity, current_query());
END;
$$ LANGUAGE plpgsql;

-- Apply Event Trigger (Superuser may be required)
-- CREATE EVENT TRIGGER trg_audit_ddl ON ddl_command_end EXECUTE FUNCTION log_ddl_changes();


-- 4. CONNECTION HARDENING
-- Restrict standard users to only the 'public' schema
REVOKE ALL ON DATABASE postgres FROM public;
GRANT CONNECT ON DATABASE postgres TO public;
REVOKE ALL ON SCHEMA public FROM public;
GRANT USAGE ON SCHEMA public TO public;

-- Note: In Production, create a 'decisional_app' user with limited permissions,
-- granting select/insert/update/delete and revoking truncate on all tables.

-- 5. DB-LEVEL CHECK CONSTRAINTS (Money Rules)
-- Ensure balances and amounts never dip below zero at the DB level, averting race conditions
ALTER TABLE "Wallet" ADD CONSTRAINT check_wallet_balance_positive CHECK (balance >= 0);
ALTER TABLE "Wallet" ADD CONSTRAINT check_wallet_pending_balance_positive CHECK ("pendingBalance" >= 0);

ALTER TABLE "Transaction" ADD CONSTRAINT check_transaction_amount_positive CHECK (amount > 0);
ALTER TABLE "PaymentHold" ADD CONSTRAINT check_hold_amount_positive CHECK (amount > 0);
ALTER TABLE "Withdrawal" ADD CONSTRAINT check_withdrawal_amount_positive CHECK (amount >= 0);
ALTER TABLE "Deal" ADD CONSTRAINT check_deal_amounts_positive CHECK (amount >= 0 AND "platformFee" >= 0 AND "gatewayFee" >= 0 AND "totalAmount" >= 0);

-- 6. STRICT ISOLATION POLICIES (RLS)
-- See section 2. Keep tenancy enforcement in Prisma until a request-scoped
-- session variable middleware exists and is covered by integration tests.

-- 7. IDEMPOTENCY LOCKS
-- Prevent duplicate processing of webhooks concurrently
CREATE UNIQUE INDEX IF NOT EXISTS "idx_processed_webhook_id" ON "ProcessedWebhookEvent"("eventId");

-- 8. AUDIT TRIGGERS for high-risk tables (Wallets)
CREATE TABLE IF NOT EXISTS "WalletAuditLog" (
    id SERIAL PRIMARY KEY,
    wallet_id TEXT NOT NULL,
    old_balance DECIMAL(18, 4),
    new_balance DECIMAL(18, 4),
    updated_by TEXT DEFAULT current_setting('app.current_user_id', true),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION audit_wallet_changes() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.balance IS DISTINCT FROM NEW.balance THEN
        INSERT INTO "WalletAuditLog" (wallet_id, old_balance, new_balance)
        VALUES (OLD.id, OLD.balance, NEW.balance);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_wallet_audit') THEN
        CREATE TRIGGER trg_wallet_audit
        AFTER UPDATE ON "Wallet"
        FOR EACH ROW EXECUTE FUNCTION audit_wallet_changes();
    END IF;
END $$;

-- 9. IMMUTABLE SYSTEM LOGS
-- Prevent anyone (even admins) from deleting audit logs
CREATE OR REPLACE FUNCTION protect_audit_log() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'AUDIT SECURITY: Audit logs cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_immutable_audit') THEN
        CREATE TRIGGER trg_immutable_audit
        BEFORE UPDATE OR DELETE ON "WalletAuditLog"
        FOR EACH ROW EXECUTE FUNCTION protect_audit_log();
    END IF;
END $$;

-- 10. DIRECT BALANCE UPDATE PROTECTION
-- Not installed until Prisma sets app.secure_finance_context inside every
-- legitimate finance transaction. Installing it prematurely blocks all wallet
-- updates from the application.

