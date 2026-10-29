# VyaparMedia Load Testing Suite

Comprehensive load and performance testing suite for VyaparMedia, built using **k6** and **autocannon** with automated **PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)`** query plan analysis.

---

## ⚠️ Strict Safety Rules & Production Protection

1. **NEVER RUN AGAINST PRODUCTION**:
   - The test runner enforces an automated safety guard (`validateTargetSafety` in `config.mjs`).
   - If `TARGET_URL` matches any production domain (`vyaparmedia.in`, `vyaparmedia.com`, or production environments), execution **immediately aborts with a fatal safety exception**.
   - Allowed environments: `http://localhost:3000`, `127.0.0.1`, `0.0.0.0`, or explicit staging (`staging.vyaparmedia.in`).

2. **BLACK-LISTED ENDPOINTS (STRICTLY PROHIBITED FROM LOAD TESTING)**:
   - 💳 **Payments**: `/api/payments/*`, `/api/wallet/add-funds`, `/api/wallet/withdraw`, `/api/deals/*/pay`
   - 🔔 **Webhooks**: `/api/webhooks/*` (Razorpay, external webhooks)
   - 📱 **OTP & SMS**: `/api/auth/verify-otp`, `/api/auth/verify-email-otp`, `/api/user/send-otp`, `/api/user/verify-contact`, `/api/user/2fa/*`

Any request targeting a blacklisted endpoint will fail fast with a `[SAFETY_VIOLATION]` exception.

---

## 🎯 Test Scenarios (Read-Heavy First)

1. **Creator Discovery & Keyset Cursor Search**:
   - Endpoint: `GET /api/influencers?limit=20&sortBy=followers`
   - Evaluates keyset cursor pagination (`?cursor=...`) avoiding `OFFSET` performance degradation.
2. **Campaign List & Marketplace Feed**:
   - Endpoint: `GET /api/campaigns?limit=20&status=ACTIVE&sortBy=createdAt&sortOrder=desc`
   - Tests public and authenticated campaign discovery feeds.
3. **Session Refresh & Authentication**:
   - Endpoint: `GET /api/auth/session` and periodic `POST /api/auth/callback/credentials`
   - Tests JWT session hydration, Redis token cache, and auth latency.
4. **Wallet Ledger & Deals List**:
   - Endpoints: `GET /api/wallet` and `GET /api/deals?limit=20&status=ACTIVE`
   - Validates user financial ledger reads and deals query performance.

---

## 📈 Concurrency Ramp Profile

The suite evaluates performance across 3 distinct tiers:
- **Stage 1 (10 VUs)**: Baseline / Warmup load
- **Stage 2 (50 VUs)**: Typical concurrent active traffic
- **Stage 3 (200 VUs)**: Peak campaign surge / stress load

---

## 🚀 Quick Start Guide

### Step 1: Seed Test Data
Before running load tests, ensure your database has seeded test accounts:
```bash
npm run seed
```
This populates:
- **Brand**: `brand@test.vyaparmedia.in` / `Test@1234` (with wallet balance and active campaigns)
- **Influencer**: `influencer@test.vyaparmedia.in` / `Test@1234` (with verified profile and deals)
- **Admin**: `admin@test.vyaparmedia.in` / `Test@1234`

### Step 2: Start the VyaparMedia Server
In a separate terminal, launch the local application server:
```bash
npm run dev
# or for production-like standalone build:
# npm run build && npm run start
```
Verify the server is accessible at `http://localhost:3000`.

---

## 🧪 Executing the Load Tests

### Option A: Using Autocannon (Built-in, No External Installation Required)
Autocannon runs directly in Node.js 24 and executes the full 10 &rarr; 50 &rarr; 200 connection ramp:
```bash
npm run load-test
```
Custom target URL or test options:
```bash
TARGET_URL="http://localhost:3000" npm run load-test
```

### Option B: Using k6 (If k6 is installed on your system)
If you have `k6` installed ([k6 Installation Guide](https://k6.io/docs/get-started/installation/)):
```bash
npm run load-test:k6
# or directly:
k6 run load-tests/k6-read-heavy.js
```
To run k6 with custom target environment variables:
```bash
k6 run -e TARGET_URL=http://localhost:3000 load-tests/k6-read-heavy.js
```

---

## 🔍 Database Query Audit (EXPLAIN ANALYZE)

To inspect PostgreSQL query execution plans, buffer hits, and sort costs on the read-heavy queries:
```bash
npm run load-test:explain
```
This script runs real `EXPLAIN (ANALYZE, BUFFERS)` queries on your active PostgreSQL database and reports planning time, execution time, scan types, and potential bottlenecks.

---

## 💡 Database Index Suggestions

Based on real `EXPLAIN ANALYZE` output on high-concurrency read queries:

### 1. Influencer Keyset Cursor Pagination
**Current Query**:
```sql
SELECT ... FROM "InfluencerProfile"
WHERE "deletedAt" IS NULL
  AND (("instagramFollowers" < 100000) OR ("instagramFollowers" = 100000 AND id < '...'))
ORDER BY "instagramFollowers" DESC, id DESC
LIMIT 21;
```
**Bottleneck**: In-memory `Sort` node is triggered because existing composite indexes lack `id DESC` or require `isFeatured = true`.  
**Suggested Index** *(Do not migrate immediately; implement when ready for next schema update)*:
```sql
CREATE INDEX CONCURRENTLY idx_influencer_cursor_followers 
ON "InfluencerProfile" ("deletedAt", "instagramFollowers" DESC, id DESC);
```

### 2. Influencer Deals List Feed
**Current Query**:
```sql
SELECT ... FROM "Deal"
WHERE "influencerId" = '...' AND status = 'ACTIVE' AND "deletedAt" IS NULL
ORDER BY "createdAt" DESC
LIMIT 20;
```
**Bottleneck**: Triggers an in-memory `Sort` node because `createdAt DESC` is not indexed for influencer deals (whereas `brandId` has `@@index([brandId, status, deletedAt, createdAt(sort: Desc)])`).  
**Suggested Index**:
```sql
CREATE INDEX CONCURRENTLY idx_deal_influencer_status_created 
ON "Deal" ("influencerId", "status", "deletedAt", "createdAt" DESC);
```

---

## 📁 Folder Structure

```
load-tests/
├── config.mjs                   # Central configuration, test accounts, safety guards
├── k6-read-heavy.js             # k6 scenario script with 10->50->200 VU ramp profile
├── run-autocannon.mjs           # Node.js autocannon runner with latency summary tables
├── explain-analyze-scenarios.ts # PostgreSQL EXPLAIN (ANALYZE, BUFFERS) query auditor
├── mock-server-only.ts          # Server-only bypass for CLI tools
├── reports/
│   └── benchmark-report.md      # Detailed benchmark report & latency percentiles
└── README.md                    # This guide
```

