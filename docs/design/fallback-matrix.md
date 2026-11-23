# VyaparMedia Dependency Fallback Matrix (`docs/design/fallback-matrix.md`)

> **Audit & Spec Standard**: Part 2 Fallback Policy & Architecture Integrity  
> **Rule**: Every external I/O dependency, third-party API, and caching layer must have an explicit fail-open or fail-closed policy, structured logging without PII, and automated test coverage.

---

## 1. Matrix Overview

| Dependency / Service | Purpose | Fallback Policy | Behaviour on Failure | Telemetry & Logging | Linked Test |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **Upstash Redis Cache** | Hot reads & session tokens | **Fail-Open** | Falls through directly to primary PostgreSQL database | `logger.warn("Cache miss/failure, failing open to DB")` | [`tests/unit/infra-redis-resilience.test.ts`](file:///c:/Decisional-main/vyaparmedia/tests/unit/infra-redis-resilience.test.ts) |
| **Upstash Redis Rate Limiter** | Rate-limiting buckets | **Fail-Open** | Allows request through if Redis is completely unreachable; maintains local in-memory fallback where enabled | `logger.error("Rate limiter Redis failure, failing open")` | [`tests/unit/rate-limit.test.ts`](file:///c:/Decisional-main/vyaparmedia/tests/unit/rate-limit.test.ts) |
| **Upstash QStash (Crons & Queues)** | Asynchronous jobs & DLQ | **Fail-Closed** | Retries up to 5 attempts; if exhausted, pushes job payload to `DeadLetterJob` table in DB for admin replay | `logger.error("QStash delivery failed, routed to DLQ")` | [`tests/unit/infra-qstash.test.ts`](file:///c:/Decisional-main/vyaparmedia/tests/unit/infra-qstash.test.ts) |
| **PostgreSQL Ledger (Prisma)** | Escrow & Financial Ledger | **Fail-Closed** | Transaction rolls back immediately with serialization error handling; never partially applies funds | `logger.error("Ledger transaction rolled back")` | [`tests/unit/financial-reconciliation.test.ts`](file:///c:/Decisional-main/vyaparmedia/tests/unit/financial-reconciliation.test.ts) |
| **Razorpay Payment Gateway** | Escrow deposit & payouts | **Fail-Closed** | Payout marked `FAILED` or `PROCESSING` with reconciliation note; admin audit required before retry | `logger.error("Gateway payment failed", { orderId })` | [`tests/unit/razorpay.test.ts`](file:///c:/Decisional-main/vyaparmedia/tests/unit/razorpay.test.ts) |
| **Shiprocket Logistics** | Deliverable tracking & AWBs | **Fail-Closed** | Re-queues shipment generation via DLQ `shipping.unbilled_shipment_reconcile` | `logger.error("Shiprocket API call failed")` | [`tests/unit/shiprocket.test.ts`](file:///c:/Decisional-main/vyaparmedia/tests/unit/shiprocket.test.ts) |
| **Instagram Graph API** | Engagement metrics capture | **Fail-Open** | Falls back to rule-based derived estimates with `isEstimated: true` and `ratesQuality: "DERIVED"` | `logger.warn("Instagram API insights unavailable, falling back to derived")` | [`tests/unit/rates-quality.test.ts`](file:///c:/Decisional-main/vyaparmedia/tests/unit/rates-quality.test.ts) |
| **YouTube Data API v3** | Video live check & view stats | **Fail-Open** | Falls back to creator's historical channel baseline with quality flag `DERIVED` | `logger.warn("YouTube API call failed, falling back")` | [`tests/unit/rates-quality.test.ts`](file:///c:/Decisional-main/vyaparmedia/tests/unit/rates-quality.test.ts) |
| **S3 / R2 Object Storage** | Media kits & campaign proofs | **Fail-Closed** | Returns signed presigned URL generation error; prevents unverified upload | `logger.error("S3 presigned upload initialization failed")` | [`tests/unit/storage.test.ts`](file:///c:/Decisional-main/vyaparmedia/tests/unit/storage.test.ts) |
| **MSG91 / Twilio SMS** | OTP verification | **Fail-Closed** | Throws `AppError.serviceUnavailable("SMS gateway temporary failure")` | `logger.error("SMS gateway error")` | [`tests/unit/auth-otp.test.ts`](file:///c:/Decisional-main/vyaparmedia/tests/unit/auth-otp.test.ts) |
| **Resend Email Service** | Transactional & security notifications | **Fail-Open** | Logs delivery failure; app flow proceeds without blocking user action | `logger.warn("Transactional email delivery failed")` | [`tests/unit/email.test.ts`](file:///c:/Decisional-main/vyaparmedia/tests/unit/email.test.ts) |

---

## 2. Architectural Guarantees

1. **No Silent Swallowing**:
   Every `try/catch` must either rethrow a typed `AppError`, log a structured message with sanitized context, or execute a documented fallback path.
2. **No Number Fabrication**:
   When downstream APIs (Instagram/YouTube) are unavailable, values are marked with explicit quality metadata (`DERIVED` or `UNAVAILABLE`) rather than fabricated static defaults.
3. **Defense in Depth**:
   ESLint rules `no-empty` (with `allowEmptyCatch: false`), `@typescript-eslint/no-non-null-assertion: error`, and `no-console: error` guarantee zero regressions in CI/CD.
