# VyaparMedia Production Operational Runbook & Alert Playbooks

## Overview
This runbook defines operational incident triage procedures, alert thresholds, on-call escalation channels, and mitigation playbooks for the VyaparMedia platform (Next.js 16, Prisma ORM, PostgreSQL, Upstash Redis, QStash, and Razorpay/RazorpayX payment infrastructure).

---

## On-Call Escalation & Channels

| Role | Channel / Platform | SLA | Contact / Schedule |
|---|---|---|---|
| **Primary On-Call** | Slack `#ops-oncall` & PagerDuty Tier 1 | 10 mins (P0) / 30 mins (P1) | Rotating Weekly |
| **Secondary On-Call** | PagerDuty Tier 2 Escalation | 15 mins (if unacked) | Staff Backend / DevOps |
| **Incident Commander** | Slack `#incident-war-room` | Immediate upon P0 | Engineering Lead |
| **Security Officer** | `security@vyaparmedia.com` / Dedicated Hotline | 15 mins for data/auth incident | Head of Infosec |

---

## Standard Emergency Procedures & Rollback Plan

### Rollback Commands
1. **Instant Vercel Rollback to Last Known Healthy Deployment**:
   ```bash
   vercel rollback [PREVIOUS_DEPLOYMENT_URL]
   ```
2. **Database Migration State Verification (Zero destructive down-migrations)**:
   ```bash
   npx prisma migrate status
   ```
3. **Emergency Circuit Breaker Override (Fail-Open)**:
   If Upstash Redis or a third-party vendor experiences a total outage, circuit breakers in `src/lib/circuit-breaker.ts` fail-open gracefully to protect availability without panicking handlers.

---

## Alert Playbooks

### 1. Alert: `payment_failure_rate_high`
- **Threshold**: Payment failure rate > 5% over 5-minute sliding window (excluding user cancellations `BAD_REQUEST_ERROR`).
- **Potential Causes**:
  - Razorpay gateway downtime or bank outage (UPI/Netbanking degradation).
  - Webhook delivery timeout or network latency.
  - Invalid currency or metadata serialization bug.
