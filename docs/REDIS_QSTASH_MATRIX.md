# Redis & QStash Infrastructure Matrix & Operational Runbook

**Service Scope:** VyaparMedia Production Infrastructure  
**Core Technologies:** Next.js 16 (Turbopack), Upstash Redis (ioredis TCP + REST Edge), Upstash QStash, PostgreSQL (Prisma)  
**Security Reference:** P11 REL-05, P11 REL-06, P6-MONEY-08, SEC-13, TP-05  

---

## 1. Redis Fail-Open vs. Fail-Closed Classification Matrix

Every usage of Redis across VyaparMedia is explicitly categorized below to define deterministic behavior during an Upstash or network outage.

| Subsystem / Feature | Redis Key Pattern | Redis Client | Behavior on Redis Outage | Rationale & Fallback Mechanism |
|---|---|---|---|---|
| **Edge IP Blacklist** | `ban:ip:<ip>` | Upstash REST (Edge) | **FAIL-OPEN** (for normal users) | Preserves platform uptime during Upstash hiccups. Checks local in-memory ban set (`edgeKnownBannedIps`) before failing open. Prevents 100% platform-wide blackout. |
| **API Rate Limiting (Standard Traffic)** | `ratelimit:<action>:<token>` | `ioredis` (TCP) | **FAIL-OPEN** | Returns `{ success: true, remaining: 1 }` and logs error. Prevents false 429 Too Many Requests errors for legitimate users (MSG-08). |
| **API Rate Limiting (Security-Critical)** | `ratelimit:auth:*`, `ratelimit:withdrawal:*` | `ioredis` (TCP) | **FAIL-CLOSED** | Throws 503 `AppError.serviceUnavailable` on login, OTP, and withdrawal limits to protect against brute-force attacks during an outage. |
| **Distributed Locks (General & Cron)** | `cron:<job>:lock` | `ioredis` (TCP) | **FAIL-CLOSED** | Returns `null` on failure. Crons fail-fast safely rather than running concurrent overlapping jobs. |
| **Distributed Locks (Financial Paths)** | `lock:deal:completion:<dealId>` | `ioredis` (TCP) | **FAIL-CLOSED + DB GUARD** | Returns `null` if lock cannot be acquired. In addition, financial paths enforce PostgreSQL row locks and `prisma.$transaction` state machines so money safety never relies on Redis alone. |
| **API Idempotency** | `job:dedup:<id>`, `idempotency:<key>` | PostgreSQL (`prisma.idempotencyKey`) | **FAIL-CLOSED (DB)** | Persisted directly in PostgreSQL. Durable across restarts and Redis flushes. |
| **Application Cache** | `cache:<key>`, `category_cpv:*` | `ioredis` (TCP) | **FAIL-OPEN** | Catches Redis errors, logs a warning, and executes the underlying DB `fetcher()` directly. |
| **Operational Kill Switches** | `killswitch:<feature>` | `ioredis` (TCP) | **FAIL-OPEN** (with in-memory override) | If Redis is down, reads in-memory emergency override (`localOverrides`). Sets a 7-day TTL (`86400 * 7`) to prevent indefinite state retention. |
| **User Bookmarks Cache** | `user:<userId>:bookmarks` | `ioredis` (TCP) | **FAIL-OPEN** | Reads and writes fallback to PostgreSQL (`User.notificationPreferences.bookmarks`) with in-memory process fallback for offline tests. Sets 30-day TTL (`86400 * 30`). |
| **Realtime Chat Typing** | `typing:<convId>:<userId>` | `ioredis` (TCP) | **FAIL-OPEN** | Ephemeral feature with 5-second TTL. Logs warning and skips broadcast without disrupting chat delivery. |
| **Circuit Breaker** | `cb:failures:<service>`, `cb:open:<service>` | `ioredis` (TCP) | **FAIL-OPEN** | Redis errors fail open so transient Redis blips do not trigger widespread cascading circuit breaker trips. |

---

## 2. Distributed Lock Correctness & Money Safety Protocol

### 2.1 The Distributed Lock Protocol
- **Atomic Acquisition:** `redis.set(key, token, "EX", ttlSeconds, "NX")` ensures atomic reservation.
- **Unique Cryptographic Tokens:** Every lock acquisition generates a random UUID (`crypto.randomUUID()`) to prevent accidental release by preempted processes.
- **Safe Release (CAS Lua Script):** Locks are released exclusively via Lua compare-and-delete:
  ```lua
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
  else
    return 0
  end
  ```
