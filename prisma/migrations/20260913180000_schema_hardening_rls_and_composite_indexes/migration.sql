-- ==============================================================================
-- Migration: 20260913180000_schema_hardening_rls_and_composite_indexes
-- Target: PostgreSQL / Supabase
-- Scale Target: 10 Lakh (1,000,000) Users Escrow Marketplace
-- ==============================================================================

-- 1. SOFT-DELETE EXTENSIONS FOR PROFILES
-- Ensure consistent soft-delete cascading across search & discovery
ALTER TABLE "InfluencerProfile" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "InfluencerProfile_deletedAt_idx" ON "InfluencerProfile"("deletedAt");

ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "BrandProfile_deletedAt_idx" ON "BrandProfile"("deletedAt");
CREATE INDEX IF NOT EXISTS "BrandProfile_industry_idx" ON "BrandProfile"("industry");
CREATE INDEX IF NOT EXISTS "BrandProfile_city_idx" ON "BrandProfile"("city");


-- 2. HIGH-TRAFFIC COMPOSITE QUERY INDEXES (WHERE + ORDER BY DESC for 1M Scale)

-- Application: Unfiltered campaign applications listing
CREATE INDEX IF NOT EXISTS "Application_campaignId_deletedAt_createdAt_idx"
    ON "Application"("campaignId", "deletedAt", "createdAt" DESC);

-- Transaction: User Wallet Ledger pagination (Fast reverse index scans)
CREATE INDEX IF NOT EXISTS "Transaction_walletId_createdAt_desc_idx"
    ON "Transaction"("walletId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Transaction_walletId_deletedAt_createdAt_desc_idx"
    ON "Transaction"("walletId", "deletedAt", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Transaction_walletId_status_deletedAt_createdAt_desc_idx"
    ON "Transaction"("walletId", "status", "deletedAt", "createdAt" DESC);

-- Withdrawal: User history and admin manual review queue
CREATE INDEX IF NOT EXISTS "Withdrawal_walletId_createdAt_desc_idx"
    ON "Withdrawal"("walletId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Withdrawal_walletId_status_createdAt_desc_idx"
    ON "Withdrawal"("walletId", "status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Withdrawal_status_createdAt_desc_idx"
    ON "Withdrawal"("status", "createdAt" DESC);

-- Notification: Descending unified notification stream
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_desc_idx"
    ON "Notification"("userId", "createdAt" DESC);


-- 3. ROW LEVEL SECURITY (RLS) POLICIES FOR DEFENSE IN DEPTH
-- Acts as a strict backstop if PostgREST or Supabase Auth API is accessed directly.
-- The server connection (postgres/service_role) retains full bypass access.

-- A. Table: Wallet
ALTER TABLE "Wallet" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet_select_owner_or_service" ON "Wallet";
CREATE POLICY "wallet_select_owner_or_service" ON "Wallet"
    FOR SELECT
    USING (
        (auth.uid() IS NOT NULL AND auth.uid()::text = "userId")
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "wallet_modify_service_role_only" ON "Wallet";
CREATE POLICY "wallet_modify_service_role_only" ON "Wallet"
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');


-- B. Table: Transaction
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transaction_select_owner_or_service" ON "Transaction";
CREATE POLICY "transaction_select_owner_or_service" ON "Transaction"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM "Wallet" w
            WHERE w.id = "Transaction"."walletId"
            AND (w."userId" = auth.uid()::text OR auth.role() = 'service_role')
        )
    );

DROP POLICY IF EXISTS "transaction_modify_service_role_only" ON "Transaction";
CREATE POLICY "transaction_modify_service_role_only" ON "Transaction"
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');


-- C. Table: Withdrawal
ALTER TABLE "Withdrawal" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "withdrawal_select_owner_or_service" ON "Withdrawal";
CREATE POLICY "withdrawal_select_owner_or_service" ON "Withdrawal"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM "Wallet" w
            WHERE w.id = "Withdrawal"."walletId"
            AND (w."userId" = auth.uid()::text OR auth.role() = 'service_role')
        )
    );

DROP POLICY IF EXISTS "withdrawal_insert_owner_or_service" ON "Withdrawal";
CREATE POLICY "withdrawal_insert_owner_or_service" ON "Withdrawal"
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM "Wallet" w
            WHERE w.id = "Withdrawal"."walletId"
            AND (w."userId" = auth.uid()::text OR auth.role() = 'service_role')
        )
    );

