# VyaparMedia Codebase Audit Baseline (`docs/audit/baseline.md`)

> **Audit Date**: November 23, 2026  
> **Auditor**: Antigravity AST Tooling (`TypeScript 5.9.3 Compiler API`)  
> **Engine**: Pure AST syntax tree traversal (replacing legacy regex heuristics)  
> **Status**: Verified & Committed  

---

## 1. Executive Summary

This baseline establishes a machine-verified audit of the VyaparMedia production codebase across route declarations, client-route call connections, test coverage matrices, error fallbacks, and dead-letter queue (DLQ) topology.

| Audit Pillar | Total Targets | Verified / Pass | Gaps / Flags | Primary Artifact |
| :--- | :---: | :---: | :---: | :--- |
| **Route Manifest** | 217 (154 API + 63 Pages) | 100% Valid AST | 0 unhandled routes | [`docs/audit/routes.json`](docs/audit/routes.json) |
| **Client-Route Connections** | 77 Client Call Sites | 76 Matched | 1 SWR Virtual Key (`/api/discovery-feed`), 0 Method Mismatches | [`docs/audit/connections.json`](docs/audit/connections.json) |
| **Test Matrix Coverage** | 631 Modules | 235 Covered (37.2%) | 396 Gaps across components/routes | [`docs/audit/tests.json`](docs/audit/tests.json) |
| **Fallbacks & Code Smells** | 731 Source Files | 759 Catch Blocks | 0 Empty catches, 196 Log-only, 474 Metric Defaults | [`docs/audit/fallbacks.json`](docs/audit/fallbacks.json) |
| **DLQ Endpoints** | 4 Replay Endpoints | 0 / 4 Exist in API | **4 Dead DLQ Endpoints** (404 on admin replay) | Section 4 Below |

---

## 2. Route Manifest & Security Enforcement

Audited via `scripts/audit/route-manifest.ts` using TypeScript AST inspection of `export const {METHOD} = apiWrapper(handler, options)` and Next.js 16 server component page conventions.

### API Routes Breakdown (154 Total Endpoints)
- **Administrative Endpoints (`/api/admin/*`)**: 28 routes (all guarded with `requireAdmin: true` / `requireActiveAdmin`).
- **Brand & Creator Workrooms (`/api/campaigns/*`, `/api/deals/*`, `/api/applications/*`)**: 38 routes.
- **Financial & Escrow (`/api/wallet/*`, `/api/compliance/*`, `/api/payments/*`)**: 19 routes.
- **Scheduled Operations & Crons (`/api/cron/*`)**: 21 routes.
- **Webhooks & Ingest (`/api/webhooks/*`, `/api/telemetry/*`)**: 12 routes.
- **Public & Authentication (`/api/auth/*`, `/api/public/*`, `/api/pricing/*`, `/api/blog/*`)**: 36 routes.

### Auth & Rate-Limiting Coverage
| Dimension | Count | Percentage | Standard Compliance |
| :--- | :---: | :---: | :--- |
| Explicit `requireAuth` / Role Guarded | 108 | 70.1% | Strict session/role verification in `apiWrapper` |
| Rate-Limited (`userRateLimit` / `rateLimit`) | 129 | 83.8% | Dual-window atomic Redis bucket protection |
| Zod Schema Validation (`body`, `query`, `params`) | 88 | 57.1% | Strict `.strict()` input contract enforcement |
| CSRF Exemption (`skipCsrf: true`) | 8 | 5.2% | Verified webhooks only (Razorpay, Shiprocket, Resend, MSG91) |

---

## 3. Client-to-Route Connection Audit

Audited via `scripts/audit/connections.ts`. Resolves `fetch(...)`, `useSWR(...)`, `useSWRInfinite(...)`, `http.*(...)`, `apiClient.*(...)`, and `navigator.sendBeacon(...)` against the route manifest.

| Metric | Count | Details |
| :--- | :---: | :--- |
| **Total Call Sites Detected** | **77** | Deduplicated caller instances across `src/components` and `src/app` |
| **Cleanly Matched Calls** | **76** | Target route exists and HTTP method matches |
| **Method Mismatches** | **0** | No calls sending mismatched HTTP verbs (e.g. POST to GET-only route) |
| **Broken Call Sites** | **1** | `/api/discovery-feed` (see Investigation 1 below) |
| **Candidate Dead Routes** | **56** | Routes in `src/app/api/` with zero direct client callers (excluding allow-listed crons/webhooks/auth/QStash jobs) |

### Specific Endpoint Investigations

