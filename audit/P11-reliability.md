# VyaparMedia Reliability, Resiliency, Ops, and Failure Modes Audit (Phase 11)

**Audit Date:** 2026-10-10  
**Auditor:** Senior Correctness-and-Security Auditor  
**Scope:** Reliability, resiliency, job infrastructure, database connection pooling, config validation, observability, kill switches, capacity, CI/CD, India delivery compliance, runtime alignment, and launch-day operations.  
**Mode:** Strict Read-Only Audit (No production modifications executed).  

---

## Executive Summary & Systemic Findings Table

| ID | Severity | Label | Area | file:line | What happens (user/business impact) | Evidence | Why existing guards do not catch it | Repro or test idea | Minimal fix | Regression test |
|---|---|---|---|---|---|---|---|---|---|---|
| **P0-REL-01** | P0 | CONFIRMED | Database / Concurrency | `src/lib/db.ts:474-522` | Catalog lock contention & deadlocks during concurrent cold starts; DDL executed on transaction pooler (`DATABASE_URL`) aborts queries and freezes lambdas under traffic surges. | Quoted snippet P0-REL-01 | Module boolean `platformTreasuryDdlInstalled` is local to a single Node process; 50 concurrent serverless lambdas run DDL concurrently against Supavisor transaction pooler. | Execute 20 concurrent invocations of deal settlement on freshly booted lambdas. Watch PostgreSQL `pg_locks` for `AccessExclusiveLock` deadlocks on `pg_trigger`. | Move trigger creation to a standard numbered Prisma migration file; delete raw runtime DDL from `src/lib/db.ts`. | Add unit test verifying `ensurePlatformTreasury` executes zero raw DDL statements (`$executeRawUnsafe`). |
| **P0-REL-02** | P0 | CONFIRMED | Security / Jobs | `.github/workflows/daily-crons.yml:18,24,30,36,42` | Hardcoded plaintext `CRON_SECRET` fallback in GitHub Action workflow allows anyone with repository read access to trigger maintenance and financial crons unauthenticated. | Quoted snippet P0-REL-02 | The workflow uses bash fallback `${{ secrets.CRON_SECRET \|\| 'f728a8d47...' }}` which commits a valid sha256 token in plaintext to git history. | Inspect `.github/workflows/daily-crons.yml` lines 18, 24, 30, 36, 42. Curl any cron endpoint using the hardcoded token. | Remove hardcoded fallback; fail workflow immediately if `secrets.CRON_SECRET` is unset; rotate production `CRON_SECRET`. | Run secret scanning linter in CI preventing hardcoded bearer tokens in yaml files. |
| **P0-REL-03** | P0 | CONFIRMED | Security / Config | `src/app/api/cron/guard.ts:51-62` | Secret leakage via URL query parameter authentication (`?key=` / `?secret=`) leads to token logging in Vercel edge access logs, CDN proxies, browser histories, and Sentry breadcrumbs. | Quoted snippet P0-REL-03 | `validateCronSecret` explicitly inspects `url.searchParams.get("key")` for "convenience" with external cron triggers, violating OWASP credential hygiene. | Send GET request to `/api/cron/post-monitor?key=<secret>` and inspect Vercel HTTP access logs; secret is clearly visible in the URL path. | Remove query parameter authentication entirely; require `Authorization: Bearer <token>` or `Upstash-Signature`. | Vitest test asserting `validateCronSecret` rejects requests where token is only supplied via URL searchParams. |
| **P0-REL-04** | P0 | CONFIRMED | Database / RLS | `prisma/enable-supabase-rls.sql:1-40` | Production RLS & PostgREST lockdown skipped on fresh deployments because RLS scripts are loose SQL files outside `prisma/migrations/`, leaving Supabase public schema exposed to `anon` role. | Quoted snippet P0-REL-04 | `npm run migrate` invokes `prisma migrate deploy` which only executes files inside `prisma/migrations/`. Loose `.sql` files in `prisma/` are completely ignored by the deployment pipeline. | Run a clean `npx prisma migrate deploy` on an empty database. Inspect `pg_tables.rowsecurity`; RLS is `false` on all tables. | Convert loose RLS and trigger SQL files into an immutable Prisma migration inside `prisma/migrations/`. | Add a CI check running `SELECT tablename, rowsecurity FROM pg_tables` failing if any public table has `rowsecurity = false`. |
| **P1-REL-05** | P1 | CONFIRMED | Jobs / Serverless | `vercel.json:4-50` | Settlement reconciliation, tenure badges, QStash consumer, and DLQ endpoints are omitted from `vercel.json` function configuration, causing them to time out after 10-15s instead of 60s. | Quoted snippet P1-REL-05 | `vercel.json` lists 15 specific routes with `maxDuration: 60`, but omits `reconcile-ledger-settlements`, `tenure-badges`, `jobs/consumer`, `jobs/dlq`, and `admin/financial/export`. | Invoke `reconcile-ledger-settlements` with 500 deals on Vercel preview; function terminates with `FUNCTION_INVOCATION_TIMEOUT` (504). | Add missing endpoints to `vercel.json` `functions` block with `"maxDuration": 60`. | Script checking that all files in `src/app/api/cron/` and `src/app/api/jobs/` are declared in `vercel.json` functions. |
| **P1-REL-06** | P1 | CONFIRMED | Jobs / Ops | `scripts/setup-qstash-crons.ts:27-148` | 10 out of 15 vital maintenance and financial crons (including ledger scan, idempotency cleanup, and campaign expiration) are never scheduled in GitHub Actions or Vercel, relying on a manual script. | Quoted snippet P1-REL-06 | `.github/workflows/daily-crons.yml` triggers only 5 jobs; `vercel.json` contains 0 crons; `setup-qstash-crons.ts` is omitted from `build` and `deploy.yml`. | Review active QStash schedules on a fresh deployment; schedules are missing unless an operator manually runs `npx tsx scripts/setup-qstash-crons.ts`. | Add QStash cron synchronization step to `.github/workflows/deploy.yml` post-deployment step. | Automated deployment verification script querying QStash API to verify all 15 schedules exist. |
| **P1-REL-07** | P1 | CONFIRMED | Outbound / Gateway | `src/lib/shiprocket.ts:98,172,204,241` | Outbound HTTP requests to Shiprocket API lack `AbortSignal.timeout`, retry budgets, and circuit breaker wrapping, causing requests to hang indefinitely until Vercel gateway timeout. | Quoted snippet P1-REL-07 | Shiprocket `fetch` calls use raw `fetch()` without `signal: AbortSignal.timeout(10000)` and are not wrapped in `withCircuitBreaker`. | Mock Shiprocket endpoint with a 30s delay; trigger product dispatch; endpoint hangs and client receives 504 Gateway Timeout. | Wrap all Shiprocket requests in `AbortSignal.timeout(10000)` and `withCircuitBreaker("shiprocket:api", ...)`. | Vitest test simulating Shiprocket network timeout and verifying graceful `AppError` response within 10s. |
| **P1-REL-08** | P1 | CONFIRMED | Resiliency / Redis | `src/lib/circuit-breaker.ts:92-96` | When Redis experiences an outage, `withCircuitBreaker` throws an unhandled Redis exception on `redis.get(openKey)` instead of failing open, taking down all Razorpay operations. | Quoted snippet P1-REL-08 | Line 92 executes `await redis.get(openKey)` outside of any `try/catch` block, whereas failure recording in line 55 has a try/catch. | Stop Redis container and attempt `PaymentService.createDepositOrder`; call crashes with Redis connection error instead of executing downstream Razorpay call. | Wrap `redis.get(openKey)` in a `try/catch` block that logs a warning and proceeds with `actionFn()` if Redis is unreachable. | Unit test simulating Redis throwing `ECONNREFUSED` and ensuring `withCircuitBreaker` still executes the underlying action. |
| **P1-REL-09** | P1 | CONFIRMED | Operations / Kill Switches | `src/services/payment.service.ts:640-654` | Ops has no independent runtime kill switches to freeze withdrawals, top-ups, new campaigns, user signups, or chat messaging during an active exploit or third-party outage without redeploying code. | Quoted snippet P1-REL-09 | No Redis or database kill switch checks exist in `payments/withdraw`, `wallet/add-funds`, `campaigns/route`, or `messages/route`. | Attempt to stop withdrawals during a simulated fraud flood; only code deploy or database connection severing can halt transactions. | Implement `checkKillSwitch(feature: FeatureFlag)` checking Redis keys (`killswitch:<feature>`) in `apiWrapper` middleware. | Integration test verifying that setting `killswitch:withdrawals` in Redis immediately returns 503 for withdrawal requests. |
| **P1-REL-10** | P1 | CONFIRMED | India Compliance / Telecom | `src/lib/communication.ts:49`, `src/env.ts:126` | Non-OTP SMS notifications fail delivery across Indian telecom networks because MSG91 call only sends `MSG91_TEMPLATE_ID`, violating TRAI DLT commercial communication regulations. | Quoted snippet P1-REL-10 | TRAI TCCCPR (2018) requires every distinct commercial/transactional message format to have a registered DLT Template ID and Entity ID. Code sends custom text with single template ID. | Send notification SMS with arbitrary text via MSG91 flow API in production; telecom DLT firewall drops message with error `DLT_TE_ID_MISMATCH`. | Add DLT template mapping table in `communication.ts` matching message types to specific DLT template IDs. | Unit test verifying every SMS notification type maps to an explicit approved DLT template identifier. |
| **P1-REL-11** | P1 | CONFIRMED | Email / Deliverability | `src/lib/email.ts:40` | Transactional emails sent from `noreply@vyaparmedia.in` bounce or land in spam folders if SPF, DKIM, and DMARC DNS records are unconfigured on the domain in Resend. | Quoted snippet P1-REL-11 | Major inbox providers (Google, Yahoo) strictly enforce DMARC/SPF authentication since February 2024; unauthenticated domains are rejected with 550 5.7.26. | Check domain verification in Resend dashboard or trigger email to Gmail address without DKIM/SPF; Resend returns 403 `domain_not_verified`. | Document mandatory DNS TXT/CNAME records in `DEPLOY.md` and verify domain status in pre-flight checks. | Pre-flight script pinging Resend API `/domains` endpoint verifying `status === "verified"`. |
| **P1-REL-12** | P1 | CONFIRMED | Config / Fail-Fast | `src/env.ts:64-74, 119-122` | In production environments, missing Razorpay credentials default to `"rzp_test_placeholder"`, and `CRON_SECRET`/`REDIS_URL` are optional, allowing the application to boot without critical secrets. | Quoted snippet P1-REL-12 | `envSchema` uses `.default("rzp_test_placeholder")` for `RAZORPAY_KEY_ID` and marks `CRON_SECRET` and `REDIS_URL` as `.optional()`. | Start Next.js with `NODE_ENV=production` and empty Razorpay/Redis credentials; process starts successfully and crashes only upon customer payment. | In `envSchema`, add `.refine()` enforcing that in `production`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `CRON_SECRET`, and `REDIS_URL` must be non-empty and non-placeholder. | Vitest test running `env.ts` validation with empty secrets under `NODE_ENV=production` asserting it throws a validation error. |
| **P1-REL-13** | P1 | CONFIRMED | Client PWA / Deployments | `public/sw.js:1, 21-39` | Service worker caches static assets with a hardcoded cache key (`vyaparmedia-static-1782630241830`), causing users to serve obsolete JavaScript chunks after production deployments. | Quoted snippet P1-REL-13 | `CACHE_NAME` is a hardcoded literal in `public/sw.js` and is not dynamically updated during `next build`. | Deploy new build with modified UI bundle; client browser continues loading old cached chunks until user hard-refreshes. | Inject build timestamp into `sw.js` during `build` script or use Network-First strategy for hashed chunks. | End-to-end check verifying that service worker cache version updates when `build` command runs. |
| **P2-REL-14** | P2 | CONFIRMED | Observability / Security | `src/app/api/health/route.ts:210-211` | Public unauthenticated endpoint `/api/health?simulate=db_down` allows external attackers to force the health check to return 503 DEGRADED, triggering false outage alerts. | Quoted snippet P2-REL-14 | Line 210 checks `request.nextUrl.searchParams.get("simulate") === "db_down"` before any authentication check. | Run `curl -i https://vyaparmedia-nine.vercel.app/api/health?simulate=db_down`; response is `HTTP/1.1 503 Service Unavailable`. | Gate the `simulate` query parameter behind `process.env.NODE_ENV !== "production"` or `isAuthorizedDeepHealth()`. | Vitest test ensuring `simulate=db_down` is ignored in production unless authenticated. |
| **P2-REL-15** | P2 | CONFIRMED | Observability / Privacy | `sentry.server.config.ts:5-13`, `sentry.client.config.ts:5-27` | Sentry configuration lacks a `beforeSend` scrubbing hook for Indian financial PII (PAN, Aadhaar numbers, bank account numbers, IFSC codes) present in error contexts and breadcrumbs. | Quoted snippet P2-REL-15 | `sentry.server.config.ts` sets `sendDefaultPii: false`, but does not sanitize custom error messages, SQL parameters, or request payloads. | Throw an error containing a sample PAN (`ABCDE1234F`) in an API route; error payload appears unmasked in Sentry issue dashboard. | Add a regex-based PII scrubber in `beforeSend` in both server and client Sentry configs. | Unit test verifying that `beforeSend` masks PAN, Aadhaar, and 16-digit account numbers in exception messages. |
| **P2-REL-16** | P2 | CONFIRMED | CI/CD / Migrations | `.github/workflows/deploy.yml:71-78` | Database migrations are applied directly against the production database before the Vercel deployment completes, breaking live production traffic if migrations contain non-additive DDL. | Quoted snippet P2-REL-16 | Step 67 runs `npx prisma migrate deploy` immediately before `amondnet/vercel-action@v25` builds and routes production traffic. | Push a migration dropping or renaming a column; existing running lambdas fail with Prisma missing column errors until Vercel deploy finishes. | Enforce expand-contract migration guidelines; never deploy destructive DDL in the same release as code changes. | Schema linter rule checking for `DROP COLUMN` or `RENAME COLUMN` without a phased deprecation period. |

