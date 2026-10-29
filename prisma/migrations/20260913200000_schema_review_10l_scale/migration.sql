-- ==============================================================================
-- Migration: 20260913200000_schema_review_10l_scale
-- Target: PostgreSQL / Supabase
-- Scale Target: 10 Lakh (1,000,000) Users — Escrow Marketplace
-- Purpose: Schema hardening pass based on full audit findings
-- ==============================================================================

-- ==============================================================================
-- 1. STATUS-AWARE TRANSACTION IMMUTABILITY TRIGGER
-- Replaces the blanket guard installed in 20260913120000 which blocked ALL
-- updates to Transaction — including legitimate PENDING -> COMPLETED/FAILED
-- status transitions by the payment webhook processor.
--
-- New rule:
--   Rows in PENDING may be updated freely (status transitions are business logic).
--   Rows in COMPLETED, FAILED, or REVERSED are immutable — no UPDATE or DELETE.
-- ==============================================================================

-- 1a. Drop the old blanket trigger (installed in prior migration)
DROP TRIGGER IF EXISTS trg_protect_transaction_ledger ON "Transaction";

-- 1b. Create the new status-aware guard function
CREATE OR REPLACE FUNCTION trg_fn_protect_transaction_ledger_v2()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow: PENDING -> any terminal state (the normal payment flow)
    -- Block: any mutation on a row that is already in a terminal state
    IF OLD.status IN ('COMPLETED', 'FAILED', 'REVERSED') THEN
        RAISE EXCEPTION
            'LEDGER INTEGRITY: Transaction % is in terminal state % and cannot be mutated. '
            'Create a new compensating transaction (REFUND/CLAWBACK) instead.',
            OLD.id, OLD.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1c. Install the new trigger
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_protect_transaction_ledger_v2'
    ) THEN
        CREATE TRIGGER trg_protect_transaction_ledger_v2
        BEFORE UPDATE OR DELETE ON "Transaction"
        FOR EACH ROW EXECUTE FUNCTION trg_fn_protect_transaction_ledger_v2();
    END IF;
END $$;

-- 1d. Ensure AuditLog immutability trigger function exists (idempotent)
CREATE OR REPLACE FUNCTION trg_fn_protect_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'AUDIT INTEGRITY: AuditLog rows are append-only and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_immutable_audit_log'
    ) THEN
        CREATE TRIGGER trg_immutable_audit_log
        BEFORE UPDATE OR DELETE ON "AuditLog"
        FOR EACH ROW EXECUTE FUNCTION trg_fn_protect_audit_log();
    END IF;
END $$;


-- ==============================================================================
-- 2. REMOVE AuditLog.updatedAt COLUMN
-- AuditLog is append-only. Prisma's @updatedAt auto-issues an UPDATE on every
-- upsert which the immutability trigger blocks with an exception.
-- Removing the column eliminates the conflict and clarifies the table intent.
-- ==============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'AuditLog'
          AND column_name  = 'updatedAt'
    ) THEN
        ALTER TABLE "AuditLog" DROP COLUMN "updatedAt";
    END IF;
END $$;


