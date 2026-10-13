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