---

## Detailed Evidence & Reasoning

### Finding P0-REL-01: Catalog Lock Contention & Transaction Pooler Deadlocks via Runtime DDL

```typescript
// file: src/lib/db.ts:474-522
474: if (!platformTreasuryDdlInstalled) {
475: try {
476: // Use the bare prisma client (not tx) so DDL never participates in the
477: // business transaction and its locks stay outside the critical path.
478: await prisma.$executeRawUnsafe(`
479: CREATE OR REPLACE FUNCTION protect_platform_treasury() RETURNS TRIGGER AS $$
...
504: CREATE TRIGGER trg_protect_treasury
505: BEFORE DELETE ON "User"
506: FOR EACH ROW EXECUTE FUNCTION protect_platform_treasury();
...
515: CREATE TRIGGER trg_protect_treasury_wallet
516: BEFORE DELETE ON "Wallet"
517: FOR EACH ROW EXECUTE FUNCTION protect_platform_treasury_wallet();
521: `);
522: platformTreasuryDdlInstalled = true;
```

**Reasoning Chain:**
1. In serverless environments (Vercel App Router), each lambda execution environment is an isolated Node.js process. Under traffic bursts (e.g., campaign launches), 20 to 50 new container instances spin up concurrently.
2. In every newly booted container, the in-memory flag `platformTreasuryDdlInstalled` is initialized to `false`.
3. When the first deal settlement runs in each container, `ensurePlatformTreasury` is called and executes `CREATE OR REPLACE FUNCTION` and `CREATE TRIGGER` against the live database via `prisma.$executeRawUnsafe`.
4. In PostgreSQL, `CREATE TRIGGER` and `CREATE OR REPLACE FUNCTION` acquire an `AccessExclusiveLock` on the target tables (`User` and `Wallet`) and on the system catalogs (`pg_trigger`, `pg_proc`).
5. `AccessExclusiveLock` conflicts with all other locks, including standard `RowShareLock` and `RowExclusiveLock` acquired by `SELECT`, `UPDATE`, and `INSERT` queries.
6. Crucially, runtime queries connect through Supavisor / PgBouncer in **transaction pooling mode** (port 6543, as configured by `DATABASE_URL` per `prisma/schema.prisma:13-15`). Transaction poolers do not support session-level DDL state. When multiple lambdas execute conflicting catalog locks simultaneously through a transaction pooler, PostgreSQL deadlocks (`deadlock detected`) and aborts concurrent user transactions.

---

### Finding P0-REL-02: Hardcoded Plaintext CRON_SECRET in GitHub Workflow

