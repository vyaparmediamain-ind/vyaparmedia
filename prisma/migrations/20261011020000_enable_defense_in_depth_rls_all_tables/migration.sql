-- ==============================================================================
-- Migration: 20261011020000_enable_defense_in_depth_rls_all_tables
-- Target: PostgreSQL / Supabase
-- Security Finding: P7-SEC-01 (Defense-in-depth Row Level Security across sensitive entities)
-- ==============================================================================

-- 1. Table: Message
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_select_participants_or_service" ON "Message";
CREATE POLICY "message_select_participants_or_service" ON "Message"
    FOR SELECT
    USING (
        (auth.uid() IS NOT NULL AND (auth.uid()::text = "senderId" OR auth.uid()::text = "receiverId"))
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "message_insert_sender_or_service" ON "Message";
CREATE POLICY "message_insert_sender_or_service" ON "Message"
    FOR INSERT
    WITH CHECK (
        (auth.uid() IS NOT NULL AND auth.uid()::text = "senderId")
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "message_modify_service_role_only" ON "Message";
CREATE POLICY "message_modify_service_role_only" ON "Message"
    FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');


-- 2. Table: Notification
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_select_owner_or_service" ON "Notification";
CREATE POLICY "notification_select_owner_or_service" ON "Notification"
    FOR SELECT
    USING (
        (auth.uid() IS NOT NULL AND auth.uid()::text = "userId")
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "notification_modify_service_role_only" ON "Notification";
CREATE POLICY "notification_modify_service_role_only" ON "Notification"
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');


-- 3. Table: Deal
ALTER TABLE "Deal" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deal_select_parties_or_service" ON "Deal";
CREATE POLICY "deal_select_parties_or_service" ON "Deal"
    FOR SELECT
    USING (
        (auth.uid() IS NOT NULL AND (
            "brandId" IN (SELECT id FROM "BrandProfile" WHERE "userId" = auth.uid()::text)
            OR "influencerId" IN (SELECT id FROM "InfluencerProfile" WHERE "userId" = auth.uid()::text)
        ))
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "deal_modify_service_role_only" ON "Deal";
CREATE POLICY "deal_modify_service_role_only" ON "Deal"
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');


-- 4. Table: VerificationDocument
ALTER TABLE "VerificationDocument" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "verification_document_select_owner_or_service" ON "VerificationDocument";
CREATE POLICY "verification_document_select_owner_or_service" ON "VerificationDocument"
    FOR SELECT
    USING (
        (auth.uid() IS NOT NULL AND auth.uid()::text = "userId")
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "verification_document_modify_service_role_only" ON "VerificationDocument";
CREATE POLICY "verification_document_modify_service_role_only" ON "VerificationDocument"
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');


-- 5. Table: IndiaTaxCompliance
ALTER TABLE "IndiaTaxCompliance" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "india_tax_compliance_select_owner_or_service" ON "IndiaTaxCompliance";
CREATE POLICY "india_tax_compliance_select_owner_or_service" ON "IndiaTaxCompliance"
    FOR SELECT
    USING (
        (auth.uid() IS NOT NULL AND auth.uid()::text = "userId")
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "india_tax_compliance_modify_service_role_only" ON "IndiaTaxCompliance";
CREATE POLICY "india_tax_compliance_modify_service_role_only" ON "IndiaTaxCompliance"
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');


-- 6. Table: BankAccount
ALTER TABLE "BankAccount" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_account_select_owner_or_service" ON "BankAccount";
CREATE POLICY "bank_account_select_owner_or_service" ON "BankAccount"
    FOR SELECT
    USING (
        (auth.uid() IS NOT NULL AND auth.uid()::text = "userId")
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "bank_account_insert_owner_or_service" ON "BankAccount";
CREATE POLICY "bank_account_insert_owner_or_service" ON "BankAccount"
    FOR INSERT
    WITH CHECK (
        (auth.uid() IS NOT NULL AND auth.uid()::text = "userId")
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "bank_account_modify_service_role_only" ON "BankAccount";
CREATE POLICY "bank_account_modify_service_role_only" ON "BankAccount"
    FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
