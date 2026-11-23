# DLQ Replay & Typed Topic Registry Architecture (`docs/design/dlq-replay.md`)

## 1. Problem Statement & Root Cause
When critical background jobs fail permanently or encounter operational errors (such as missing transfer holds, gateway refund timeouts, unbilled shipment gaps, or debt claim distribution discrepancies), they are written to the `DeadLetterJob` table. Previously, these records were persisted with imaginary endpoint paths:
- `/api/escrow/release`
- `/api/payments/razorpay/refund`
- `/api/wallet/reconcile-debt`
- `/api/cron/reconcile-shipments`

When an administrator attempted to replay a failed job via `POST /api/admin/jobs/dlq`, the re-enqueue logic directed QStash to deliver the HTTP payload back to `deadJob.endpoint`. Because no route handlers existed at those paths, QStash received HTTP 404, making manual retry of failed escrow releases, refunds, and debt reconciliations mathematically impossible. Furthermore, `src/app/api/jobs/consumer/route.ts` only handled a small subset of topics.

## 2. Topic Registry Architecture (`src/lib/job-topics.ts`)
We establish a typed, centralized topic registry where:
- Every job topic is strongly typed.
- Each topic maps to:
  1. `payloadSchema`: Strict Zod schema for runtime payload validation.
  2. `category`: Time-critical, scheduled, or best-effort.
  3. `maxReplays`: Maximum permitted automated or administrative replays.
  4. `requiresAdminApproval`: Boolean indicating whether manual administrative confirmation is mandatory.
  5. `isManualOnly`: Boolean indicating topics requiring human operational runbook intervention rather than automated execution.
  6. `runbookNote`: Human-readable operational runbook instructions for manual or administrative resolution.
  7. `idempotencyKeyFn`: Function computing an entity-specific idempotency key (e.g. `dlq:payment:escrow_release:<dealId>`).
  8. `handler`: Strongly-typed execution handler that runs with distributed locking, idempotency protection, ledger invariant verification, and audit logging.

## 3. Registered Topics & Execution Handlers
1. **`payment.escrow_release_missing_transfer`** (Time-Critical, Financial):
   - Resolves missing Razorpay Route transfer ID from database or gateway.
   - If transfer hold already exists, releases the hold via `releaseTransferHold`.
   - Idempotent: checks whether `paymentHold.status === "COMPLETED"` or `deal.status === "COMPLETED"` before triggering.
2. **`payment.escrow_release_gateway_failed`** (Time-Critical, Financial):
   - Retries `releaseTransferHold(transferId)` with circuit breaker.
   - On success, atomically marks `paymentHold.status = "COMPLETED"` and logs activity.
3. **`dispute.gateway_refund`** (Time-Critical, Financial):
   - Retries `refundPayment({ paymentId, amount, notes })` for dispute resolutions.
   - Idempotent: validates whether payment was already refunded on Razorpay or ledger before executing.
4. **`wallet.debt_distribution_gap`** (Time-Critical, Financial):
   - Reconciles remaining unallocated debt recovery funds against active creditor claims.
   - Enforces ledger-guard: zero drift in wallet balance invariants.
5. **`shipping.unbilled_shipment_reconcile`** (Time-Critical, Logistics):
   - Deducts outstanding courier charges from brand wallet with idempotency.
   - Verifies whether deduction transaction was already recorded.
6. **`payment.route_cancel_refund_failed`** & **`payment.route_cancel_reverse_failed`** (Time-Critical, Financial):
   - Retries reverse transfer or brand refund for cancelled deals.
7. **`reconciliation.gateway_mismatch`** (Manual-Only, Financial):
   - Requires manual admin audit verification; runs via documented runbook.
8. **`email.withdrawal`**, **`gamification.evaluate_badges`**, **`gamification.evaluate_challenge`**, **`deal.auto_approve_timeout`**:
   - Integrated and dispatched cleanly through the registry.

## 4. Universal Replay Routing
- All DLQ re-enqueues dispatch to `/api/jobs/consumer`.
- `endpoint` in `DeadLetterJob` is treated as derived/legacy and automatically defaults to `/api/jobs/consumer`.
- Unknown topics fail with an explicit alert and audit log, never silently swallowed.
- Double-replay is mathematically idempotent.