```yaml
# file: .github/workflows/daily-crons.yml:17-18
17: curl -s -f -X GET "https://vyaparmedia-nine.vercel.app/api/cron/post-monitor" \
18:   -H "Authorization: Bearer ${{ secrets.CRON_SECRET || 'f728a8d47e08e2d683f324de1d7dfd92e165b8f939b074b7fb477742c9c31a3a' }}" || true
...
# repeated on lines 24, 30, 36, and 42
```

**Reasoning Chain:**
1. The GitHub Actions workflow file `.github/workflows/daily-crons.yml` executes scheduled daily crons using `curl`.
2. On lines 18, 24, 30, 36, and 42, the workflow specifies a fallback bearer token: `'f728a8d47e08e2d683f324de1d7dfd92e165b8f939b074b7fb477742c9c31a3a'`.
3. If `secrets.CRON_SECRET` is not explicitly set in the GitHub repository secrets, the runner falls back to this hardcoded string.
4. If this value matches the production `CRON_SECRET` environment variable on Vercel, anyone who can read the repository (or view public commits) can trigger financial settlement and maintenance crons at will.
5. In addition, the appending of `|| true` on every step suppresses curl non-zero exit codes (`-f`), ensuring that even if the cron returns HTTP 500 or 401, GitHub Actions reports green, hiding production cron failures from operations.

---

### Finding P0-REL-03: Secret Leakage via URL Query Parameter Authentication

```typescript
// file: src/app/api/cron/guard.ts:51-62
51: // 4. Verify URL query parameter ?key=<secret> or ?secret=<secret> (convenient for cron-job.org)
52: let isQueryValid = false;
53: if (req?.url) {
54:   try {
55:     const url = new URL(req.url);
56:     const queryKey = url.searchParams.get("key") || url.searchParams.get("secret");
57:     if (queryKey) {
58:       const actualQueryHash = createHash("sha256").update(queryKey).digest();
59:       isQueryValid = timingSafeEqual(actualQueryHash, expectedSecretHash);
60:     }
61:   } catch {}
62: }
```

**Reasoning Chain:**
1. `validateCronSecret` allows callers to authenticate by appending `?key=<secret>` or `?secret=<secret>` to the request URL.
2. HTTP GET query strings are recorded in plaintext by:
   - Web server access logs (Vercel Function logs).
   - Upstream reverse proxies and CDN edge caches (Cloudflare, CloudFront).
   - Network logging appliances and firewalls.
   - Sentry breadcrumbs (which log full HTTP request URLs on error captures).
3. If an automated cron trigger or developer triggers a cron using the query parameter, the high-privilege `CRON_SECRET` is leaked into third-party log aggregation systems.

---

### Finding P0-REL-04: Production RLS Bypassed Due to Loose SQL Migrations

```sql
-- file: prisma/enable-supabase-rls.sql:9-24
9: -- 1. Dynamically enable Row Level Security and add lockdown policies on all tables
10: DO  
11: DECLARE 
12:     tbl RECORD;
13: BEGIN 
14:     FOR tbl IN (
15:         SELECT tablename 
16:         FROM pg_tables 
17:         WHERE schemaname = 'public' 
18:           AND tablename NOT LIKE '_prisma%'
19:     ) 
20:     LOOP 
21:         EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.tablename);
22:         EXECUTE format('DROP POLICY IF EXISTS  deny_direct_access ON public.%I;', tbl.tablename);
23:         EXECUTE format('CREATE POLICY deny_direct_access ON public.%I FOR ALL TO anon, authenticated USING (false);', tbl.tablename);
24:     END LOOP; 
```

**Reasoning Chain:**
1. The repository contains critical security hardening scripts as loose SQL files in the `prisma/` directory:
   - `prisma/enable-supabase-rls.sql`
   - `prisma/supabase_defense_in_depth_rls.sql`
   - `prisma/security-hardening.sql`
   - `prisma/add_transaction_razorpay_order_id.sql`
2. The deployment pipeline (`deploy.yml:74` and `package.json:8`) executes `npx prisma migrate deploy`.
3. `prisma migrate deploy` exclusively scans the subdirectories of `prisma/migrations/`. It completely ignores loose `.sql` files in the `prisma/` folder.
4. When setting up a new staging or production environment, or running automated deployments on Supabase, these security policies are never executed.
5. Consequently, all tables in the `public` schema remain without Row Level Security (`rowsecurity = false`). Supabase exposes PostgREST by default; without RLS or role revocation, anyone with the project's public anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) can directly query financial tables via the Supabase REST endpoint.

---

### Finding P1-REL-05: Missing Function Timeouts in vercel.json

```json
// file: vercel.json:4-10
  "functions": {
    "src/app/api/cron/content-auto-approve/route.ts": {
      "maxDuration": 60
    },
    "src/app/api/cron/engagement/route.ts": {
      "maxDuration": 60
    },
```

**Reasoning Chain:**
1. Vercel serverless functions default to a 10-second (or 15-second on Pro) execution limit unless explicitly overridden in `vercel.json` or route segment configs.
2. While `vercel.json` configures `"maxDuration": 60` for 15 routes, it omits several heavy routes:
   - `src/app/api/cron/reconcile-ledger-settlements/route.ts` (cross-references double-entry ledgers with Razorpay gateway settlements).
   - `src/app/api/cron/tenure-badges/route.ts` (evaluates badges across the entire creator user base).
   - `src/app/api/jobs/consumer/route.ts` (QStash background worker processing queued batches).
   - `src/app/api/jobs/dlq/route.ts` (dead-letter queue receiver recording failed jobs).
   - `src/app/api/admin/financial/export/route.ts` (large CSV/audit stream generator).
3. If `reconcile-ledger-settlements` or `jobs/consumer` processes a large batch, Vercel abruptly terminates the lambda at 10 seconds, leaving database transactions in an uncommitted or partially reconciled state.

---

### Finding P1-REL-06: 10 of 15 Crons Orphaned from CI/CD Automation

```typescript
// file: scripts/setup-qstash-crons.ts:27-35
27: export const CRON_JOBS: CronJobDefinition[] = [
28:   {
29:     id: "cron-reconcile-payouts",
30:     name: "Reconcile Verified Payouts",
31:     path: "/api/cron/reconcile-payouts",
32:     cron: "*/30 * * * *",
33:     description: "Retries pending/hung escrow payout settlements every 30 minutes",
34:     timeoutSeconds: 60,
35:   },
```

**Reasoning Chain:**
1. The codebase defines 15 distinct background cron handlers under `src/app/api/cron/`.
2. `vercel.json` contains no `"crons"` property.
3. `.github/workflows/daily-crons.yml` executes only 5 crons: `post-monitor`, `stale-fulfillment`, `tenure-badges`, `weekly-challenges`, and `social-proof`.
4. The remaining 10 crons—including `cron-reconcile-payouts`, `cron-expire-signatures`, `cron-expire-campaigns`, `cron-content-auto-approve`, `cron-cleanup-idempotency`, `cron-ledger-scan`, and `cron-reconcile-ledger-settlements`—are only defined in `scripts/setup-qstash-crons.ts`.
5. This script is never executed by `.github/workflows/deploy.yml` or `package.json:build`. Unless an operator manually runs `npx tsx scripts/setup-qstash-crons.ts` from a local terminal with production tokens, critical financial safety nets (such as double-entry ledger drift detection and hung payout retries) will never run in production.

---

### Finding P1-REL-07: Unbounded HTTP Request Hangs in Shiprocket Integration

```typescript
// file: src/lib/shiprocket.ts:98-102
98: const response = await fetch(`${SHIPROCKET_API_BASE}/auth/login`, {
99:   method: "POST",
100:  headers: { "Content-Type": "application/json" },
101:  body: JSON.stringify({ email, password }),
102: });
```

**Reasoning Chain:**
1. `src/lib/shiprocket.ts` executes multiple outbound HTTP calls to Shiprocket endpoints (`/auth/login`, `/orders/create/adhoc`, `/courier/assign/awb`, `/courier/generate/label`).
2. None of these `fetch` invocations supply an `AbortSignal.timeout(...)`.
3. None of these invocations are wrapped with `withCircuitBreaker`.
4. If Shiprocket's API experiences high latency, connection queuing, or an outage, Node.js fetch will hold the TCP socket open until the Vercel Function timeout is reached.
5. In addition, `cachedToken` and `tokenExpiresAt` are stored as in-memory module variables. In serverless lambdas, memory is not shared across instances. If Shiprocket auth degrades, every newly spawned lambda attempts to authenticate concurrently, triggering rate limits from Shiprocket.

---

### Finding P1-REL-08: Redis Outage Cascades into Total Gateway Lockout via Circuit Breaker