- **TTL Sizing:** TTL must exceed the worst-case critical section runtime (e.g. 60–300s for crons; 60s for deal settlement).

### 2.2 Financial Invariant: Database-First Money Safety
> **CRITICAL RULE:** Money safety must NEVER rely on Redis locks alone.
- Any gateway trigger (Razorpay payout, escrow release, ledger debit) MUST be wrapped in a database transaction (`prisma.$transaction`).
- Target records must use deterministic status transitions (e.g., `status: "VERIFIED"` -> `"PROCESSING"`).
- Database row locks (`SELECT FOR UPDATE`) or optimistic lock checks ensure that even if Redis fails or a lock TTL expires prematurely, duplicate payouts or ledger double-entries are physically impossible.

---

## 3. QStash Architecture & Operational Security

### 3.1 Dual Signing Key Rotation
Upstash QStash issues two keys: `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`.
- `Receiver` from `@upstash/qstash` verifies with `currentSigningKey` first.
- If signature verification fails (e.g., during active key rotation), `Receiver` automatically falls back to `nextSigningKey`.
- **Zero-Downtime Rotation:** Add the newly rotated key as `QSTASH_NEXT_SIGNING_KEY` on Vercel, trigger rotation in Upstash console, wait 1 hour, then promote to `QSTASH_CURRENT_SIGNING_KEY`.

### 3.2 Anti-Replay & SEC-13 Protections
1. **Host Verification (Anti-Replay to Wrong Environment):**
   - In production, incoming requests to QStash endpoints (`/api/jobs/consumer`, `/api/jobs/dlq`) verify that `req.headers.get("x-forwarded-host") || req.headers.get("host")` matches the configured environment host (`getBaseAppUrl()`).
   - Prevents cross-environment token replay (e.g. from preview/staging to production).
2. **SEC-13: Production Mock Signature Prohibition:**
   - Mock signatures (`valid_mock_qstash_signature` or `ey...` bypasses) are strictly rejected if `process.env.NODE_ENV === "production"`, regardless of `SKIP_ENV_VALIDATION`.
3. **Subject URL Verification:**
   - The receiver validates the JWT `sub` claim against the request URL, ensuring the token was signed specifically for that endpoint.

### 3.3 Consumer Idempotency by `deduplicationId`
- All background tasks in `time-critical` and `scheduled` categories require a unique `deduplicationId`.
- On receipt in `/api/jobs/consumer`:
  1. Calls `claimIdempotencyKey("job:dedup:" + deduplicationId)`.
  2. If already claimed or processed, returns `200 OK` with `{ success: true, message: "Duplicate job skipped" }`.
  3. On completion, calls `saveIdempotencyResponse(...)` extending the record TTL to 24 hours.
  4. On failure, calls `releaseIdempotencyKey(...)` so QStash retries can execute safely.

### 3.4 Dead-Letter Queue (DLQ) & Safe Admin Replay (P6-MONEY-08)
- When a job exhausts all retries (5 for time-critical, 3 for scheduled, 2 for best-effort), QStash dispatches to `/api/jobs/dlq`.
- The failure is stored permanently in PostgreSQL `DeadLetterJob` with original payload, error trace, and attempt count.
- **Admin Replay (`/api/admin/jobs/dlq`):**
  - Admins can re-enqueue failed jobs.
  - Generates a fresh retry deduplication ID (`<original>-retry-<timestamp>`).
  - Clears stale `ProcessedWebhookEvent` records so idempotency guards do not drop the replay.
  - If re-enqueue fails or `result.enqueued === false`, the DLQ record status immediately reverts to `JobStatus.FAILED`.

---

## 4. Background Cron Schedules & Automation Matrix (P11 REL-06)

All 16 background cron jobs run on UTC schedules and are mapped to IST (`Asia/Kolkata`, UTC +05:30):