- **Triage Steps**:
  1. Inspect Razorpay status dashboard: [Razorpay Status](https://status.razorpay.com/).
  2. Query Sentry for `transaction_failed` or `razorpay_error` events.
  3. Inspect `/api/payments/webhook` logs in Vercel for 4xx/5xx responses.
  4. Verify ledger lock state in PostgreSQL:
     ```sql
     SELECT id, status, amount, "createdAt" FROM "Payment" WHERE status = 'FAILED' ORDER BY "createdAt" DESC LIMIT 10;
     ```
- **Remediation**:
  - If Razorpay gateway outage: Enable status banner on `/status` notifying users that bank payments are degraded.
  - If signature or server bug: Roll back deployment immediately.

---

### 2. Alert: `webhook_5xx_rate_critical`
- **Threshold**: HTTP 5xx responses on `/api/payments/webhook` > 1% of total webhook requests or > 3 consecutive failures.
- **Potential Causes**:
  - Unhandled exception during webhook signature verification or payload deserialization.
  - Database deadlock during escrow ledger crediting.
  - Redis idempotency key acquisition timeout.
- **Triage Steps**:
  1. Check Sentry event stack traces filtered by `route: /api/payments/webhook`.
  2. Inspect webhook payload headers for missing or invalid `x-razorpay-signature`.
  3. Test webhook handler locally or against mock server with `msw`.
- **Remediation**:
  - Check `WebhookEvent` table for duplicate events that might be causing unique constraint rejections:
    ```sql
    SELECT "eventId", status, error, "createdAt" FROM "WebhookEvent" WHERE status = 'FAILED' ORDER BY "createdAt" DESC LIMIT 10;
    ```
  - If deadlock: Ensure Prisma transaction uses serial isolation or optimistic locking retry.

---

### 3. Alert: `payout_failed_alert`
- **Threshold**: Any failed creator escrow release / RazorpayX payout transfer event (`transfer.failed` / `payout.reversed`).
- **Potential Causes**:
  - Creator bank IFSC invalid or bank account closed.
  - RazorpayX merchant virtual account balance depleted.
  - Compliance hold / PAN name mismatch during payout verification.
- **Triage Steps**:
  1. Inspect `Payout` record in database:
     ```sql
     SELECT id, "dealId", "creatorId", amount, status, "failureReason" FROM "Payout" WHERE status = 'FAILED' ORDER BY "createdAt" DESC LIMIT 5;
     ```
  2. Check merchant escrow account balance on RazorpayX dashboard.
  3. Ensure creator KYC and PAN verification state is valid (`status = 'VERIFIED'`).
- **Remediation**:
  - If balance deficit: Top up RazorpayX escrow pool account immediately.
  - If creator bank account error: Payout is automatically refunded back to platform escrow; prompt creator via dashboard notification to update IFSC/bank details.

---

### 4. Alert: `cron_missed_alert`
- **Threshold**: `cron:reconcile-payouts:last_run` key in Redis has not been updated within 24 hours (or health check returns `STALE`).
- **Potential Causes**:
  - QStash cron trigger failed or credentials expired.
  - Vercel function timeout (`maxDuration: 60` exceeded).
  - Upstash Redis network partition.
- **Triage Steps**:
  1. Query `/api/health?deep=1` with `Authorization: Bearer $HEALTHCHECK_SECRET` to inspect `cronReconcilePayouts` field.
  2. Check Upstash QStash console for failed deliveries.
  3. Trigger manual reconciliation run:
     ```bash
     curl -X GET "https://vyaparmedia-nine.vercel.app/api/cron/reconcile-payouts" \
       -H "Authorization: Bearer $CRON_SECRET"
     ```
- **Remediation**:
  - Verify QStash token with `npx tsx scripts/verify-qstash-crons.ts`.
  - Re-synchronize crons if needed: `npx tsx scripts/setup-qstash-crons.ts`.

---

### 5. Alert: `db_connection_errors`
- **Threshold**: Database connection pool exhaustion (`PrismaClientInitializationError`, `P2024`, or `ECONNREFUSED`) > 5 occurrences in 1 minute.
- **Potential Causes**:
  - Serverless function scale-out exhausting PostgreSQL `max_connections`.
  - PgBouncer connection pool leak or hanging transaction.
- **Triage Steps**:
  1. Check database active connection count:
     ```sql
     SELECT count(*), state FROM pg_stat_activity GROUP BY state;
     ```
  2. Check whether functions are using pooled connection `DATABASE_URL` (with `pgbouncer=true` and `connection_limit=10`).
  3. Check for slow locking queries:
     ```sql
     SELECT pid, query, age(clock_timestamp(), query_start) FROM pg_stat_activity WHERE state != 'idle' ORDER BY age DESC LIMIT 5;
     ```
- **Remediation**:
  - Terminate hung queries if blocking ledger rows.
  - Increase PgBouncer pool ceiling if traffic spiked sustainably.

---

### 6. Alert: `p95_latency_spike`
- **Threshold**: P95 latency > 1,000ms over 5 consecutive minutes on edge routes.
- **Potential Causes**:
  - Cold starts or un-cached dynamic database queries in `/api/deals` or `/api/creators`.
  - External provider API latency (Surepass KYC or MSG91 SMS).
- **Triage Steps**:
  1. Inspect Vercel Speed Insights and Sentry Performance Traces.
  2. Identify slowest span (DB query vs outbound HTTP).
- **Remediation**:
  - Ensure Upstash Redis query cache is warm.
  - Verify `AbortSignal.timeout` is firing on third-party calls to prevent edge worker starvation.

---

### 7. Alert: `server_5xx_rate_spike`
- **Threshold**: Global 5xx error rate > 1.0% of all HTTP requests over 5 minutes.
- **Potential Causes**:
  - Application runtime crash or unhandled promise rejection.
  - Missing environment variable in Vercel production deployment.
- **Triage Steps**:
  1. Inspect Sentry Issues dashboard for new regressions introduced in latest release.
  2. Inspect `/api/health` shallow endpoint.
- **Remediation**:
  - Trigger rollback if correlated with a new deployment.
  - Inspect Vercel runtime logs for fatal panics.

---

### 8. Alert: `auth_failures_spike`
- **Threshold**: HTTP 401 / 403 or NextAuth login failures > 50 failures / min.
- **Potential Causes**:
  - Distributed credential stuffing / brute-force attack.
  - Expired NextAuth session token signing secret (`NEXTAUTH_SECRET`).
  - Google OAuth client ID / secret mismatch.
- **Triage Steps**:
  1. Inspect request IPs in Vercel Firewall / WAF logs.
  2. Check rate-limiter metrics: `rate_limit_exceeded_total`.
  3. Validate NextAuth health in `/api/health?deep=1`.
- **Remediation**:
  - Enable Vercel Attack Challenge Mode (Cloudflare / Vercel WAF) if distributed attack.
  - Verify IP rate-limiting rules in `src/middleware.ts`.