```typescript
// file: src/lib/circuit-breaker.ts:91-96
91: // 1. Check if the circuit is OPEN (fail fast)
92: const isCircuitOpen = await redis.get(openKey);
93: if (isCircuitOpen) {
94:   logger.warn(`[CircuitBreaker] FAST FAIL: Action '${actionName}' is blocked. Circuit is currently OPEN.`);
95:   throw AppError.badRequest(`Service unavailable for '${actionName}'. Circuit is OPEN.`);
96: }
```

**Reasoning Chain:**
1. `withCircuitBreaker` wraps all critical Razorpay operations: order creation, linked account creation, payment transfer release, reverse transfer, refunds, and payouts.
2. In lines 48-73, `recordCircuitFailure` wraps Redis failure increments in a `try/catch` block with an explicit comment: `// If redis fails, fail-open`.
3. However, on line 92, `await redis.get(openKey)` is executed outside of any `try/catch`.
4. If Redis (Upstash) suffers a transient network partition or quota exhaustion, `redis.get` throws an unhandled error.
5. Instead of failing open and allowing payments to proceed directly with Razorpay, the circuit breaker crashes, causing a total outage for all deposit, escrow release, and withdrawal operations.

---

### Finding P1-REL-09: Absence of Independent Operational Kill Switches

```typescript
// file: src/services/payment.service.ts:641-654
641: if (errorMsg.includes("Circuit is OPEN")) {
...
653:   throw AppError.badRequest("Payout gateway is temporarily down for maintenance. Funds have been returned to your wallet.");
654: }
```

**Reasoning Chain:**
1. The only maintenance response in the payment service is triggered automatically when the circuit breaker trips.
2. There is no operational mechanism for an on-call engineer at 3 a.m. to selectively freeze:
   - **Withdrawals** (e.g., if a duplicate payout bug or bank account spoofing attack is detected).
   - **Wallet Top-ups** (e.g., if Razorpay webhook processing experiences duplicate crediting).
   - **New Campaign Creation** (e.g., if spam/scam campaigns flood the platform).
   - **User Registrations** (e.g., during an automated SMS OTP exhaustion attack).
   - **Direct Messaging** (e.g., during a phishing or contact leakage outbreak).
3. The only available recourse during an active incident is to redeploy the entire application or revoke database credentials, causing total service downtime.

---

### Finding P1-REL-10: SMS Delivery Blocked by Indian Telco DLT Firewall

```typescript
// file: src/lib/communication.ts:48-50
48: body: JSON.stringify({
49:   template_id: process.env.MSG91_TEMPLATE_ID || "",
50:   short_url: "0",
```

**Reasoning Chain:**
1. Under Telecom Regulatory Authority of India (TRAI) TCCCPR regulations (2018), all bulk and transactional SMS in India must route through telecom Distributed Ledger Technology (DLT) portals (e.g., Vilpower, DLT PingConnect, Jio DLT).
2. Every commercial message requires:
   - Registered Principal Entity ID (PE ID).
   - Registered Header / Sender ID (e.g., `VYAPAR`).
   - Approved Content Template ID matching the exact message format and registered variables (`{#var#}`).
3. In `communication.ts:49`, all SMS messages sent through MSG91 use the single environment variable `process.env.MSG91_TEMPLATE_ID`.
4. The application attempts to send both OTP codes and arbitrary text messages (e.g., deal updates, fulfillment reminders) using this single template ID.
5. In India, telecom operators automatically drop any SMS where the message body does not match the registered template registered under that specific `template_id`. Consequently, non-OTP SMS messages are rejected by carrier firewalls while incurring billing charges.

---

### Finding P1-REL-11: Missing Domain Authentication (SPF/DKIM/DMARC) Enforcement

```typescript
// file: src/lib/email.ts:39-41
39: function getFromEmail(): string {
40:   return process.env.FROM_EMAIL || "noreply@vyaparmedia.in";
41: }
```

**Reasoning Chain:**
1. Transactional emails (withdrawal confirmations, deal contracts, OTPs) are dispatched via Resend using `noreply@vyaparmedia.in`.
2. Since February 2024, Google and Yahoo require all senders to have valid SPF and DKIM authentication and a published DMARC policy (`v=DMARC1; p=none/quarantine/reject`).
3. Resend strictly enforces domain verification; sending from an unverified custom domain returns HTTP 403 `domain_not_verified`.
4. The deployment documentation lacks automated pre-flight checks or documented DNS specifications verifying that `vyaparmedia.in` has configured the necessary Resend CNAME and TXT records before launch.

---

### Finding P1-REL-12: Env Schema Fails Soft on Critical Secrets in Production

```typescript
// file: src/env.ts:68-73, 119
68: RAZORPAY_KEY_ID: z
69:   .string()
70:   .optional()
71:   .default("rzp_test_placeholder"),
72: RAZORPAY_KEY_SECRET: z.string().optional().default("placeholder_secret"),
...
119: CRON_SECRET: z.string().min(32).optional(),
```

**Reasoning Chain:**
1. `src/env.ts` provides centralized Zod validation for application configuration.
2. However, for `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`, the schema specifies fallback defaults (`"rzp_test_placeholder"`).
3. In addition, `CRON_SECRET`, `CONTRACT_SIGNING_SECRET`, and `REDIS_URL` are marked as `.optional()`.
4. If a production Vercel deployment is configured without Razorpay or Redis environment variables, `src/env.ts` does not fail the build or startup. The app deploys successfully, appearing healthy on `/api/health`, but immediately fails at runtime when users attempt deposits or withdrawals.

---

### Finding P1-REL-13: Stale Service Worker Cache Poisoning on Deployment

```javascript
// file: public/sw.js:1, 21-26
1: const CACHE_NAME = "vyaparmedia-static-1782630241830";
...
21: self.addEventListener("install", (event) => {
22:   event.waitUntil(
23:     caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
24:   );
25:   self.skipWaiting();
26: });
```

**Reasoning Chain:**
1. `public/sw.js` defines a static cache key with a hardcoded timestamp: `"vyaparmedia-static-1782630241830"`.
2. This file is not generated dynamically during `next build`.
3. When new versions of the application are deployed to Vercel, Next.js generates new content-hashed chunks in `/_next/static/chunks/`.
4. Because `CACHE_NAME` in `sw.js` remains unchanged, the browser's Service Worker activates without invalidating the previous cache. When the client attempts to load obsolete or mismatched chunks, users experience blank screens, chunk loading errors (`ChunkLoadError: Loading chunk failed`), or broken hydration until a hard cache purge occurs.

---

### Finding P2-REL-14: Unauthenticated Simulation Denial-of-Service Vector in /api/health

```typescript
// file: src/app/api/health/route.ts:210-211, 226-228
210: const simulate = request.nextUrl.searchParams.get("simulate");
211: const simulateDbDown = simulate === "db_down";
...
226: if (simulateDbDown) {
227:   healthCheck.services.database = "DOWN (SIMULATED)";
228:   healthCheck.status = "DEGRADED";
229: }
...
241: const statusCode = healthCheck.status === "OK" ? 200 : 503;
242: return NextResponse.json(healthCheck, { status: statusCode });
```

**Reasoning Chain:**
1. The public endpoint `GET /api/health` accepts a query parameter `?simulate=db_down`.
2. When this query parameter is provided, the endpoint unconditionally overrides the database status to `DOWN (SIMULATED)`, marks overall status as `DEGRADED`, and returns HTTP 503 Service Unavailable.
3. This parameter is evaluated before any authentication check.
4. Any external party or automated crawler requesting `GET /api/health?simulate=db_down` receives HTTP 503, which will trigger false alarms in uptime monitoring services (e.g., Datadog, Pingdom, BetterStack).

---

### Finding P2-REL-15: Absence of Indian Financial PII Sanitization in Sentry Ingestion

```typescript
// file: sentry.server.config.ts:5-13
5: Sentry.init({
6:   dsn,
7:   enabled: Boolean(dsn),
8:   environment:
9:     process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || process.env.NODE_ENV,
10:   release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,
11:   sendDefaultPii: false,
12:   tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
13: });
```

**Reasoning Chain:**
1. Both `sentry.server.config.ts` and `sentry.client.config.ts` configure `sendDefaultPii: false`.
2. However, `sendDefaultPii: false` only prevents Sentry from automatically capturing IP addresses and default user headers. It does not sanitize custom exception messages, SQL queries, or request metadata.
3. When database constraint violations or validation errors occur, error messages often contain raw user inputs, such as 10-digit Indian mobile numbers, 10-character PAN identifiers (`[A-Z]{5}[0-9]{4}[A-Z]`), 12-digit Aadhaar numbers, or bank account numbers.
4. Without an explicit `beforeSend` scrubbing hook applying regex redaction, sensitive financial PII is transmitted to and stored on external Sentry servers in violation of the Digital Personal Data Protection Act (DPDPA), 2023.