| # | Route Path | Frequency (UTC) | Schedule in IST (Asia/Kolkata) | Timeout | Distributed Lock Key | Lock TTL |
|---|---|---|---|---|---|---|
| 1 | `/api/cron/reconcile-payouts` | `*/30 * * * *` | Every 30 minutes | 60s | `cron:reconcile-payouts:lock` | 300s |
| 2 | `/api/cron/expire-signatures` | `0 * * * *` | Hourly at minute 30 | 60s | `cron:expire-signatures:lock` | 300s |
| 3 | `/api/cron/expire-campaigns` | `0 * * * *` | Hourly at minute 30 | 60s | `cron:expire-campaigns:lock` | 300s |
| 4 | `/api/cron/lift-suspensions` | `0 * * * *` | Hourly at minute 30 | 60s | `cron:lift-suspensions:lock` | 300s |
| 5 | `/api/cron/content-auto-approve` | `0 */2 * * *` | Every 2 hours at :30 | 60s | `cron:content-auto-approve:lock` | 300s |
| 6 | `/api/cron/engagement` | `0 */4 * * *` | Every 4 hours at :30 | 60s | `cron:engagement:lock` | 300s |
| 7 | `/api/cron/cleanup-idempotency` | `0 1 * * *` | Daily at 06:30 AM IST | 60s | `cron:cleanup-idempotency:lock` | 300s |
| 8 | `/api/cron/cleanup-oauth` | `30 1 * * *` | Daily at 07:00 AM IST | 60s | `cron:cleanup-oauth:lock` | 300s |
| 9 | `/api/cron/ledger-scan` | `0 2 * * *` | Daily at 07:30 AM IST | 60s | `cron:ledger-scan:lock` | 300s |
| 10 | `/api/cron/reconcile-ledger-settlements` | `0 3 * * *` | Daily at 08:30 AM IST | 60s | `cron:reconcile-settlements:lock` | 300s |
| 11 | `/api/cron/post-monitor` | `0 4 * * *` | Daily at 09:30 AM IST | 60s | `cron:post-monitor:lock` | 300s |
| 12 | `/api/cron/stale-fulfillment` | `0 10 * * *` | Daily at 03:30 PM IST | 60s | `cron:stale-fulfillment:lock` | 300s |
| 13 | `/api/cron/tenure-badges` | `0 12 * * *` | Daily at 05:30 PM IST | 60s | `cron:tenure-badges:lock` | 300s |
| 14 | `/api/cron/weekly-challenges` | `0 0 * * 1` | Mondays at 05:30 AM IST | 60s | `cron:weekly-challenges:lock` | 300s |
| 15 | `/api/cron/social-proof` | `0 1 * * 0` | Sundays at 06:30 AM IST | 60s | `cron:social-proof:lock` | 300s |
| 16 | `/api/cron/refresh-social-tokens` | `0 5 * * *` | Daily at 10:30 AM IST | 60s | `cron:refresh-tokens:lock` | 300s |

### Dead-Man Switch & Heartbeat Monitoring
- Each cron updates `cron:<name>:last_run` in Redis with the Unix timestamp of completion.
- If a cron has not reported completion within `2.5 × expected interval`, an alert is triggered (P11 REL-06).

---

## 5. Quota & Cost Management (Upstash Free Tier ⚠️)

| Provider Resource | Free Tier Quota | VyaparMedia Daily Budget | 70% Alert Threshold | Action on Alert |
|---|---|---|---|---|
| **Upstash Redis Commands** | 10,000 commands / day | 7,000 commands / day | 4,900 commands / day | Log warning; increase cache TTLs; evaluate Upstash Pro plan upgrade. |
| **Upstash QStash Messages** | 500 messages / day | 350 messages / day | 245 messages / day | Throttle non-critical telemetry; batch badge evaluations; notify platform ops. |
| **Redis TCP Connections** | 100 concurrent TCP sockets | 40 pooled sockets | 28 sockets | Reuses `globalThis.redis` across serverless lambdas with 10s connection timeout. |

---

## 6. Data Hygiene & Security Invariants

1. **No PII or Secrets in Redis:** Passwords, PAN numbers, GSTINs, bank accounts, and auth secrets are NEVER written to Redis keys or values.
2. **Mandatory TTL on All Keys:** Every `SET`, `SADD`, or `ZADD` operation MUST be accompanied by an `EX` or `EXPIRE` statement. Unbound, indefinite keys are prohibited.
3. **No Localhost Fallback in Production (TP-05):** In production runtime, `REDIS_URL` is mandatory. Falling back to `127.0.0.1` throws an initialization error.
