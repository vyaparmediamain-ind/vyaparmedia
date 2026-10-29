-- ==============================================================================
-- Migration: 20260913120000_enterprise_scale_indexes_and_ledger_protection
-- Target: PostgreSQL / Supabase
-- Scale Target: 10 Lakh (1,000,000) Users Escrow Marketplace
-- ==============================================================================

-- 1. HIGH-TRAFFIC COMPOSITE INDEXES & MISSING FOREIGN KEY INDEXES

-- Campaign: Discovery & Brand Management
CREATE INDEX IF NOT EXISTS "Campaign_status_deletedAt_createdAt_idx"
    ON "Campaign"("status", "deletedAt", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Campaign_brandId_deletedAt_createdAt_idx"
    ON "Campaign"("brandId", "deletedAt", "createdAt" DESC);

-- Campaign: GIN Indexes for array filtering (targetCategories, targetCities)
CREATE INDEX IF NOT EXISTS "Campaign_targetCategories_gin_idx"
    ON "Campaign" USING GIN ("targetCategories");

CREATE INDEX IF NOT EXISTS "Campaign_targetCities_gin_idx"
    ON "Campaign" USING GIN ("targetCities");

-- Application: Campaign Applicants & Influencer Applications
CREATE INDEX IF NOT EXISTS "Application_campaignId_status_deletedAt_createdAt_idx"
    ON "Application"("campaignId", "status", "deletedAt", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Application_influencerId_status_deletedAt_createdAt_idx"
    ON "Application"("influencerId", "status", "deletedAt", "createdAt" DESC);

-- Deal: Brand & Influencer Deal Feeds (WHERE + ORDER BY createdAt DESC)
CREATE INDEX IF NOT EXISTS "Deal_brandId_status_deletedAt_createdAt_idx"
    ON "Deal"("brandId", "status", "deletedAt", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Deal_influencerId_status_deletedAt_createdAt_idx"
    ON "Deal"("influencerId", "status", "deletedAt", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Deal_brandId_deletedAt_createdAt_idx"
    ON "Deal"("brandId", "deletedAt", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Deal_influencerId_deletedAt_createdAt_idx"
    ON "Deal"("influencerId", "deletedAt", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Deal_campaignId_status_deletedAt_createdAt_idx"
    ON "Deal"("campaignId", "status", "deletedAt", "createdAt" DESC);

-- Notification: User Unread Feeds
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_createdAt_idx"
    ON "Notification"("userId", "isRead", "createdAt" DESC);

-- Message: Deal Chat Feed
CREATE INDEX IF NOT EXISTS "Message_dealId_deletedAt_createdAt_idx"
    ON "Message"("dealId", "deletedAt", "createdAt" ASC);

-- Dispute: Foreign key resolvedByUserId
CREATE INDEX IF NOT EXISTS "Dispute_resolvedByUserId_idx"
    ON "Dispute"("resolvedByUserId");

-- IdempotencyKey: Foreign key userId
CREATE INDEX IF NOT EXISTS "IdempotencyKey_userId_idx"
    ON "IdempotencyKey"("userId");


-- 2. FINANCIAL INTEGRITY: DB-LEVEL CHECK CONSTRAINTS (Money Rules in Integer Paise)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_wallet_balance_nonnegative') THEN
        ALTER TABLE "Wallet" ADD CONSTRAINT check_wallet_balance_nonnegative CHECK (balance >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_wallet_pending_nonnegative') THEN
        ALTER TABLE "Wallet" ADD CONSTRAINT check_wallet_pending_nonnegative CHECK ("pendingBalance" >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_transaction_amount_positive') THEN
        ALTER TABLE "Transaction" ADD CONSTRAINT check_transaction_amount_positive CHECK (amount > 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_payment_hold_amount_positive') THEN
        ALTER TABLE "PaymentHold" ADD CONSTRAINT check_payment_hold_amount_positive CHECK (amount > 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_withdrawal_amount_positive') THEN
        ALTER TABLE "Withdrawal" ADD CONSTRAINT check_withdrawal_amount_positive CHECK (amount > 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_deal_amounts_nonnegative') THEN
        ALTER TABLE "Deal" ADD CONSTRAINT check_deal_amounts_nonnegative 
            CHECK (amount >= 0 AND "platformFee" >= 0 AND "gatewayFee" >= 0 AND "totalAmount" >= 0);
    END IF;
END $$;


-- 3. AUDITLOG IMMUTABILITY: APPEND-ONLY TRIGGER
CREATE OR REPLACE FUNCTION trg_fn_protect_audit_log() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'AUDIT SECURITY: AuditLog rows are immutable and append-only. UPDATE and DELETE operations are strictly prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_audit_log ON "AuditLog";
CREATE TRIGGER trg_immutable_audit_log
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION trg_fn_protect_audit_log();


-- 4. FINANCIAL TRANSACTION LEDGER IMMUTABILITY TRIGGER
-- - Strictly blocks DELETE on all transactions
-- - Strictly blocks UPDATE once a transaction reaches a committed/finalized state (COMPLETED, FAILED, REVERSED)
-- - Allows PENDING -> COMPLETED/FAILED/REVERSED transition, but forbids tampering with financial terms (amount, walletId, type)
CREATE OR REPLACE FUNCTION trg_fn_protect_transaction_ledger() RETURNS TRIGGER AS $$
BEGIN
    -- Block all DELETE operations on ledger
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'FINANCIAL LEDGER SECURITY: Transactions cannot be deleted. Ledger is append-only. Use offsetting reversal transactions.';
    END IF;

    -- Block UPDATE on already committed transactions
    IF OLD.status IN ('COMPLETED', 'FAILED', 'REVERSED') THEN
        RAISE EXCEPTION 'FINANCIAL LEDGER SECURITY: Cannot update a committed/finalized transaction (ID: %, status: %).', OLD.id, OLD.status;
    END IF;

    -- For PENDING transactions, allow status transition but prevent modifying financial terms
    IF OLD.status = 'PENDING' THEN
        IF NEW.amount <> OLD.amount THEN
            RAISE EXCEPTION 'FINANCIAL LEDGER SECURITY: Tampering with transaction amount is prohibited.';
        END IF;

        IF NEW."walletId" <> OLD."walletId" THEN
            RAISE EXCEPTION 'FINANCIAL LEDGER SECURITY: Tampering with transaction destination walletId is prohibited.';
        END IF;

        IF NEW.type <> OLD.type THEN
            RAISE EXCEPTION 'FINANCIAL LEDGER SECURITY: Tampering with transaction type is prohibited.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_transaction_ledger ON "Transaction";
CREATE TRIGGER trg_protect_transaction_ledger
BEFORE UPDATE OR DELETE ON "Transaction"
FOR EACH ROW EXECUTE FUNCTION trg_fn_protect_transaction_ledger();