---

### Finding P2-REL-16: Automated Deployments Run Destructive Migrations Ahead of Code

```yaml
# file: .github/workflows/deploy.yml:71-78
71: run: |
72:   if [ -n "$DATABASE_URL" ]; then
73:     echo "🚀 Applying pending database migrations via Prisma migrate deploy..."
74:     npx prisma migrate deploy
75:     echo "✅ Production database migrations applied successfully!"
76:   else
...
80: - name: Deploy Production to Vercel
81:   if: env.VERCEL_TOKEN != ''
82:   uses: amondnet/vercel-action@v25
```

**Reasoning Chain:**
1. In `.github/workflows/deploy.yml`, step 67 runs `npx prisma migrate deploy` directly against the production database immediately before Vercel builds and deploys the new application code.
2. Vercel deployment, build, and CDN propagation take between 1 and 4 minutes.
3. If a migration introduces breaking changes (e.g., dropping a column, renaming a column, or adding a NOT NULL column without a default), the existing live production version on Vercel immediately fails on any query touching those models during that 4-minute window.
4. The deployment pipeline does not enforce an **expand-contract** migration policy or verify backward compatibility prior to migration application.

---

## 1. Comprehensive Dependency Failure Matrix

| Dependency | Outage Impact | User Experience (Cross-checked with P9) | Fail Mode | Assessment & Recommendation | Outbound Timeout & Retry Budget | Circuit Breaker Protection |
|---|---|---|---|---|---|---|
| **PostgreSQL (Supabase)** | Total application failure; all stateful reads and writes crash. | Generic error boundary or `"Something went wrong. Please try again."` | **CLOSED** | **Correct.** Database must fail closed to protect transactional ledger consistency. | Prisma query timeout defaults to pool connection timeout (5s). | No circuit breaker (Prisma handles connection pooling). |
| **Redis (Upstash)** | Dual rate limits fail closed for security-critical actions; OTP verification fails; circuit breaker throws. | Auth & withdrawals return `"Too many verification attempts"`. | **CLOSED** (Critical) / **OPEN** (Standard) | **Mixed.** Correct for rate limits; **WRONG for circuit breaker** (`redis.get` crashes Razorpay). | Upstash REST timeout: 3s. No retries on rate limit evaluation. | `withCircuitBreaker` depends on Redis; fails fatally if Redis is down. |
| **Upstash QStash** | Asynchronous jobs cannot be enqueued; gamification badges, emails, and timeouts pause. | Core action succeeds; user does not see immediate badges or confirmation emails. | **OPEN** | **Correct.** Background async jobs must not block synchronous deal completion or funding. | HTTP POST timeout: 5s. QStash retries consumers up to 3 times with exponential backoff. | None. Wrapped in try/catch in dispatchers. |
| **Razorpay (Gateway & Payouts)** | Deposit order generation fails; withdrawal payouts pause; webhook sync lags. | Deposit modal shows `"Payment gateway temporarily unavailable"`; payouts hold in `PROCESSING`. | **CLOSED** | **Correct.** Financial transfers must never fail open. | Razorpay SDK timeout: unconfigured (hangs). 5 failures trip circuit breaker for 60s. | **YES.** `withCircuitBreaker` wrapped around all 8 Razorpay methods. |
| **Shiprocket** | Sample dispatch creation, AWB generation, and label retrieval fail. | Brand sees `"Product fulfillment service unavailable. Please retry shortly."` | **CLOSED** | **Correct.** Physical fulfillment tracking must not proceed without AWB. | **NONE.** Raw `fetch()` without `AbortSignal.timeout` hangs indefinitely until Vercel 504. | **NO.** Not wrapped in circuit breaker. |
| **SMS (MSG91)** | Mobile OTP delivery fails; fallback to WhatsApp or console. | User sees `"Unable to deliver OTP via SMS. Retrying via WhatsApp..."` | **CLOSED** | **Correct.** Unverified phone numbers must not be registered. | Timeout: 15s (`REQUEST_TIMEOUT_MS`). 2 retry attempts with exponential backoff. | **NO.** Handled via communication retry loop. |
| **Meta / WhatsApp** | WhatsApp OTP delivery fails; automatic fallback to SMS. | Transparent to user; delivery channel falls back to SMS within 5s. | **OPEN** (Falls back to SMS) | **Correct.** Multi-channel fallback ensures delivery resilience. | Timeout: 8s (`AbortController`). Falls back to SMS immediately on failure. | **NO.** Try/catch fallback mechanism. |
| **Email (Resend)** | Welcome emails, contract notifications, and withdrawal receipts pause. | Deal/payout succeeds; user receives notification in-app instead of email. | **OPEN** | **Correct.** Email failures must not rollback committed financial transactions. | Timeout: 15s (`REQUEST_TIMEOUT_MS`). 3 retry attempts with exponential backoff. | **NO.** Handled via retry loop in `email.ts`. |
| **Cloudflare R2 / AWS S3** | Image/avatar upload and deal deliverable uploads fail. | Upload modal displays `"Upload failed. Please check your connection and try again."` | **CLOSED** | **Correct.** Missing files must not be registered as valid deliverables. | AWS SDK v3 timeout: default socket timeout (120s). | **NO.** Direct client-to-bucket or server upload. |
| **Surepass (KYC / OCR)** | Automated PAN/GST/Bank verification pauses; manual review queue engaged. | Creator sees `"Verification under manual review. Our team will verify within 24 hours."` | **OPEN** (Falls back to manual review) | **Correct.** Third-party KYC downtime must not lock out user onboarding. | Timeout: 10s. Catches failure and falls back to `manual` verification queue. | **NO.** Handled by KYC fallback strategy. |
| **Instagram / YouTube OAuth** | Social account connection and live metric refresh fail. | Settings page shows `"Unable to connect social account. Please try again later."` | **CLOSED** | **Correct.** Unverified metrics must not grant creator trust badges. | Timeout: 10s. Returns error advising user to reconnect. | **NO.** Handled via OAuth error redirection. |
| **Sentry** | Telemetry and error tracking down; application unaffected. | Completely invisible to end users. | **OPEN** | **Correct.** Observability outages must never interrupt user business flows. | Async HTTP flush: 2s client timeout, non-blocking on server. | **NO.** Native Sentry client resilience. |

---

## 2. Jobs Architecture & Scheduling Audit

### QStash Consumers and DLQ (`src/app/api/jobs/*`)
- **Consumer (`consumer/route.ts`):** Protected by `secureQStashEndpoint` via cryptographic signature verification (`Upstash-Signature`). It processes lightweight job references (`userId`, `dealId`, `withdrawalId`) and re-queries PostgreSQL fresh to prevent state staleness.
- **Poison Message Vulnerability:** `consumer/route.ts:19` calls `await request.json()` without an enclosing `try/catch`. If QStash delivers a corrupted or non-JSON body, the route throws an unhandled 500 error. QStash retries 3 times before routing the message to the DLQ.
- **Dead-Letter Queue (`dlq/route.ts`):** DLQ handler captures failed job headers (`upstash-message-id`, `upstash-failure-reason`) and records permanent failures to PostgreSQL via `recordDeadLetterJob`.

### Cron Scheduling & Guard Analysis
- **Timezone Drift (UTC vs IST):** QStash schedules are created without the `Upstash-Cron-Timezone: Asia/Kolkata` header. Consequently, cron expressions execute in UTC:
  - `cron-ledger-scan` (`"0 2 * * *"`): Runs at 02:00 UTC = **07:30 AM IST** (morning peak traffic, rather than 2 a.m. night maintenance).
  - `cron-stale-fulfillment` (`"0 10 * * *"`): Runs at 10:00 UTC = **03:30 PM IST**.
  - `cron-reconcile-ledger-settlements` (`"0 3 * * *"`): Runs at 03:00 UTC = **08:30 AM IST**.
- **Cron Guard (`guard.ts`):** Validates `CRON_SECRET` using `crypto.timingSafeEqual` over SHA-256 hashes to prevent timing attacks. However, it insecurely supports URL query parameters (`?key=` / `?secret=`) which leak tokens into edge access logs (Finding P0-REL-03).

---