-- ==============================================================================
-- 3. MISSING COMPOSITE INDEXES — Top-10 Query Coverage
-- Based on actual Prisma query patterns found in src/app/api/** and src/lib/**
-- ==============================================================================

-- 3a. Campaign: Brand Dashboard
-- Query: WHERE brandId=X AND status=Y AND deletedAt IS NULL ORDER BY createdAt DESC
-- Previously: Postgres chose between [brandId,deletedAt,createdAt] and
-- [brandId,status,deletedAt] — now a single index scan covers all predicates + sort.
CREATE INDEX IF NOT EXISTS "Campaign_brandId_status_deletedAt_createdAt_desc_idx"
    ON "Campaign"("brandId", "status", "deletedAt", "createdAt" DESC);


-- 3b. Deal: FY Earnings Range — Influencer
-- Query: WHERE influencerId=X AND status='COMPLETED' AND completedAt >= startOfFY
-- Found in: src/app/api/metrics/**, gamification-engine.ts, analytics endpoints
-- Without: Postgres filters completedAt in memory after index scan — seq-scan risk
-- at 1M+ deal rows.
CREATE INDEX IF NOT EXISTS "Deal_influencerId_status_completedAt_idx"
    ON "Deal"("influencerId", "status", "completedAt");


-- 3c. Deal: FY Spend Range — Brand
-- Query: WHERE brandId=X AND status='COMPLETED' AND completedAt >= startOfFY
CREATE INDEX IF NOT EXISTS "Deal_brandId_status_completedAt_idx"
    ON "Deal"("brandId", "status", "completedAt");


-- 3d. AuditLog: Admin Audit Trail Pagination
-- Query: WHERE entityType='Deal' AND entityId=X ORDER BY timestamp DESC LIMIT 20
-- Old [entityType, entityId] index had no sort — Postgres sorted in memory.
-- DESC index enables index-only reverse scans.
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_timestamp_desc_idx"
    ON "AuditLog"("entityType", "entityId", "timestamp" DESC);

DROP INDEX IF EXISTS "AuditLog_entityType_entityId_idx";

-- 3e. AuditLog: Actor Timeline Pagination
-- Query: WHERE actorId=X ORDER BY timestamp DESC
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_timestamp_desc_idx"
    ON "AuditLog"("actorId", "timestamp" DESC);

DROP INDEX IF EXISTS "AuditLog_actorId_idx";


-- ==============================================================================
-- 4. VERIFY FINANCIAL CHECK CONSTRAINTS (idempotent re-assertion)
-- Originally installed in 20260913120000. Re-assert here for completeness.
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_wallet_balance_nonnegative') THEN
        ALTER TABLE "Wallet" ADD CONSTRAINT check_wallet_balance_nonnegative
            CHECK (balance >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_wallet_pending_nonnegative') THEN
        ALTER TABLE "Wallet" ADD CONSTRAINT check_wallet_pending_nonnegative
            CHECK ("pendingBalance" >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_transaction_amount_positive') THEN
        ALTER TABLE "Transaction" ADD CONSTRAINT check_transaction_amount_positive
            CHECK (amount > 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_payment_hold_amount_positive') THEN
        ALTER TABLE "PaymentHold" ADD CONSTRAINT check_payment_hold_amount_positive
            CHECK (amount > 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_withdrawal_amount_positive') THEN
        ALTER TABLE "Withdrawal" ADD CONSTRAINT check_withdrawal_amount_positive
            CHECK (amount >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_deal_amounts_nonnegative') THEN
        ALTER TABLE "Deal" ADD CONSTRAINT check_deal_amounts_nonnegative
            CHECK (
                amount >= 0 AND
                "platformFee" >= 0 AND
                "gatewayFee" >= 0 AND
                "totalAmount" >= 0
            );
    END IF;
END $$;


-- ==============================================================================
-- MONEY COLUMN AUDIT — ALL INTEGER (PAISE) — PASS
-- ==============================================================================
-- Wallet:            balance, pendingBalance, totalEarned, totalWithdrawn,
--                    totalDeposited, totalSpent, debt                     INT
-- Transaction:       amount                                                INT
-- Deal:              amount, platformFee, gatewayFee, totalAmount,
--                    influencerPayout, tdsDeducted, grossPayout, netPayout,
--                    productValue, productHandlingFee                     INT
-- PaymentHold:       amount                                                INT
-- Withdrawal:        amount                                                INT
-- DebtClaim:         amount, originalAmount                                INT
-- Campaign:          totalBudget, perInfluencerBudget, reservedAmount,
--                    fundedAmount, reservedTotalAmount, productValue       INT
-- InfluencerProfile: minRate, maxRate, *Rate fields, totalEarnings         INT
-- BrandProfile:      totalSpent                                            INT
--
-- NOTE: instagramEngagementRate and youtubeEngagementRate are Float (basis
-- points) — these are engagement ratios, NOT money. Acceptable as-is.
-- ==============================================================================


-- ==============================================================================
-- SOFT-DELETE DECISION MATRIX
-- ==============================================================================
-- Soft-delete (deletedAt column, intercepted by Prisma middleware in db.ts):
--   User, Campaign, Application, Deal, BankAccount, Transaction,
--   Dispute, DisputeEvidence, Review, Message, InfluencerProfile, BrandProfile
--   NOTE: InfluencerProfile and BrandProfile added to MODELS_WITH_SOFT_DELETE
--   in db.ts in this release (they already had deletedAt columns).
--
-- Hard-delete (ephemeral / no compliance requirement):
--   OAuthAccount, OAuthState, LoginAttempt, DeviceFingerprint,
--   Notification, UserBadge, UserChallengeProgress, WeeklyChallenge,
--   OtpToken, IdempotencyKey (TTL-based), ProcessedWebhookEvent,
--   DeadLetterJob, BlogSubscriber, UserBlock, UserReport, EngagementSnapshot
--
-- Append-only (DB trigger prevents any UPDATE or DELETE):
--   AuditLog (trg_immutable_audit_log)
--   Transaction terminal states (trg_protect_transaction_ledger_v2)
--   WalletAuditLog (trg_immutable_audit from security-hardening.sql)
-- ==============================================================================


-- ==============================================================================
-- ROLLBACK INSTRUCTIONS (DOWN MIGRATION)
-- ==============================================================================
-- To revert this migration:
--
-- -- 1. Drop the new status-aware trigger; restore old blanket trigger
-- DROP TRIGGER IF EXISTS trg_protect_transaction_ledger_v2 ON "Transaction";
-- DROP FUNCTION IF EXISTS trg_fn_protect_transaction_ledger_v2();
-- -- (Re-install old blanket trigger from 20260913120000 if needed)
--
-- -- 2. Restore AuditLog.updatedAt (rows added after this migration will have NULL)
-- ALTER TABLE "AuditLog"
--     ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL;
--
-- -- 3. Drop new composite indexes
-- DROP INDEX IF EXISTS "Campaign_brandId_status_deletedAt_createdAt_desc_idx";
-- DROP INDEX IF EXISTS "Deal_influencerId_status_completedAt_idx";
-- DROP INDEX IF EXISTS "Deal_brandId_status_completedAt_idx";
-- DROP INDEX IF EXISTS "AuditLog_entityType_entityId_timestamp_desc_idx";
-- DROP INDEX IF EXISTS "AuditLog_actorId_timestamp_desc_idx";
--
-- -- 4. Re-create old single-column AuditLog indexes
-- CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx"
--     ON "AuditLog"("entityType", "entityId");
-- CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx"
--     ON "AuditLog"("actorId");
-- ==============================================================================