DROP POLICY IF EXISTS "withdrawal_modify_service_role_only" ON "Withdrawal";
CREATE POLICY "withdrawal_modify_service_role_only" ON "Withdrawal"
    FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');


-- D. Table: PaymentHold
ALTER TABLE "PaymentHold" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_hold_select_parties_or_service" ON "PaymentHold";
CREATE POLICY "payment_hold_select_parties_or_service" ON "PaymentHold"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM "Deal" d
            WHERE d.id = "PaymentHold"."dealId"
            AND (
                d."brandId" IN (SELECT id FROM "BrandProfile" WHERE "userId" = auth.uid()::text)
                OR d."influencerId" IN (SELECT id FROM "InfluencerProfile" WHERE "userId" = auth.uid()::text)
                OR auth.role() = 'service_role'
            )
        )
    );

DROP POLICY IF EXISTS "payment_hold_modify_service_role_only" ON "PaymentHold";
CREATE POLICY "payment_hold_modify_service_role_only" ON "PaymentHold"
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');


-- 4. CONFIRM APPEND-ONLY IMMUTABILITY TRIGGERS
-- Ensure triggers are in place on AuditLog and Transaction
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_immutable_audit_log') THEN
        CREATE TRIGGER trg_immutable_audit_log
        BEFORE UPDATE OR DELETE ON "AuditLog"
        FOR EACH ROW EXECUTE FUNCTION trg_fn_protect_audit_log();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_protect_transaction_ledger') THEN
        CREATE TRIGGER trg_protect_transaction_ledger
        BEFORE UPDATE OR DELETE ON "Transaction"
        FOR EACH ROW EXECUTE FUNCTION trg_fn_protect_transaction_ledger();
    END IF;
END $$;

-- ==============================================================================
-- REVERSIBLE ROLLBACK INSTRUCTIONS (DOWN MIGRATION):
-- To revert this migration:
-- DROP POLICY IF EXISTS "wallet_select_owner_or_service" ON "Wallet";
-- DROP POLICY IF EXISTS "wallet_modify_service_role_only" ON "Wallet";
-- ALTER TABLE "Wallet" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "transaction_select_owner_or_service" ON "Transaction";
-- DROP POLICY IF EXISTS "transaction_modify_service_role_only" ON "Transaction";
-- ALTER TABLE "Transaction" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "withdrawal_select_owner_or_service" ON "Withdrawal";
-- DROP POLICY IF EXISTS "withdrawal_insert_owner_or_service" ON "Withdrawal";
-- DROP POLICY IF EXISTS "withdrawal_modify_service_role_only" ON "Withdrawal";
-- ALTER TABLE "Withdrawal" DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "payment_hold_select_parties_or_service" ON "PaymentHold";
-- DROP POLICY IF EXISTS "payment_hold_modify_service_role_only" ON "PaymentHold";
-- ALTER TABLE "PaymentHold" DISABLE ROW LEVEL SECURITY;
-- DROP INDEX IF EXISTS "Transaction_walletId_createdAt_desc_idx";
-- DROP INDEX IF EXISTS "Transaction_walletId_deletedAt_createdAt_desc_idx";
-- DROP INDEX IF EXISTS "Transaction_walletId_status_deletedAt_createdAt_desc_idx";
-- DROP INDEX IF EXISTS "Withdrawal_walletId_createdAt_desc_idx";
-- DROP INDEX IF EXISTS "Withdrawal_walletId_status_createdAt_desc_idx";
-- DROP INDEX IF EXISTS "Withdrawal_status_createdAt_desc_idx";
-- DROP INDEX IF EXISTS "Notification_userId_createdAt_desc_idx";
-- DROP INDEX IF EXISTS "Application_campaignId_deletedAt_createdAt_idx";
-- DROP INDEX IF EXISTS "InfluencerProfile_deletedAt_idx";
-- DROP INDEX IF EXISTS "BrandProfile_deletedAt_idx";
-- DROP INDEX IF EXISTS "BrandProfile_industry_idx";
-- DROP INDEX IF EXISTS "BrandProfile_city_idx";
-- ALTER TABLE "InfluencerProfile" DROP COLUMN IF EXISTS "deletedAt";
-- ALTER TABLE "BrandProfile" DROP COLUMN IF EXISTS "deletedAt";
-- ==============================================================================