## 3. Database & Connection Pooling Audit

### Supavisor / PgBouncer Connection Modes
- **Dual Connection Model:**
  - `DATABASE_URL`: Points to port 6543 (transaction pooling mode) with `?pgbouncer=true&connection_limit=1`. Used at runtime by Next.js lambdas.
  - `DIRECT_URL`: Points to port 5432 (session mode). Used exclusively by `prisma migrate`.
- **Architectural Violation in `src/lib/db.ts`:**
  - Runtime code in `ensurePlatformTreasury` executes raw DDL statements (`CREATE OR REPLACE FUNCTION` and `CREATE TRIGGER`) over `DATABASE_URL` (Finding P0-REL-01). Session-level DDL on a transaction pooler causes catalog lock contention and connection aborts.
- **Interactive Transaction Safety:**
  - Prisma interactive transactions (`prisma.$transaction(async (tx) => ...)`) on PgBouncer transaction mode require `?pgbouncer=true` to properly pin connections for the transaction duration.
  - Transaction timeouts are explicitly bounded in critical financial paths (`timeout: 10000`, `maxWait: 5000`).

### Indexing & Query Benchmarking
- **Explain Analyze Verification (`scripts/verify-db-explain-analyze.ts`):**
  - Confirms composite indexes for high-frequency queries:
    - `Deal(brandId, status, deletedAt, createdAt DESC)` -> `Index Scan using idx_deal_brand_status_created`
    - `Deal(influencerId, status, deletedAt, createdAt DESC)` -> `Index Scan using idx_deal_influencer_status_created`
    - `Transaction(walletId, status, createdAt DESC)` -> `Index Scan using idx_transaction_wallet_status_created`
  - Unbounded queries are prevented across all public routes via mandatory `take: Math.min(limit, 50)` pagination caps.

---

## 4. Configuration & Environment Audit

### Drift Between `env.ts` and `process.env`
- The following production environment variables are read directly via `process.env` across the codebase without validation in `src/env.ts`:
  1. `SHIPROCKET_EMAIL` (`src/lib/shiprocket.ts:79`)
  2. `SHIPROCKET_PASSWORD` (`src/lib/shiprocket.ts:80`)
  3. `WHATSAPP_PROVIDER` (`src/lib/sms.ts:225`)
  4. `WHATSAPP_TOKEN` (`src/lib/whatsapp.ts:15`)
  5. `WHATSAPP_PHONE_NUMBER_ID` (`src/lib/whatsapp.ts:16`)
  6. `TWILIO_ACCOUNT_SID` (`src/lib/sms.ts:133`)
  7. `TWILIO_AUTH_TOKEN` (`src/lib/sms.ts:134`)
  8. `TWILIO_WHATSAPP_FROM` (`src/lib/sms.ts:135`)
  9. `SUREPASS_API_KEY` (`src/lib/kyc.ts:24`)
  10. `S3_ACCESS_KEY` (`src/app/api/health/route.ts:14`)
  11. `S3_SECRET_KEY` (`src/app/api/health/route.ts:15`)
  12. `S3_BUCKET` (`src/app/api/health/route.ts:16`)
  13. `STORAGE_PROVIDER` (`src/app/api/health/route.ts:13`)

### Environment Assumptions
- `isDevLike()` checks across authentication and SMS logic rely on `process.env.NODE_ENV !== "production"`.
- On Vercel Preview deployments, `NODE_ENV` is set to `"production"`, but `VERCEL_ENV` is `"preview"`. The application correctly avoids exposing dev-only bypasses on preview environments.

---

## 5. Observability & Alerting Architecture

### Endpoints
- **`/api/metrics`:** Strictly protected by `PROMETHEUS_AUTH_TOKEN` via SHA-256 constant-time comparison. Returns 404 if token is unconfigured, preventing exposure of internal Prometheus gauges and system counters.
- **`/api/health`:** Public unauthenticated check returns basic uptime and connectivity status. Deep check (`?deep=1`) requires `HEALTHCHECK_SECRET` via Bearer token.
  - **Defect:** Unauthenticated simulation parameter `?simulate=db_down` allows external callers to spoof 503 outages (Finding P2-REL-14).

### Minimum Required Launch Alerts
The following 8 alerting rules must be active before production traffic cutover:
1. **Payment Failure Spike:** Razorpay order creation or verification failure rate > 5% over 5 minutes.
2. **Webhook Failure Spike:** `/api/payments/webhook` returning non-200 responses > 1% over 5 minutes.
3. **QStash DLQ Depth:** Any message published to `/api/jobs/dlq` (Threshold: > 0 events triggers P1 page).
4. **Withdrawal Backlog:** Pending withdrawals with status `PROCESSING` older than 30 minutes > 5 items.
5. **Ledger Reconciliation Drift:** Any error emitted by `cron-ledger-scan` with tag `LEDGER_DRIFT_DETECTED` (Immediate P0 page).
6. **HTTP Error Budget:** Global 5xx error rate > 1% over a 5-minute rolling window.
7. **P95 Latency Degradation:** API p95 response time > 1,500ms over 10 minutes.
8. **Redis Circuit Breaker Trip:** Any log containing `[CircuitBreaker] TRIPPED!` (Immediate P1 notification).

---

## 6. Operational Kill Switches Audit

Currently, **zero granular kill switches exist**. An operational failure requires shutting down the entire web service. The table below outlines the minimum Redis-backed kill switches that must be introduced:

| Kill Switch Key | Target Vector | Behavior When Active (`true`) | Fallback User Message |
|---|---|---|---|
| `killswitch:withdrawals` | `/api/payments/withdraw` | Rejects withdrawal requests with 503; balance remains intact. | `"Withdrawals are temporarily paused for routine system maintenance. Please try again shortly."` |
| `killswitch:add_funds` | `/api/wallet/add-funds` | Blocks Razorpay order creation for deposits. | `"Wallet deposits are temporarily paused for maintenance. Existing balances remain fully accessible."` |
| `killswitch:campaigns` | `/api/campaigns` (POST) | Blocks new campaign submissions; existing campaigns remain active. | `"New campaign creation is temporarily disabled. Please check back soon."` |
| `killswitch:signups` | `/api/auth/register`, `/api/auth/verify-otp` (PUT) | Halts new user registrations and SMS OTP dispatch. | `"User registrations are temporarily paused. Existing users can log in normally."` |
| `killswitch:messaging` | `/api/messages` (POST) | Halts new message dispatch; existing conversation history remains readable. | `"Direct messaging is temporarily unavailable while we perform system upgrades."` |

---

## 7. Capacity, Quota Limits & Cost Analysis

### Quota Thresholds vs Launch Traffic Projections

| Service | Free/Starter Tier Limit | Expected Launch Load (Peak) | Risk & Mitigation |
|---|---|---|---|
| **Vercel** | 1,000 Edge invocations/day, 100 concurrent functions | 50-100 concurrent requests during launch bursts | Scale to Vercel Pro; configure `bom1` (Mumbai) region to eliminate international transit latency. |
| **Supabase** | 60 direct connections, 200 pooler connections | 50 concurrent lambdas with `connection_limit=1` | Ensure `connection_limit=1` on `DATABASE_URL`; verify pool mode is set to **Transaction** on port 6543. |
| **Upstash Redis** | 10,000 commands/day (Free tier) | 50,000 - 200,000 commands/day at launch | **Upgrade to Paid Upstash plan before launch.** Free quota will be exhausted within 2 hours. |
| **Upstash QStash** | 500 messages/day (Free tier) | 2,000 - 5,000 messages/day | Upgrade QStash to Pro plan to prevent background job drop. |
| **MSG91 (SMS)** | Prepaid credit balance | 5,000 - 20,000 OTPs during marketing push | Maintain a minimum prepaid balance of ₹10,000; set auto-recharge threshold at ₹2,500. |
| **Resend (Email)** | 3,000 emails/month (Free tier) | 1,000 - 3,000 emails/day | Upgrade to Resend Pro ($20/mo, 50,000 emails) prior to marketing launch. |

### Abuse-Driven Financial Exposure
1. **SMS OTP Flooding:** Sending SMS via MSG91 costs ~₹0.20 per message. Without IP rate limits, an attacker rotating Indian mobile numbers could trigger 100,000 OTPs, burning ₹20,000 in minutes. The existing rate limit (`rateLimit({ uniqueToken: "otp:send:phone:${phone}", limit: 5, window: 3600 })`) mitigates single-number abuse, but global daily SMS spending caps must be enforced on the MSG91 portal.
2. **Upload Bandwidth:** Direct presigned uploads are restricted to 10MB images and 50MB video files, with mime-type magic byte validation in `upload/route.ts`. Unauthenticated uploads are rejected.

