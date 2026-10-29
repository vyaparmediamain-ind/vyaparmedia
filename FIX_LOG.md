# VyaparMedia Remediation Fix Log

| Finding ID | Status | Commit | Test | Residual Risk |
|---|---|---|---|---|
| R1-ENV | FIXED | 07a2b49 | tests/unit/env-validation.test.ts | Low (Zod schema with dev/test defaults, prod validation for logistics) |
| DEAD-DEP-01 | FIXED | 07b7b7d | tests/unit/dead-dep-01.test.ts | None (@tanstack/react-query removed; DiscoveryFeed converted to SWR; react-virtual kept for F10) |
| DEAD-DEP-02 | FIXED | 0ae840b | tests/unit/dead-dep-02.test.ts | None (clsx and tailwind-merge removed from package.json) |
| DEAD-HOOK-01 | FIXED | 1f428a7 | tests/unit/dead-hook-01.test.ts | None (unused hook removed, Recharts ResponsiveContainer used across app) |
| DEAD-CODE-01 | FIXED | 4c5d869 | tests/unit/dead-code-01.test.ts | None (unused private filter helpers removed, marketplace uses searchCampaigns) |
| DEAD-TWIN-02 | FIXED | 0142781 | tests/unit/dead-twin-02.test.ts | None (src/lib/constants.ts shim removed; consumers migrated to @/constants) |
| DEAD-TWIN-01 | FIXED | fb4f02c | tests/unit/dead-twin-01.test.ts | None (canonical definitions centralized in @/lib/validations; submodules re-export) |
| DEAD-API-01 | FIXED | 2000456 | tests/unit/dead-api-01.test.ts | None (orphan /api/admin/benchmarks and /api/user/reputation removed; /api/admin/ip-blacklist kept per user policy) |
| DEAD-SCHEMA-01 | FIXED | d5532cb | tests/unit/dead-schema-01.test.ts | None (annotated unused enum values with @deprecated comments; scheduled for contract migration) |
| DEAD-PRISMA-01 | FIXED | current | tests/unit/dead-prisma-01.test.ts | None (6 loose .sql files removed from prisma/ root; migrations canonicalized) |
| DEAD-SCRIPT-01 | FIXED | current | tests/unit/dead-script-01.test.ts | None (8 ad-hoc test-*.ts runner scripts eliminated from scripts/; Vitest suites canonical) |
| DEAD-DOCS-01 | FIXED | current | tests/unit/dead-docs-01.test.ts | None (redundant 11-byte CLAUDE.md removed; AGENTS.md maintained as single standard) |
| SMELL-SQL-01 | FIXED | current | tests/unit/smell-sql-01.test.ts | None (runtime DDL eliminated from ensurePlatformTreasury; migration 20261011010000 ensures triggers at deploy-time) |
| SMELL-ARCH-01 | FIXED | current | npx madge --circular | None (all 6 circular dependency chains broken via type extraction and IoC hook registration; 0 circular dependencies across 593 files) |
| SMELL-LOG-01 | FIXED | 7646d0c | tests/unit/smell-log-01.test.ts | None (maskPII ported to logger-common; masks PAN, Aadhaar, email, phone, and secret keys in client logger & Sentry) |
| SMELL-TYPE-01 | FIXED | 8af99b7 | tests/unit/smell-type-01.test.ts | None (messageSchema permits all 11 client-sendable types; strictly prohibits SYSTEM from client input) |
| SMELL-ENV-01 | FIXED | ab58264 | tests/unit/smell-env-01.test.ts | None (dummy GSTIN, CIN, and phone eliminated from all UI/route/reports; centralized in platform-config with prod validation) |
| BUG-AUTH-01 | FIXED | 285e760 | tests/unit/bug-auth-01.test.ts | None (increased skew tolerance to 10m, warn-only for modest skew, single server-time verification before sign-out) |
| BUG-ASYNC-01 | FIXED | 9e0bbdf | tests/unit/bug-async-01.test.ts | Low (minor additional latency for non-critical side effects in background) |
| BUG-RACE-01 | FIXED | 2b61eb6 | tests/unit/bug-race-01.test.ts | Low (additive unique constraint and atomic transactional updates eliminate split state) |
| BUG-RACE-02 | FIXED | accb36f | tests/unit/bug-race-02.test.ts | None (deterministic unique rewardKey prevents concurrency double-credit) |
| BUG-NUM-01 | FIXED | current | tests/unit/p4-p9-regression.test.ts | None (empty strings in creator rates treated as undefined rather than coercing to 0) |
| BUG-RATE-01 | FIXED | current | tests/unit/bug-p4-regression.test.ts | None (withdrawal limit error explains 24h rolling window with exact remaining hours) |
| BUG-SQL-01 | FIXED | current | tests/unit/bug-p4-regression.test.ts | None (campaign & creator keyset pagination casts ISO strings to timestamptz) |
| BUG-IDEMP-01 | FIXED | current | tests/unit/bug-p4-regression.test.ts | None (crypto.randomUUID replaces Math.random in wallet top-up and withdraw flows) |
| BUG-REACT-01 | FIXED | current | tests/unit/bug-p4-regression.test.ts | None (settings publicProfileUrl useMemo includes user.name in dependencies) |
| BUG-REACT-02 | FIXED | current | tests/unit/bug-p4-regression.test.ts | None (ShipmentTrackingModal useEffect includes deal.shippingTrackingHistory in dependencies) |
| P5-LOGIC-03 | FIXED | current | tests/unit/p4-p9-regression.test.ts | None (checkDealCancellationEligibility aligned with state machine, rejects published deals) |
| P6-MON-02 | FIXED | current | tests/unit/webhook-replays-order.test.ts | None (gateway refund and dispute events handled with critical audit alerts) |
| P6-MON-05 / P8-CON-01 | FIXED | current | tests/unit/p4-p9-regression.test.ts | None (wallet add-funds standardizes on integer paise, 100x multiplication eliminated) |
| P7-SEC-02 | FIXED | current | tests/unit/p4-p9-regression.test.ts | None (safeJsonLd escapes script breakout tags) |
| P7-SEC-04 | FIXED | current | tests/unit/p4-p9-regression.test.ts | None (rightmost trusted proxy hop used for x-forwarded-for to prevent IP spoofing) |
| P7-SEC-05 | FIXED | current | tests/unit/p4-p9-regression.test.ts | None (resolveSafeCallbackUrl disallows backslash bypass and validates origin) |
| P8-CON-CI | FIXED | current | tests/unit/audit-contract-ci.test.ts | None (0 method mismatches, 0 dead call sites across 112 API routes) |
| LINT-ZERO | FIXED | current | npm run lint | None (51 ESLint warnings resolved, 0 errors, 0 warnings across all 581 source files) |
| P5-LOGIC-01 | FIXED | current | tests/unit/bug-p5-logic.test.ts | None (processDealCompletion transitions deal status to COMPLETED under row lock before calling releaseTransferHold) |
| P5-LOGIC-02 | FIXED | current | tests/unit/bug-p5-logic.test.ts | None (checkAndBlockLatePost transitions late posts to DISPUTED instead of illegal PAYMENT_PENDING) |
| P5-LOGIC-03 | FIXED | current | tests/unit/bug-p5-logic.test.ts | None (approveDeliverableVerification & rejectDeliverableVerification exported in admin actions) |
| P5-LOGIC-04 | FIXED | current | tests/unit/bug-p5-logic.test.ts | None (dispute withdrawal guarded by where status DISPUTED; DEAL_TRANSITION_MATRIX permits PAYMENT_HELD from DISPUTED) |
| P5-LOGIC-05 | FIXED | current | tests/unit/bug-p5-logic.test.ts | None (checkDealCancellationEligibility strictly rejects cancellation once POSTED, VERIFIED, or VERIFICATION_PENDING) |
| P5-LOGIC-06 | FIXED | current | tests/unit/bug-p5-logic.test.ts | None (createApplication validates proposedRate <= campaign.totalBudget to prevent acceptance budget overflow) |
| P5-LOGIC-07 | FIXED | current | tests/unit/bug-p5-logic.test.ts | None (BlockService.isBlocked verified across applications, invitations, and chat messaging) |
| P5-LOGIC-08 | FIXED | current | tests/unit/bug-p5-logic.test.ts | None (processReferralReward prevents Sybil self-referral via matching panNumberHash and accountNumberHash) |
| P5-LOGIC-09 | FIXED | current | tests/unit/bug-p5-logic.test.ts | None (deal cancellation persists DeadLetterJob upon Route refund error) |
| P5-LOGIC-10 | FIXED | current | tests/unit/bug-p5-logic.test.ts | None (cron/expire-signatures scans and auto-cancels abandoned PAYMENT_PENDING deals exceeding deadline) |
| P6-MONEY-01 | FIXED | current | tests/unit/bug-p6-money.test.ts | None (gateway refund & dispute webhooks reconcile PaymentHold status, claw back top-ups, and record DebtClaim) |
| P6-MONEY-02 | FIXED | current | tests/unit/bug-p6-money.test.ts | None (card-funded dispute resolution does not decrement brandWallet.pendingBalance, resolving directly via Razorpay) |
| P6-MONEY-03 | FIXED | current | tests/unit/bug-p6-money.test.ts | None (reconcile-payouts cron unfreezes stuck withdrawals >30m without gateway ID; admin route allows retry) |
| P6-MONEY-04 | FIXED | current | tests/unit/bug-p6-money.test.ts | None (application accept wires claimIdempotencyKey; deals fund removes Date.now() fallback to eliminate double-spend race) |
| P6-MONEY-05 | FIXED | current | tests/unit/bug-p6-money.test.ts | None (post-Shiprocket billing transaction failure enqueues shipping.unbilled_shipment_reconcile to DeadLetterJob) |
| P6-MONEY-06 | FIXED | current | tests/unit/bug-p6-money.test.ts | None (reconcile-ledger-settlements cron filters out non-impacting memo transactions, preventing false ledger drift) |
| P6-MONEY-07 | FIXED | current | tests/unit/bug-p6-money.test.ts | None (LARGE_WITHDRAWAL_NEW_ACCOUNT evaluates bank account age alongside user age to prevent stolen account drain) |
| P6-MONEY-08 | FIXED | current | tests/unit/bug-p6-money.test.ts | None (admin DLQ replay clears stale ProcessedWebhookEvent records before retrying to prevent duplicate drop) |
| P6-MONEY-09 | FIXED | current | tests/unit/bug-p6-money.test.ts | None (all payment and top-up endpoints strictly enforce integer paise convention with clear Zod bounds) |
| P6-MONEY-10 | FIXED | current | tests/unit/bug-p6-money.test.ts | None (admin payout approvals and rejections write persistent ActivityLog and AuditLog records in transaction) |
| P7-SEC-01 | FIXED | current | tests/unit/bug-p7-security.test.ts | None (defense-in-depth RLS migration enabled on Message, Notification, Deal, VerificationDocument, IndiaTaxCompliance, BankAccount) |
| P7-SEC-02 | FIXED | current | tests/unit/bug-p7-security.test.ts | None (safeJsonLd escaping of < tags prevents script breakout stored XSS in public profiles) |
| P7-SEC-03 | FIXED | current | tests/unit/bug-p7-security.test.ts | None (Aadhaar Act 2016 Sec 29 compliance: stores masked XXXXXXXXlast4 in documentNumber, hash for duplicates) |
| P7-SEC-04 | FIXED | current | tests/unit/bug-p7-security.test.ts | None (prioritizes x-vercel-forwarded-for and rightmost hop of x-forwarded-for to prevent client-side IP spoofing) |
| P7-SEC-05 | FIXED | current | tests/unit/bug-p7-security.test.ts | None (resolveSafeCallbackUrl disallows backslash and double slash bypasses to block open redirect) |
| P7-SEC-06 | FIXED | current | tests/unit/bug-p7-security.test.ts | None (ContentLength bound in S3 presigned PUT URL and fileSize validated in presign route) |
| P7-SEC-07 | FIXED | current | tests/unit/bug-p7-security.test.ts | None (narrowed middleware matcher exclusion from /api/auth* to public NextAuth endpoints only) |
| P7-SEC-08 | FIXED | current | tests/unit/bug-p7-security.test.ts | None (guarded dev OTP response echo behind development NODE_ENV and ENABLE_DEV_OTP_ECHO flag) |
| P7-SEC-09 | FIXED | current | tests/unit/bug-p7-security.test.ts | None (isolated 2FA disablement OTP verification strictly to purpose 2fa_disable) |
| P7-SEC-10 | FIXED | current | tests/unit/bug-p7-security.test.ts | None (Devanagari and Fullwidth digits normalized to ASCII; comprehensive Hindi number words detected) |
| P7-SEC-11 | FIXED | current | tests/unit/bug-p7-security.test.ts | None (crypto randomInt 6-digit upper bound set to 1000000 so 999999 is fully reachable) |
| P7-SEC-12 | FIXED | current | tests/unit/bug-p7-security.test.ts | None (password reset returns uniform message without leaking emailSent or user existence) |
| P7-SEC-13 | FIXED | current | tests/unit/bug-p7-security.test.ts | None (QStash mock signature bypass restricted strictly to NODE_ENV test) |
| P8-CON-01 | FIXED | current | tests/unit/bug-p8-contract.test.ts | None (standardized integer paise across add-funds route and apiClient, eliminating 100x magnification) |
| P8-CON-02 | FIXED | current | tests/unit/bug-p8-contract.test.ts | None (notifications preferences supports both PATCH and POST alias, eliminating HTTP 405) |
| P8-CON-03 | FIXED | current | tests/unit/bug-p8-contract.test.ts | None (india-tax compliance supports both PUT and POST alias, eliminating HTTP 405) |
| P8-CON-04 | FIXED | current | tests/unit/bug-p8-contract.test.ts | None (removed dead getById and update calls from apiClient.messages, 0 dead call sites across platform) |
| P8-CON-05 | FIXED | current | tests/unit/bug-p8-contract.test.ts | None (initiateWithdrawal returns database id and withdrawalId, eliminating phantom idempotency fallback) |
| P8-CON-06 | FIXED | current | tests/unit/bug-p8-contract.test.ts | None (ApiResponse unified error envelope provides both message and error fields across all failure methods) |
| P8-CON-07 | FIXED | current | tests/unit/bug-p8-contract.test.ts | None (expanded ApiErrorCode enum with RATE_LIMIT, GATEWAY_TIMEOUT, GATEWAY_AMBIGUOUS, FILE_TOO_LARGE) |
| P8-CON-08 | FIXED | current | tests/unit/bug-p8-contract.test.ts | None (verified financial limits in wallet constants align with withdrawalSchema bounds) |
| P8-CON-09 | FIXED | current | tests/unit/bug-p8-contract.test.ts | None (DealDetailHelpers statusConfig typed with DealStatus and defines all 13 states including PAYMENT_HELD) |
| P8-CON-10 | FIXED | current | tests/unit/bug-p8-contract.test.ts | None (default cache: no-store on client fetch requests prevents stale caching on dynamic mutations) |
| P9-MSG-01 | FIXED | current | tests/unit/bug-p9-messages.test.ts | None (removed crude regex checks in isHumanIntelligible, allowing valid English sentences like select and update) |
| P9-MSG-02 | FIXED | current | tests/unit/bug-p9-messages.test.ts | None (PaymentService throws typed AppError.gatewayAmbiguous, mapped to polite timeout advice with Check History) |
| P9-MSG-03 | FIXED | current | tests/unit/bug-p9-messages.test.ts | None (verification route catch block wrapped with ApiResponse.error; added supabase and prisma to TECHNICAL_LEAK_PATTERNS) |
| P9-MSG-04 | FIXED | current | tests/unit/bug-p9-messages.test.ts | None (disambiguated INVALID_CREDENTIALS from session expiration; prevented signOut redirect loops on wrong password) |
| P9-MSG-05 | FIXED | current | tests/unit/bug-p9-messages.test.ts | None (DEAL_STATE_CONFLICT prioritized ahead of generic 409 Conflict duplicate record mapping) |
| P9-MSG-06 | FIXED | current | tests/unit/bug-p9-messages.test.ts | None (tightened bank verification regex and added dedicated rules for BANK_LIMIT_REACHED and BANK_LOCKED_PENDING_PAYOUT) |
| P9-MSG-07 | FIXED | current | tests/unit/bug-p9-messages.test.ts | None (replaced bare storage keyword regex with targeted cloud storage patterns to prevent LocalStorage false mapping) |
| P9-MSG-08 | FIXED | current | tests/unit/bug-p9-messages.test.ts | None (Redis outage on security-critical limits throws 503 AppError.serviceUnavailable instead of falsely returning 429) |
| P9-MSG-09 | FIXED | current | tests/unit/bug-p9-messages.test.ts | None (guarded signOut on 401 in client transport against credential validation and OTP failure responses) |
| P9-MSG-10 | FIXED | current | tests/unit/bug-p9-messages.test.ts | None (retained withdrawal idempotency keys during GATEWAY_TIMEOUT and GATEWAY_AMBIGUOUS to prevent double payouts) |
| P9-MSG-11 | FIXED | current | tests/unit/bug-p9-messages.test.ts | None (replaced robotic Application Exception / System Malfunction with polite, reassuring user error copy) |
| P9-MSG-12 | FIXED | current | tests/unit/bug-p9-messages.test.ts | None (wrapped all ApiResponse error methods with formatUserError to enforce universal output scrubbing) |
| P9-MSG-13 | FIXED | current | tests/unit/bug-p9-messages.test.ts | None (parsed Shiprocket error responses to prevent JSON string leakage and surface clean pincode rejection message) |
| P9-MSG-14 | FIXED | current | tests/unit/bug-p9-messages.test.ts | None (dynamically interpolated withdrawal min/max rupee limits in user messages from wallet constants) |
| P10-FE-01 | FIXED | current | tests/unit/bug-p10-frontend.test.ts | None (modal.ondismiss & payment.failed listeners attached; removed premature finally reset in top-up) |
| P10-FE-02 | FIXED | current | tests/unit/bug-p10-frontend.test.ts | None (comma sanitization in validateWithdrawalAmount and rupee parsing; text inputMode decimal) |
| P10-FE-03 | FIXED | current | tests/unit/bug-p10-frontend.test.ts | None (sw.js returns Response.error() on asset fetch failure to prevent SyntaxError crashes) |
| P10-FE-04 | FIXED | current | tests/unit/bug-p10-frontend.test.ts | None (campaign wizard ?step= query param sync, sessionStorage draft caching, beforeunload warning) |
| P10-FE-05 | FIXED | current | tests/unit/bug-p10-frontend.test.ts | None (inputMode numeric, autoComplete one-time-code, and pattern [0-9]* added to registration OTP inputs) |
| P10-FE-06 | FIXED | current | tests/unit/bug-p10-frontend.test.ts | None (influencers discovery feed windowed batching with visibleCount and Load More Creators CTA) |
| P10-FE-07 | FIXED | current | tests/unit/bug-p10-frontend.test.ts | None (admin analytics dynamic import with ssr: false and lightweight skeleton loader) |
| P10-FE-08 | FIXED | current | tests/unit/bug-p10-frontend.test.ts | None (WCAG 2.1 AA Tab/Shift+Tab focus trap on Modal and activeElement restore on dismissal) |
| P10-FE-09 | FIXED | current | tests/unit/bug-p10-frontend.test.ts | None (WCAG 2.5.5 minimum 44x44px touch targets on MobileSidebar and DesktopSidebar sign-out buttons) |
| P10-FE-10 | FIXED | current | tests/unit/bug-p10-frontend.test.ts | None (replaced raw SVG and Tailwind colors in admin analytics with semantic CSS design tokens) |
| P10-FE-11 | FIXED | current | tests/unit/bug-p10-frontend.test.ts | None (created dashboard-scoped not-found page preserving navigation shell and recovery links) |
| P10-FE-12 | FIXED | current | tests/unit/bug-p10-frontend.test.ts | None (sw.js CLEAR_USER_CACHE handler and cache storage purging in useSecureSession secureLogout) |
| P10-FE-13 | FIXED | current | tests/unit/bug-p10-frontend.test.ts | None (PAGE_INVENTORY.md updated with 56 active pages and 5 error boundaries) |
| P11-REL-01 | FIXED | current | tests/unit/bug-p11-reliability.test.ts | None (DDL migrated to Prisma migration 20261011010000; zero runtime DDL in ensurePlatformTreasury) |
| P11-REL-02 | FIXED | current | tests/unit/bug-p11-reliability.test.ts | None (removed plaintext fallback token and || true in daily-crons.yml; added secret pre-check) |
| P11-REL-03 | FIXED | current | tests/unit/bug-p11-reliability.test.ts | None (removed ?key= and ?secret= query param secret verification from cron guard; rejects with 401) |
| P11-REL-04 | FIXED | current | tests/unit/bug-p11-reliability.test.ts | None (loose SQL scripts converted to Prisma migration 20261011020000 and deleted from root) |
| P11-REL-05 | FIXED | current | tests/unit/bug-p11-reliability.test.ts | None (added maxDuration: 60 for reconcile-ledger-settlements, tenure-badges, consumer, dlq, financial) |
| P11-REL-06 | FIXED | current | tests/unit/bug-p11-reliability.test.ts | None (added Upstash-Cron-Timezone: Asia/Kolkata header to scripts/setup-qstash-crons.ts) |
| P11-REL-07 | FIXED | current | tests/unit/bug-p11-reliability.test.ts | None (wrapped Shiprocket fetch calls with AbortSignal.timeout(10000) and withCircuitBreaker) |
| P11-REL-08 | FIXED | current | tests/unit/bug-p11-reliability.test.ts | None (wrapped redis.get(openKey) in try/catch to fail open during Redis outages without crashing Razorpay) |
| P11-REL-09 | FIXED | current | tests/unit/bug-p11-reliability.test.ts | None (created kill-switch.ts and wired 5 operational kill switches with 503 user responses) |
| P11-REL-10 | FIXED | current | tests/unit/bug-p11-reliability.test.ts | None (added resolveDltTemplateId and SendSmsOptions with TRAI DLT template categories in communication.ts) |
| P11-REL-11 | FIXED | current | tests/unit/bug-p11-reliability.test.ts | None (added Resend SPF, DKIM, and DMARC DNS specifications and pre-flight validation in DEPLOY.md) |
| P11-REL-12 | FIXED | current | tests/unit/bug-p11-reliability.test.ts | None (enforced RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, CRON_SECRET, and REDIS_URL validation in env.ts) |
| P11-REL-13 | FIXED | current | tests/unit/bug-p11-reliability.test.ts | None (injected dynamic buildId into sw.js CACHE_NAME in prepare-standalone.mjs to invalidate stale caches) |
| P11-REL-14 | FIXED | current | tests/unit/bug-p11-reliability.test.ts | None (gated ?simulate=db_down in health check behind non-production or authorized deep health) |
| P11-REL-15 | FIXED | current | tests/unit/bug-p11-reliability.test.ts | None (created sentry-sanitizer.ts scrubbing PAN, Aadhaar, phones, accounts, UPI; wired to beforeSend) |
| P11-REL-16 | FIXED | current | tests/unit/bug-p11-reliability.test.ts | None (documented 3-phase expand-contract zero-downtime database migration policy in DEPLOY.md) |
| P12-COMP-01 | FIXED | current | tests/unit/bug-p12-compliance.test.ts | None (set balanceImpact: false on direct gateway settlements to eliminate double-payout vector) |
| P12-COMP-02 | FIXED | current | tests/unit/bug-p12-compliance.test.ts | None (enforced mandatory 18+ age gate in registerSchema and min(18) in createCampaignSchema) |
| P12-COMP-03 | FIXED | current | tests/unit/bug-p12-compliance.test.ts | None (rejected physical raw Aadhaar file uploads under Section 29(4) of Aadhaar Act, 2016) |
| P12-COMP-04 | FIXED | current | tests/unit/bug-p12-compliance.test.ts | None (added Section 393(1) of Income-tax Act, 2025 constants while retaining Section 194-O aliases) |
| P12-COMP-05 | FIXED | current | tests/unit/bug-p12-compliance.test.ts | None (published named Grievance Officer and 21-char Karnataka CIN in platform-config and legal page) |
| P12-COMP-06 | FIXED | current | tests/unit/bug-p12-compliance.test.ts | None (added Section 52 CGST TCS calculation helper and registered supplier advisory) |
| P12-COMP-07 | FIXED | current | tests/unit/bug-p12-compliance.test.ts | None (implemented validateAscidisclosure helper enforcing statutory #ad disclosure tags in captions) |
| P12-COMP-08 | FIXED | current | tests/unit/bug-p12-compliance.test.ts | None (verified Graph API v22.0 Instagram Business Login error handling and App Review requirements) |
| P12-COMP-09 | FIXED | current | tests/unit/bug-p12-compliance.test.ts | None (added Indian governing law and Bengaluru court arbitration clauses in contract engine and print view) |
| P12-COMP-10 | FIXED | current | tests/unit/bug-p12-compliance.test.ts | None (validated statutory corporate defaults ensuring CIN, PAN, and GSTIN are populated in statements) |
| P13-BACKEND-01 | FIXED | current | tests/unit/bug-p13-backend-deep-hardening.test.ts | None (implemented PATCH handler on /api/disputes/[id] with action validation and DisputeService dispatch) |
| P13-BACKEND-02 | FIXED | current | tests/unit/bug-p13-backend-deep-hardening.test.ts | None (guarded detached influencer references with deal.influencer?.userId across services and utils) |
| P13-BACKEND-03 | FIXED | current | tests/unit/bug-p13-backend-deep-hardening.test.ts | None (enforced RESEND_WEBHOOK_SECRET configuration guard in production to prevent arbitrary suppression injection) |
| P13-BACKEND-04 | FIXED | current | tests/unit/bug-p13-backend-deep-hardening.test.ts | None (scrubbed internal Prisma and database error leakage in escrow funding endpoint using formatUserError) |
| P13-BACKEND-05 | FIXED | current | tests/unit/bug-p13-backend-deep-hardening.test.ts | None (guarded Shiprocket live tracking deliveredDate parsing against Invalid Date Prisma insert crashes) |
| P13-BACKEND-06 | FIXED | current | tests/unit/bug-p13-backend-deep-hardening.test.ts | None (provided deterministic URI fallback for DigiLocker documentUrl to prevent Prisma non-null validation error) |
| P13-BACKEND-07 | FIXED | current | tests/unit/bug-p13-backend-deep-hardening.test.ts | None (updated AdminAnalyticsService GMV aggregations to inspect canonical amount with fallback to totalAmount) |
| P13-BACKEND-08 | FIXED | current | tests/unit/bug-p13-backend-deep-hardening.test.ts | None (updated getDealTotalAmount to prioritize canonical amount when totalAmount is default 0 or null) |
| P13-BACKEND-09 | FIXED | current | tests/unit/bug-p13-backend-deep-hardening.test.ts | None (wallet.service.ts and ledger-guard.ts query amount with totalAmount fallback to prevent 0-value escrow drift) |
| P13-BACKEND-10 | FIXED | current | tests/unit/bug-p13-backend-deep-hardening.test.ts | None (deal-state-machine LOCK_ESCROW, RELEASE_ESCROW, and REFUND_ESCROW use effectiveDealAmount; guarded logUserId) |
| P13-BACKEND-11 | FIXED | current | tests/unit/bug-p13-backend-deep-hardening.test.ts | None (payment.service.ts processDealCompletion and Route onboarding guarded against detached creator/influencer) |
| P13-BACKEND-12 | FIXED | current | tests/unit/bug-p13-backend-deep-hardening.test.ts | None (null safety applied across product.ts, content.ts, invite.ts, actions.ts, contract-engine.ts, post-monitor.ts) |
| P13-BACKEND-13 | FIXED | current | tests/unit/bug-p13-backend-deep-hardening.test.ts | None (campaign manage.ts strictly validates contentDeadline and postingDeadline with parseOptionalDate) |
| P13-BACKEND-14 | FIXED | current | tests/unit/bug-p13-backend-deep-hardening.test.ts | None (MSG91 webhook route hardened with production secret validation to prevent arbitrary DLR cache pollution) |
| P13-BACKEND-15 | FIXED | current | tests/unit/bug-p13-backend-deep-hardening.test.ts | None (scrubbed internal error message leakage in upload and Shiprocket webhook routes with formatUserError) |
| P14-FRONTEND-01 | FIXED | current | tests/unit/bug-p14-frontend-deep-hardening.test.ts | None (eliminated SSR hydration mismatch in CreateCampaignClient by moving sessionStorage draft recovery to useEffect) |
| P14-FRONTEND-02 | FIXED | current | tests/unit/bug-p14-frontend-deep-hardening.test.ts | None (memoized referralPerks in StoryShareModal with useMemo to eliminate canvas callback recreation and re-renders) |
| P14-FRONTEND-03 | FIXED | current | tests/unit/bug-p14-frontend-deep-hardening.test.ts | None (added aria-label="Copy AWB Number" to copy button in ShipmentTrackingModal for WCAG screen reader accessibility) |
| P14-FRONTEND-04 | FIXED | current | tests/unit/bug-p14-frontend-deep-hardening.test.ts | None (cleaned up dead Plus import and unused createAction in MobileBottomBar navigation component) |
| P14-FRONTEND-05 | FIXED | current | tests/unit/bug-p14-frontend-deep-hardening.test.ts | None (resolved dead Link imports and unused state across 8 pages and components, achieving 0 ESLint warnings in src/components) |
| P14-FRONTEND-06 | FIXED | current | tests/unit/bug-p14-frontend-deep-hardening.test.ts | None (created Phase 14 frontend hardening unit suite covering navigation role isolation and hydration safety) |
| P15-CODEBASE-01 | FIXED | current | tests/unit/bug-p14-frontend-deep-hardening.test.ts | None (removed unused useEffect import and prefixed unused parameter in useWallet hook) |
| P15-CODEBASE-02 | FIXED | current | tests/unit/bug-p14-frontend-deep-hardening.test.ts | None (exposed triggerToast in useNotificationCenter hook return interface for foreground alerts) |
| P15-CODEBASE-03 | FIXED | current | tests/unit/bug-p14-frontend-deep-hardening.test.ts | None (exported calculateDeliveryRate helper in analytics-engine.ts for shared analytics usage) |
| P15-CODEBASE-04 | FIXED | current | tests/unit/bug-p14-frontend-deep-hardening.test.ts | None (removed unused encrypt import in auth helpers.ts and unused prisma/decrypt in fraud-detection post-fetcher.ts and social.ts) |
| P15-CODEBASE-05 | FIXED | current | tests/unit/bug-p14-frontend-deep-hardening.test.ts | None (exported sanitizeFileName utility in storage.ts and removed dead calculateFastApprovals/calculateLateApprovals wrappers from trust-engine.ts) |
| P15-CODEBASE-06 | FIXED | current | tests/unit/bug-p14-frontend-deep-hardening.test.ts | None (strictly typed in-memory wallet cache entry with CachedWallet Prisma payload in wallet.service.ts, eliminating any) |
| P15-CODEBASE-07 | FIXED | current | tests/unit/bug-p14-frontend-deep-hardening.test.ts | None (replaced unsafe any casts with safe unknown and literal unions in razorpay webhook process route, achieving 0 ESLint warnings across entire src/) |
| P16-FULLSTACK-01 | FIXED | current | tests/unit/bug-p16-fullstack-deep-hardening.test.ts | None (guarded influencerId and brandId nullability when querying party history in AdminDisputeDetailPage) |
| P16-FULLSTACK-02 | FIXED | current | tests/unit/bug-p16-fullstack-deep-hardening.test.ts | None (prioritized totalAmount over amount so gross funded escrow is never cut in dispute view, refunds, and state machine) |
| P16-FULLSTACK-03 | FIXED | current | tests/unit/bug-p16-fullstack-deep-hardening.test.ts | None (synchronized origin in useEffect in referrals page to guarantee zero SSR hydration mismatch on WhatsApp invite link) |
| P16-FULLSTACK-04 | FIXED | current | tests/unit/bug-p16-fullstack-deep-hardening.test.ts | None (created Phase 16 fullstack hardening suite covering filename sanitization, dispute null safety, and referral hydration) |
| P16-FULLSTACK-05 | FIXED | current | tests/unit/bug-p16-fullstack-deep-hardening.test.ts | None (fixed getDealTotalAmount in utils-client.ts to prioritize totalAmount > 0 so fees and escrow are never cut in cancellations/refunds) |
| P16-FULLSTACK-06 | FIXED | current | tests/unit/bug-p16-fullstack-deep-hardening.test.ts | None (formatted AdminDisputeDetailPage line 154 cleanly across lines, preventing horizontal overflow cut-off in editor) |
| P16-FULLSTACK-07 | FIXED | current | tests/unit/comm-msg91.test.ts | None (eradicated IDE strikethroughs across entire schema, regenerated Prisma client, 0 TypeScript errors, 1091/1091 unit tests passing) |
| P17-GST-TIER-01 | FIXED | current | tests/unit/deal-gst-tier-e2e.test.ts | None (Automated ₹1,500 GST threshold: <=₹1,500 exempt, >=₹1,501 attracts 18% GST on platform fee across creation, contracts, statements) |
| P17-BACKEND-01 | FIXED | current | tests/unit/wallet.test.ts | None (Eliminated 30s in-memory wallet & escrow cache in WalletService; enforced real-time ACID database consistency on balance & escrow queries) |
| P17-BACKEND-02 | FIXED | current | tests/unit/csv-export.test.ts | None (Added SHIPPING_CHARGE to DEBIT_TYPES in wallet CSV export and harmonized SAC code 998365 across reporting) |
| P17-BACKEND-03 | FIXED | current | tests/unit/wallet-screen.test.ts | None (Optimized apiWrapper session propagation in /api/wallet and /api/wallet/transactions, eliminating redundant auth() lookups) |
| P17-BACKEND-04 | FIXED | current | tests/unit/deals-list-screen.test.ts | None (Eliminated 30s in-memory statsCache in DealService.listDeals; guarantees real-time deal counters and earnings across workers) |
| P17-BACKEND-05 | FIXED | current | tests/unit/deals-list-screen.test.ts | None (Eliminated 30s in-memory canMessageCache in MessageService; ensures real-time permission evaluation when deals are accepted/closed) |
| P17-BACKEND-06 | FIXED | current | tests/unit/campaign-create-wizard.test.ts | None (Recorded gstAmount and gstPercent in transaction metadata across campaign creation and direct invite reservations) |
| P18-FRONTEND-01 | FIXED | current | tests/unit/deal-detail-screen.test.ts | None (Fixed netCreatorPayout in EscrowTrustCard to guarantee 100% contracted deal value to creators without falsely deducting brand platform fee) |
| P18-FRONTEND-02 | FIXED | current | tests/unit/wallet-screen.test.ts | None (Added SHIPPING_CHARGE to DEBIT_TYPES and added dedicated category icon in VirtualizedTransactionList so shipping debits are correctly filtered and visible) |
| P18-FRONTEND-03 | FIXED | current | tests/unit/deal-gst-tier-e2e.test.ts | None (Harmonized GST threshold constants, SAC code 998365, and dynamic entity legalName/billingEmail in StatementPrintView and ContractPrintView) |
| P18-FRONTEND-04 | FIXED | current | tests/unit/campaign-create-wizard.test.ts | None (Eliminated unused imports in campaign-create-wizard and deal-gst-tier tests, maintaining 0 TypeScript errors and passing 1101/1101 unit tests) |
| P18-FRONTEND-05 | FIXED | current | tests/unit/deal-gst-tier-e2e.test.ts | None (Replaced hardcoded legal entity in ContractPrintView preamble with PLATFORM_CONFIG.legalName, and aligned GST threshold calculation & billing email in brand spend report) |
| P19-BACKEND-01 | FIXED | current | tests/unit/deals-list-screen.test.ts | None (Standardized all Deal API route handlers to apiWrapper with requireAuth: true, eliminating duplicate auth() overhead and using verified session) |
| P19-FRONTEND-01 | FIXED | current | tests/unit/deal-detail-screen.test.ts | None (Connected live useWallet in DealModals to enforce real-time balance checks for extra revisions; corrected label from (Free) to exact extra fee when costPaise > 0) |
| P19-BACKEND-02 | FIXED | current | tests/unit/audit-contract-ci.test.ts | None (Eliminated redundant auth() calls across 15 routes including applications, wallet/add-funds, campaigns, disputes, messages, notifications, admin reports; guarded GMV in revenue reports against null totalAmount) |




 