#### 1. `/api/discovery-feed` (`DiscoveryFeed.tsx` ~L150)
- **Status**: **VIRTUAL SWR CACHE KEY (Harmless / Expected)**
- **Caller**: [src/components/discovery/DiscoveryFeed.tsx](src/components/discovery/DiscoveryFeed.tsx#L150)
- **Finding**: SWR Infinite uses `['/api/discovery-feed', mode, ...]` as a hierarchical cache key. The custom fetcher (`fetchDiscoveryPage`) intercepts the query and calls either `/api/campaigns` or `/api/influencers`.
- **Verdict**: Not broken. No HTTP call is ever made to `/api/discovery-feed`.

#### 2. `/api/telemetry/event`
- **Status**: **UNREFERENCED BACKEND ROUTE**
- **File**: [src/app/api/telemetry/event/route.ts](src/app/api/telemetry/event/route.ts)
- **Finding**: Route exists with full `apiWrapper`, `PageViewEventInputSchema` validation, and `userRateLimit`. However, frontend client telemetry in [PageViewTracker.tsx](src/components/analytics/PageViewTracker.tsx#L95) dispatches beacon events to `/api/telemetry/track`.
- **Verdict**: `/api/telemetry/event` is an orphan endpoint. Should be retained as a REST fallback or consolidated into `/api/telemetry/track`.

#### 3. `/api/upload/confirm`
- **Status**: **UNREFERENCED SECURITY POST-VERIFICATION HOOK**
- **File**: [src/app/api/upload/confirm/route.ts](src/app/api/upload/confirm/route.ts)
- **Finding**: Route provides server-side magic-byte and SVG/XSS inspection (`confirmUploadedObject`) for direct S3/R2 presigned uploads. Current client upload components ([ProfileTab.tsx](src/components/dashboard/settings/ProfileTab.tsx#L209)) use direct `/api/upload` multipart stream.
- **Verdict**: Valid enterprise hook for direct client-to-storage architecture. Kept intact for presigned upload workflows.

---

## 4. The 4 Dead DLQ Endpoints Audit

A critical reliability audit of `DeadLetterJob` persistence and admin dead-letter queue replay mechanisms:

### The Problem Architecture
When operations fail in payment release, dispute refunding, debt distribution, or carrier sync, the backend creates a `DeadLetterJob` record with a designated `endpoint`.

When an admin navigates to `/admin/system` (or calls `POST /api/admin/jobs/dlq`), line 122 of [src/app/api/admin/jobs/dlq/route.ts](src/app/api/admin/jobs/dlq/route.ts#L122) attempts to re-enqueue the job into QStash:
```ts
const publishOptions = {
  endpoint: deadJob.endpoint,
  topic: deadJob.topic,
  category: mappedCategory,
  payload: deadJob.payload,
};
await publishJob(publishOptions);
```
QStash delivers the HTTP payload to the application host at `deadJob.endpoint`. **If the target endpoint does not exist as an API route handler in `src/app/api/`, QStash receives HTTP 404, causing the replay to immediately fail.**

### Matrix of the 4 Dead Endpoints

| # | Dead DLQ Endpoint | Originating Source File | Line | Trigger Event & DLQ Topic | Payload Contents | Replay Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :-: |
| **1** | `/api/escrow/release` | [src/services/payment.service.ts](src/services/payment.service.ts#L299) | 299, 343 | `payment.escrow_release_missing_transfer`, `payment.escrow_release_gateway_failed` | `{ dealId, paymentHoldId, transferId, amount }` | **404 NOT FOUND** |
| **2** | `/api/payments/razorpay/refund` | [src/lib/dispute-mediator/transaction-helpers.ts](src/lib/dispute-mediator/transaction-helpers.ts#L241) | 241 | `dispute.gateway_refund` | `{ dealId, paymentId, amount, refundPercentage }` | **404 NOT FOUND** |
| **3** | `/api/wallet/reconcile-debt` | [src/lib/wallet-debt.ts](src/lib/wallet-debt.ts#L186) | 186 | `wallet.debt_distribution_gap` | `{ walletId, userId, remainingDebtPaid, debtPaid, dealId }` | **404 NOT FOUND** |
| **4** | `/api/cron/reconcile-shipments` | [src/services/deal/product.ts](src/services/deal/product.ts#L356) | 356 | `shipping.unbilled_shipment_reconcile` | `{ dealId, brandUserId, awbCode, courierChargePaise }` | **404 NOT FOUND** |

### Remediation Blueprint for Phase F01
1. **Option A (Dedicated Internal Handlers)**: Implement minimal, authenticated internal worker route handlers at these 4 paths:
   - `src/app/api/escrow/release/route.ts`
   - `src/app/api/payments/razorpay/refund/route.ts`
   - `src/app/api/wallet/reconcile-debt/route.ts`
   - `src/app/api/cron/reconcile-shipments/route.ts`
   Guarded with QStash signature verification (`verifyQstashSignature`).
2. **Option B (Universal DLQ Consumer Router)**: Update `DeadLetterJob.endpoint` in writer code to route through `src/app/api/jobs/consumer/route.ts` with job topic dispatch.

---

## 5. Test Matrix & Coverage Gaps

Audited via `scripts/audit/test-matrix.ts`. Maps 631 source modules to 177 test files via AST import declarations and route-string invocations across test layers.

| Module Layer | Total Target Files | Covered by Tests | Coverage % | Test Layers Exercising Layer |
| :--- | :---: | :---: | :---: | :--- |
| **Pure Libraries (`src/lib/*`)** | 183 | 132 | **72.1%** | Unit, Contracts, Integration |
| **Service Layer (`src/services/*`)** | 48 | 29 | **60.4%** | Integration, Unit |
| **API Route Handlers (`src/app/api/*`)** | 154 | 31 | **20.1%** | Contract, Integration |
| **User Pages (`src/app/**/page.tsx`)** | 63 | 23 | **36.5%** | Integration, E2E |
| **UI Components (`src/components/*`)** | 183 | 20 | **10.9%** | Unit |
| **OVERALL TOTALS** | **631** | **235** | **37.2%** | **177 Test Files / 1,613 Tests** |

### Critical Gaps to Address in Phase T00
1. **Component Render Suite**: 163 UI components lack dedicated static or render-state test files.
2. **API Route Contracts**: 123 API route handlers lack contract tests verifying `apiWrapper` rejection codes, IDOR ownership, and 404 secrecy.

---

## 6. Fallbacks & Code Smells Audit

Audited via `scripts/audit/fallbacks.ts`. Scans 731 source files for silent error suppression, unchecked metric defaults, non-null assertions, and compiler bypasses.

### Catch Block Classifications (759 Total Catch Blocks)
| Classification | Count | Description | Action Item |
| :--- | :---: | :--- | :--- |
| **Empty Catch Blocks** | **0** | Zero statements in catch block | ✅ Zero silent black-holes |
| **Comment-Only** | **0** | Catch block with comments only | ✅ Clean |
| **Log-Only** | **196** | Only calls `logger.*` or `console.*` | Review in F06: verify whether error should bubble |
| **Rethrow** | **147** | Explicitly re-throws `throw err` or `AppError` | ✅ Clean transaction rollbacks |
| **Error Response** | **165** | Returns `NextResponse.json` / `ApiResponse.error` | ✅ Standard route handler behavior |
| **Fallback Value** | **225** | Returns safe default value or UI fallback state | Audit in F06: verify no metric fabrication |
| **Other / Flow Control** | **26** | Custom retry or branching logic | Verified clean |

### Anti-Patterns & Smells Matrix
| Smell Type | Occurrences | AST Detection Standard | Risk Level & Guidance |
| :--- | :---: | :--- | :--- |
| **Metric Defaults (`\|\|` / `?? <number>`)** | **474** | Binary expressions on metric identifiers (reach, views, budget, balance) | **Medium**: Ensure default `0` is never rendered as measured performance |
| **Non-Null Assertions (`!`)** | **130** | `ts.NonNullExpression` | **Low-Medium**: Replace with explicit optional chaining or narrowing |
| **`Math.random()` Usages** | **7** | `Math.random()` calls | **Low**: Verify only used in UI jitter/keys, never in cryptographic or token flows |
| **Explicit `any` Keywords** | **2** | `ts.SyntaxKind.AnyKeyword` in source | **Low**: Replace with `unknown` or strict Zod infer types |
| **Compiler Ignores (`@ts-ignore` / `eslint-disable`)** | **3** | Directives in source files | **Low**: Safe third-party type workarounds |

---

## 7. Audit Scripts Reference

The audit tooling is committed and automated via the following read-only scripts (all run in `< 10 seconds`):

```bash
# 1. Generate full API & Page Route Manifest
npm run audit:routes

# 2. Audit Client-to-Route Connections, Broken Calls & Candidate Dead Routes
npm run audit:connections

# 3. Generate 5-Layer Test Matrix Coverage & Gap List
npm run audit:tests

# 4. Scan Catch Block Classifications, Metric Defaults & Code Smells
npm run audit:fallbacks
```

All tooling is strictly validated by fixture tests in [tests/unit/audit-tools.test.ts](tests/unit/audit-tools.test.ts).