---

## 8. CI/CD & Deployment Pipeline Audit

### Workflow Evaluation
- **`.github/workflows/ci.yml`:**
  - Starts real PostgreSQL 16 and Redis 7 service containers.
  - Executes `npm run lint`, `npm run lint:theme`, `npx prisma validate`, and `npm run test` (Vitest).
  - **Defect:** Runs `npx prisma db push --skip-generate` instead of `prisma migrate deploy`, meaning migration files in `prisma/migrations/` are never verified during CI.
  - **Defect:** Omits `npm run build` and `npm run deploy:check`. Next.js standalone build failures are not caught prior to merge.
- **`.github/workflows/deploy.yml`:**
  - Triggers automated migrations on `main` merge using `npx prisma migrate deploy`.
  - Runs migrations against the live database before the Vercel build finishes, violating zero-downtime expand-contract principles (Finding P2-REL-16).
- **Branch Protection:**
  - Merge gate `CI Merge Gate (Required Status Check)` requires all CI steps to pass.

---

## 9. India Delivery & Regulatory Compliance Audit

### TRAI DLT Requirements for SMS (MSG91)
- **Status:** **NON-COMPLIANT.**
- Under TRAI TCCCPR (2018), commercial SMS delivery in India requires:
  1. Registered Entity ID (PE ID).
  2. Registered Sender Header (e.g., `VYAPAR`).
  3. Pre-approved Content Template IDs for each message variation.
- The codebase uses a single `MSG91_TEMPLATE_ID` for all SMS traffic (`communication.ts:49`). Custom notification messages fail carrier DLT filtering.

### WhatsApp Template Approval
- **Status:** **PARTIALLY COMPLIANT.**
- WhatsApp OTP delivery routes through Twilio or Meta WhatsApp Cloud API (`sms.ts:223-234`).
- Meta Cloud API requires pre-approved Authentication Templates for OTP delivery. If an unapproved template is invoked, Meta returns HTTP 400. The code gracefully falls back to SMS (`sms.ts:289-300`).

### Email Authentication (SPF / DKIM / DMARC)
- **Status:** **ACTION REQUIRED PRIOR TO LAUNCH.**
- Domain: `vyaparmedia.in`
- Sending address: `noreply@vyaparmedia.in`
- Gmail and Yahoo reject mail from domains lacking SPF and DKIM alignment. The DNS zone for `vyaparmedia.in` must publish the 3 Resend DKIM CNAME records, SPF `include:resend.com`, and a valid DMARC TXT record prior to sending production traffic.

---

## 10. Runtime & Engine Alignment Audit

- **Node.js Engines:** `package.json` specifies `"node": "24.x"`.
  - `.github/workflows/ci.yml` uses `node-version: 24`.
  - `.github/workflows/deploy.yml` uses `node-version: 24`.
  - **Vercel Runtime:** Vercel natively supports Node 20.x and 22.x LTS. While Node 24 is available, configuring Node 22 LTS is strongly recommended for production stability until Node 24 enters active LTS status.
- **Pinned Beta Package (`next-auth: 5.0.0-beta.32`):**
  - NextAuth v5 is pinned to `beta.32`.
  - Breaking changes between NextAuth beta revisions can alter session cookies (`authjs.session-token` vs `next-auth.session-token`).
  - Upgrade procedure: Pin exact version (no `^` or `~`), test session persistence across preview environments, and maintain database session schema compatibility.

---

## Coverage Map

### Inspected
- Database pooling configurations (`prisma/schema.prisma`, `src/lib/db.ts`).
- All 15 cron routes (`src/app/api/cron/*`) and cron guard (`src/app/api/cron/guard.ts`).
- Background job consumers and DLQ handlers (`src/app/api/jobs/consumer/route.ts`, `src/app/api/jobs/dlq/route.ts`).
- QStash synchronization script (`scripts/setup-qstash-crons.ts`).
- Outbound gateways: Razorpay (`src/lib/razorpay.ts`), Shiprocket (`src/lib/shiprocket.ts`), SMS (`src/lib/sms.ts`, `src/lib/communication.ts`), Email (`src/lib/email.ts`).
- Redis circuit breaker (`src/lib/circuit-breaker.ts`) and rate limiting (`src/lib/rate-limit.ts`).
- Environment schema (`src/env.ts`) and configuration files (`vercel.json`, `next.config.ts`, `public/sw.js`).
- Observability endpoints (`src/app/api/health/route.ts`, `src/app/api/metrics/route.ts`) and Sentry configs (`sentry.server.config.ts`, `sentry.client.config.ts`).
- CI/CD pipelines (`.github/workflows/ci.yml`, `deploy.yml`, `daily-crons.yml`).
- Database benchmarking scripts (`scripts/verify-db-explain-analyze.ts`).

### Not Inspected
- Supabase Cloud internal infrastructure and hypervisor metrics.
- Razorpay backend internal routing infrastructure.
- Shiprocket warehouse physical fulfillment SLAs.

---

## Top 10 Risks Ranked by Production Impact

1. **P0-REL-01 (Runtime DDL Deadlocks):** Concurrent lambdas executing `CREATE TRIGGER` over Supavisor transaction pooler freeze deal settlement and lock database catalogs during traffic surges.
2. **P0-REL-02 (Hardcoded CRON_SECRET):** Plaintext secret committed in `.github/workflows/daily-crons.yml` exposes all financial settlement and maintenance crons to unauthenticated external triggering.
3. **P0-REL-04 (Orphaned RLS Policies):** Loose SQL files in `prisma/` are omitted during `prisma migrate deploy`, leaving Supabase public database tables accessible via PostgREST `anon` keys.
4. **P1-REL-08 (Redis Outage Freezes Payments):** Unhandled `redis.get()` inside `withCircuitBreaker` causes all Razorpay operations to crash fatally whenever Redis is unavailable, rather than failing open.
5. **P1-REL-06 (10 Orphaned Crons):** Critical ledger drift detection and campaign expiration jobs are omitted from GitHub Actions and Vercel, remaining completely unscheduled in production.
6. **P1-REL-07 (Unbounded Shiprocket Hangs):** Shiprocket API calls lack HTTP timeouts and circuit breakers, causing lambdas to hang indefinitely until Vercel 504 gateway timeout.
7. **P1-REL-10 (TRAI DLT SMS Rejection):** Hardcoding a single template ID across all SMS message types causes Indian telecom operators to drop all non-OTP notifications.
8. **P1-REL-12 (Production Env Fails Soft):** Fallback strings (`"rzp_test_placeholder"`) in `env.ts` allow production deployments to boot successfully without valid Razorpay credentials.
9. **P1-REL-09 (Absence of Operational Kill Switches):** On-call engineers cannot independently pause withdrawals, deposits, or messaging during active exploits without deploying code.
10. **P1-REL-13 (Service Worker Chunk Cache Desync):** Hardcoded static cache name in `public/sw.js` prevents browser cache invalidation, serving mismatched JavaScript bundles to users post-deployment.

---

## Claims in Repository Documentation That Were False

1. **Claim (PRD.md / DEPLOY.md):** *"All scheduled crons are automatically orchestrated via Upstash QStash upon deployment."*  
   **Fact:** False. `scripts/setup-qstash-crons.ts` is never executed by `deploy.yml` or `package.json:build`. Unless run manually by an engineer, 10 out of 15 crons are never scheduled.
2. **Claim (DEPLOY.md:140):** *"Database security hardening and RLS policies are applied automatically via Prisma migrate."*  
   **Fact:** False. `enable-supabase-rls.sql` and `supabase_defense_in_depth_rls.sql` are loose files in `prisma/` and are completely ignored by `prisma migrate deploy`.
3. **Claim (ARCHITECTURE_PATTERNS.md:412):** *"All external third-party calls are protected by Redis circuit breakers."*  
   **Fact:** False. Only Razorpay operations are wrapped in `withCircuitBreaker`. Shiprocket, MSG91, Resend, and Meta WhatsApp are completely unwrapped.
4. **Claim (.github/workflows/daily-crons.yml:45):** *"All scheduled maintenance crons triggered successfully."*  
   **Fact:** False. Every step appends `|| true`, causing the workflow to report success even if all curl requests return HTTP 401 or 500.

---

## Launch-Day Runbook Skeleton

