# VyaparMedia Part 2 Fallback Policy & Resilience Test Suite Audit

## 1. Executive Summary

This document details the architecture, failure modes, fallback policies, and verification coverage for the **Part 2 Fallback Policy & Resilience Test Suite** of VyaparMedia (`tests/resilience/`).

The suite provides automated end-to-end resilience guarantees for:
- **Redis Outages & Cluster Failovers**
- **Database Timeouts & Multi-Step Financial Atomic Rollbacks**
- **Vendor Outages & Circuit Breakers (Razorpay, Surepass, Meta/Instagram, Google/YouTube)**
- **QStash Messaging Failures & Dead-Letter Queue (DLQ) Recording**
- **Feature-Flag Service Degradations**
- **Cron Worker Overlaps & Double-Runs**
- **Concurrent Duplicate Submissions & Replay Attacks**
- **Cache Invalidation & Zero-Stale Configuration State**
- **Clock Skew & Strict Asia/Kolkata Day Bucketing**
- **Payload Size Protections (413 Payload Too Large)**
- **Zero PII Leakage in Logs and Strict Metric Increments**

---

## 2. Failure Mode & Fallback Matrix

| Subsystem / Resource | Injected Failure Mode | Fallback Policy | Behavioral Invariant | Observability & Metrics |
| :--- | :--- | :--- | :--- | :--- |
| **Rate Limiter (Security Critical)** | Redis connection refused / timeout | **Fail-Closed** | Rejects request with `AppError.serviceUnavailable` (HTTP 503). Zero unauthorized bypass of auth/login/withdrawal limits. | `logger.error` logged with zero credentials/tokens/PII. |
| **Rate Limiter (General Traffic)** | Redis cluster failover / timeout | **Fail-Open** | Grants browsing access (`remaining: 1`) so legitimate consumers are not blocked during transient cache cluster blips. | `logger.warn` emitted without PII. |
| **Admin Cache (L2 Redis)** | Redis read timeout (`ETIMEDOUT`) | **Fail-Open to DB** | Bypasses cache and executes direct query against PostgreSQL primary DB. | `logger.warn` emitted with cache key. |
| **Feature Flags** | Redis unreachable + DB timeout | **Fail-Closed (OFF)** | Defaults to `false` for every feature flag. Never enables unverified rollouts or gated tools. | `logger.error` logged with key and failure reason. |
| **Distributed Locks / Money Locks** | Redis socket error | **Fail-Closed (NULL)** | Returns `null` lock token. Financial mutations and cron jobs safely abort rather than executing concurrently. | `logger.error` logged with sanitized lock key. |
| **Telemetry Buffer** | Redis OOM / socket drop | **Drop Event** | Drops event safely without throwing, crashing, or impacting user latency. | Increments `telemetryEventsDroppedTotal({ reason: "REDIS_DOWN" })` + `logger.warn`. |
| **Database Ledger Mutations** | Write conflict, deadlocks, timeouts | **Atomic Rollback** | All steps wrapped in `prisma.$transaction`. Zero partial ledger or wallet entries created. | `logger.warn` / `logger.error` with sanitized transaction metadata. |
| **Razorpay Gateway** | Consecutive 5xx HTTP errors / timeouts | **Circuit Breaker Opens** | Trips after 3 consecutive failures. Rejects subsequent requests immediately (fail-fast) for 30s. | Increments `circuitBreakerOpenTotal({ action_name: "razorpay:payout" })` + `logger.error`. |
| **Surepass KYC Provider** | 500 Internal Server Error | **Fail-Closed** | Returns `status: "PENDING"`, `success: false`. User is **never** auto-verified on upstream downtime. Trips circuit breaker after threshold. | Increments `circuitBreakerOpenTotal({ action_name: "surepass:api" })` + `logger.error`. |
| **Instagram / Meta API** | Insights timeout | **Quality Flags** | Returns `ratesQuality: "DERIVED"` and `quality: "UNAVAILABLE"`. **Zero fabricated numbers**. | Transparent quality metadata returned to caller. |
| **YouTube API** | Metrics fetch failure | **Quality Flags** | Returns `quality: "UNAVAILABLE"` with `value: 0`. No fake metrics generated. | Transparent quality flags. |
| **QStash Publishing** | Network drop or QStash downtime | **DLQ Persistence** | Writes failed job to `DeadLetterJob` table with registered topic (e.g., `dlq.payment_release`, `shipping.unbilled_shipment_reconcile`). | `logger.critical("DEAD_LETTER_JOB_RECORDED")` without sensitive payload data. |
| **Cron Worker Execution** | Concurrency / Double-invocation | **Mutual Exclusion** | Non-blocking distributed lock. Second worker immediately detects lock held and terminates gracefully. | `logger.warn` for skipped concurrent run. |
| **Mutation Submissions** | Double-click / Webhook replay | **Idempotent Claim** | `claimIdempotencyKey` detects existing `PROCESSING` or completed state; returns cached response or rejects replay. Mismatched userId triggers cross-user replay block. | `logger.warn("[Idempotency] Owner mismatch blocked")` without PII. |
| **Config Change** | Admin updates deal or campaign config | **SCAN Invalidation** | `invalidate(pattern)` scans via Redis `SCAN` (non-blocking) and invalidates L1 in-memory + L2 Redis keys. | `logger.info` logged with count of cleared keys. |
| **Clock Skew (IST Midnight)** | UTC 18:30:00 boundary | **Strict Asia/Kolkata Bounds** | `getKolkataDayBounds` buckets timestamps strictly in Asia/Kolkata (+05:30). UTC 18:29:59.999Z -> Day N; UTC 18:30:00.000Z -> Day N+1. | Day start and end boundaries anchored to UTC. |
| **Payload Budget Protection** | Request size > maxBodySize | **HTTP 413 Payload Too Large** | Rejects oversized requests immediately at edge via `apiWrapper` and `AppError.payloadTooLarge`. | Standardized 413 response. |

---

## 3. Test Suite Verification Results

Command: `npm run test:resilience` (`vitest run tests/resilience`)

```
 ✓  node  tests/resilience/redis-down.test.ts (6 tests)
 ✓  node  tests/resilience/db-atomic-rollback.test.ts (2 tests)
 ✓  node  tests/resilience/vendor-circuit-breaker.test.ts (4 tests)
 ✓  node  tests/resilience/qstash-dlq.test.ts (3 tests)
 ✓  node  tests/resilience/concurrency-and-edge.test.ts (7 tests)

 Test Files  5 passed (5)
      Tests  22 passed (22)
   Duration  7.07s
```

Full Validation Command: `npm run validate`
- **Lint**: 0 errors across all 732 files.
- **Theme Consistency**: 0 theme regressions.
- **Action Buttons**: 60/60 mutating buttons gated with disabled state.
- **Typecheck**: 0 TypeScript errors across the entire codebase.
- **RLS Verification**: 23/23 sensitive tables protected with RLS and non-superuser grants revoked.
- **Prisma Schema**: Validated.

Full Unit Test Suite: `npm test`
- **224 test files passed** (100%)
- **2,121 tests passed** (100%)