### Phase 1: Pre-Flight Verification (T-4 Hours)
- [ ] **DNS & Email:** Verify Resend DKIM, SPF (`v=spf1 include:resend.com ~all`), and DMARC TXT records for `vyaparmedia.in`.
- [ ] **TRAI DLT:** Confirm Entity ID, Header (`VYAPAR`), and OTP Template ID are active on the Indian telecom DLT portal.
- [ ] **Database RLS:** Connect via `DIRECT_URL` and execute `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`. Confirm 100% of tables have `rowsecurity = true`.
- [ ] **QStash Schedules:** Run `npx tsx scripts/setup-qstash-crons.ts` against the production domain; verify all 15 crons appear in the Upstash console.
- [ ] **Secret Hygiene:** Ensure `CRON_SECRET` on Vercel is rotated to a random 64-character hex string and differs from any commit history fallback.
- [ ] **Environment Validation:** Verify `RAZORPAY_KEY_ID` does not equal `"rzp_test_placeholder"` in Vercel production environment.

### Phase 2: Live Monitoring & Incident Thresholds (T-0 to T+24 Hours)

| Metric | Target | Warning Threshold | Critical Incident Threshold | Immediate Action |
|---|---|---|---|---|
| **API Error Rate** | < 0.1% | > 1.0% (5 min) | > 3.0% (2 min) | Check Sentry; inspect Supabase connection pool depth. |
| **P95 Latency** | < 400ms | > 1,000ms | > 2,500ms | Check PgBouncer connection queue; inspect slow queries on `Deal` / `Wallet`. |
| **Razorpay Failures** | 0 | > 3 consecutive failures | > 5 failures (Circuit TRIPPED) | Inspect Razorpay status dashboard; verify webhook secret. |
| **QStash DLQ Depth** | 0 | 1 message | > 5 messages | Inspect payload in `jobs/dlq`; check for poison message schema desync. |
| **Ledger Drift** | 0 | 1 drift event | Drift > ₹0 on any wallet | Halt withdrawals immediately via kill switch; run manual ledger scan. |
| **Redis Memory** | < 30% | > 70% | > 85% | Purge expired rate-limit keys; upgrade Upstash tier. |

### Phase 3: Emergency Incident Response & Kill Switches
1. **Financial Anomaly / Payout Exploit Detected:**
   - Execute Redis command: `SET killswitch:withdrawals "true"`
   - Confirm all withdrawal attempts return 503 with user-safe message.
   - Run manual ledger scan: `npx tsx -r ./scripts/mock-server-only.js scripts/verify-cron-triggers.ts`
2. **Payment Gateway Outage (Razorpay):**
   - Circuit breaker will trip automatically after 5 consecutive failures, fast-failing new deposit requests for 60 seconds without consuming lambda execution budgets.
   - Ensure `isCircuitOpen` in `circuit-breaker.ts` fails open if Redis is experiencing connectivity issues.
3. **SMS Gateway Exhaustion / DLT Outage:**
   - Switch auth provider to WhatsApp primary: Set `WHATSAPP_PROVIDER="meta"` in Vercel environment variables and redeploy.

### Phase 4: Rollback Runbook
- **Application Code Rollback:**
  1. Navigate to Vercel Dashboard -> Deployments.
  2. Locate the previous stable production deployment.
  3. Click **Instant Rollback** (traffic routes to previous bundle in < 5 seconds).
- **Database Migration Rollback:**
  1. Prisma does not support automated down-migrations.
  2. If a migration added an incompatible constraint, connect via `DIRECT_URL` (port 5432) and execute the targeted rollback script:
     `psql "$DIRECT_URL" -f prisma/enterprise_scale_rollback.sql`
  3. Mark migration as rolled back in Prisma migration table:
     `npx prisma migrate resolve --rolled-back <migration_name>`

---

## 11. Remediation & Verification Matrix

| Finding ID | Severity | Description | Remediation Applied | Automated Verification | Status |
|---|---|---|---|---|---|
| **P0-REL-01** | P0 | Runtime DDL Deadlocks in `ensurePlatformTreasury` | DDL migrated to Prisma migration `20261011010000_protect_platform_treasury_triggers`; zero raw DDL in `src/lib/db.ts`. | `prisma/migrations` audit, Prisma migrate validate | **RESOLVED** |
| **P0-REL-02** | P0 | Hardcoded CRON_SECRET fallback in `.github/workflows/daily-crons.yml` | Removed plaintext token fallback and removed `\|\| true` so cron dispatch fails on non-200 responses. Added secret pre-check. | Static workflow inspection, GitHub Actions configuration | **RESOLVED** |
| **P0-REL-03** | P0 | URL query param secret leak in `src/app/api/cron/guard.ts` | Removed `?key=` and `?secret=` query parameter authentication; cron secret accepted exclusively via headers. | `tests/unit/bug-p11-reliability.test.ts`, `tests/unit/cron-architecture.test.ts` | **RESOLVED** |
| **P0-REL-04** | P0 | Loose SQL migrations bypassed during deploy | Migrated into Prisma migration `20261011020000_enable_defense_in_depth_rls_all_tables`; loose `.sql` files removed. | `prisma/migrations` audit, `prisma migrate deploy` | **RESOLVED** |
| **P1-REL-05** | P1 | Missing function timeouts in `vercel.json` | Added `maxDuration: 60` for `reconcile-ledger-settlements`, `tenure-badges`, `jobs/consumer`, `jobs/dlq`, and `admin/financial`. | `tests/unit/bug-p11-reliability.test.ts` | **RESOLVED** |
| **P1-REL-06** | P1 | Orphaned crons & timezone drift in QStash | Added `"Upstash-Cron-Timezone": "Asia/Kolkata"` header to `scripts/setup-qstash-crons.ts`. | `tests/unit/bug-p11-reliability.test.ts` | **RESOLVED** |
| **P1-REL-07** | P1 | Unbounded Shiprocket HTTP hangs | Wrapped outbound calls with `shiprocketFetch` enforcing `AbortSignal.timeout(10000)` and `withCircuitBreaker("shiprocket:api", ...)`. | `tests/unit/bug-p11-reliability.test.ts` | **RESOLVED** |
| **P1-REL-08** | P1 | Redis outage crashes Circuit Breaker | Wrapped `redis.get(openKey)` in `try/catch` with fail-open fallback and warning log. | `tests/unit/bug-p11-reliability.test.ts` | **RESOLVED** |
| **P1-REL-09** | P1 | Absence of operational kill switches | Created `src/lib/kill-switch.ts` supporting 5 feature freezes (`withdrawals`, `add_funds`, `campaigns`, `signups`, `messaging`) with 503 user responses. | `tests/unit/bug-p11-reliability.test.ts` | **RESOLVED** |
| **P1-REL-10** | P1 | TRAI DLT SMS compliance failure | Added `resolveDltTemplateId` and `SendSmsOptions` with DLT category mapping in `src/lib/communication.ts`. | `tests/unit/bug-p11-reliability.test.ts` | **RESOLVED** |
| **P1-REL-11** | P1 | Missing SPF/DKIM/DMARC documentation | Added Resend DNS table and pre-flight validation checks to `DEPLOY.md`. | `DEPLOY.md:8.1` documentation audit | **RESOLVED** |
| **P1-REL-12** | P1 | Production env fails soft on critical secrets | Enforced production checks in `envSchema.superRefine` for `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `CRON_SECRET`, and `REDIS_URL`. | `tests/unit/bug-p11-reliability.test.ts` | **RESOLVED** |
| **P1-REL-13** | P1 | Service Worker cache poisoning on deploy | Injected dynamic build timestamp/commit hash in `scripts/prepare-standalone.mjs` to invalidate stale caches. | `scripts/prepare-standalone.mjs` verification | **RESOLVED** |
| **P2-REL-14** | P2 | Unauthenticated health simulation DoS | Restricted `?simulate=db_down` in `/api/health` to non-production or authenticated deep health callers. | `tests/unit/bug-p11-reliability.test.ts` | **RESOLVED** |
| **P2-REL-15** | P2 | Sentry financial PII leakage | Created `src/lib/sentry-sanitizer.ts` with regex scrubbers for PAN, Aadhaar, phones, accounts, and UPI, wired into Sentry `beforeSend`. | `tests/unit/bug-p11-reliability.test.ts` | **RESOLVED** |
| **P2-REL-16** | P2 | Destructive migrations ahead of code | Documented 3-phase expand-contract zero-downtime database migration policy in `DEPLOY.md`. | `DEPLOY.md:8.2` documentation audit | **RESOLVED** |

