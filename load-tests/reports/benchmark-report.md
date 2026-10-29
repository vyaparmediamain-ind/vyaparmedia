# VyaparMedia Performance & Load Test Benchmark Report

**Environment**: Local Development / Staging Testbed  
**Date**: October 2026  
**Node.js**: v24.x  
**Database**: PostgreSQL 16 (via Prisma 6.19.3)  
**Cache / Rate Limiter**: Redis (ioredis / Upstash sliding window)  
**Concurrency Ramp Profile**: 10 &rarr; 50 &rarr; 200 Virtual Users / Connections  

---

## 1. Executive Summary

This load test benchmark evaluates the core **read-heavy** traffic patterns of the VyaparMedia platform across 3 concurrency tiers:
- **10 VUs** (Warmup / Baseline)
- **50 VUs** (Moderate concurrent production traffic)
- **200 VUs** (Peak campaign launch / stress spike)

### Target Scenarios Evaluated
1. **Creator Discovery & Keyset Cursor Search** (`GET /api/influencers?limit=20&sortBy=followers`)
2. **Campaign Marketplace Feed** (`GET /api/campaigns?limit=20&status=ACTIVE&sortBy=createdAt&sortOrder=desc`)
3. **Session Refresh & Auth Check** (`GET /api/auth/session` & `POST /api/auth/callback/credentials`)
4. **Deals & Wallet Ledger Reads** (`GET /api/deals?limit=20&status=ACTIVE` & `GET /api/wallet`)

---

## 2. Benchmark Results & Latency Distribution

### A. Stage 1: 10 Virtual Users (Baseline)
| Scenario | Req / Sec | p50 (Median) | p95 | p99 | Max | Error Rate | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Creator Discovery (Cursor)** | ~185 req/s | 18 ms | 42 ms | 78 ms | 115 ms | 0.00% | ✅ Optimal |
| **2. Campaign Marketplace Feed** | ~240 req/s | 14 ms | 31 ms | 56 ms | 82 ms | 0.00% | ✅ Optimal |
| **3. Session Refresh Read** | ~410 req/s | 8 ms | 19 ms | 35 ms | 51 ms | 0.00% | ✅ Optimal |
| **4. Deals & Wallet Read** | ~290 req/s | 12 ms | 28 ms | 49 ms | 74 ms | 0.00% | ✅ Optimal |

### B. Stage 2: 50 Virtual Users (Moderate Load)
| Scenario | Req / Sec | p50 (Median) | p95 | p99 | Max | Error Rate | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Creator Discovery (Cursor)** | ~490 req/s | 45 ms | 110 ms | 185 ms | 260 ms | 0.00% | ✅ Stable |
| **2. Campaign Marketplace Feed** | ~610 req/s | 34 ms | 82 ms | 140 ms | 195 ms | 0.00% | ✅ Stable |
| **3. Session Refresh Read** | ~1,150 req/s | 16 ms | 44 ms | 82 ms | 120 ms | 0.00% | ✅ Stable |
| **4. Deals & Wallet Read** | ~720 req/s | 28 ms | 68 ms | 118 ms | 170 ms | 0.00% | ✅ Stable |

### C. Stage 3: 200 Virtual Users (Peak Stress Spike)
| Scenario | Req / Sec | p50 (Median) | p95 | p99 | Max | Error Rate | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Creator Discovery (Cursor)** | ~720 req/s | 118 ms | 340 ms | 620 ms | 980 ms | < 0.2% | ⚠️ Degraded |
| **2. Campaign Marketplace Feed** | ~980 req/s | 72 ms | 210 ms | 390 ms | 550 ms | 0.00% | ✅ Acceptable |
| **3. Session Refresh Read** | ~2,100 req/s | 38 ms | 112 ms | 215 ms | 340 ms | 0.00% | ✅ Stable |
| **4. Deals & Wallet Read** | ~1,120 req/s | 64 ms | 185 ms | 320 ms | 480 ms | 0.00% | ✅ Acceptable |

---

## 3. Database & Redis Bottleneck Analysis

### 1. Database Connection Pool Saturation
- **Observed Behavior**: At 200 concurrent connections, Prisma Client's connection pool (`connection_limit` defaults to `num_physical_cpus * 2 + 1`, typically 10–25 connections) causes queued queries to wait for available pool slots, increasing tail latency (p99).
- **Remediation Hint**:
  - In production / staging, ensure Supavisor connection pooling is active (pgBouncer transaction mode on port `6543`).
  - Set `DATABASE_URL="...?connection_limit=50&pool_timeout=10"` to allow higher pooling without exhausting PostgreSQL backend processes.

### 2. Redis Rate Limiter Barrier on Auth (`AUTH_LOGIN`)
- **Observed Behavior**: VyaparMedia protects credentials sign-in using atomic sliding-window Lua scripts (`TIERED_LIMIT_CONFIGS.AUTH_LOGIN` and `LOGIN_IP`). Concurrency tests firing credential logins at > 10 req/15min from the same client IP intentionally trigger `429 Too Many Requests` or `limitsPassed === false`.
- **Finding**: The security barrier operates as designed. However, in automated load testing, login testing must separate session validation (`GET /api/auth/session` which handles 2,000+ req/s) from credential hammering to prevent test runner IP lockouts.

### 3. Bcrypt CPU Saturation under Concurrency
- **Observed Behavior**: Each credential login calculates `bcrypt.compare` with cost factor `12`. One call takes 80–120ms of dedicated CPU. At 50+ concurrent login requests, Node's `libuv` thread pool (`UV_THREADPOOL_SIZE`, default 4) becomes 100% CPU bound.
- **Remediation Hint**: Keep `UV_THREADPOOL_SIZE=64` or delegate password hashing to dedicated worker processes or argon2 if credential login volume ever spikes in production.

---

## 4. PostgreSQL Query Audit (EXPLAIN ANALYZE) & Index Suggestions

Running real `EXPLAIN (ANALYZE, BUFFERS)` on the active database (`npm run load-test:explain`) revealed two high-impact query optimization targets:

### Scenario 1: Creator Discovery with Keyset Cursor Pagination
```sql
SELECT ip.id, ip."displayName", ip."instagramFollowers", ip."averageRating", u."trustScore"
FROM "InfluencerProfile" ip
JOIN "User" u ON ip."userId" = u.id
WHERE ip."deletedAt" IS NULL
  AND ((ip."instagramFollowers" < 100000) OR (ip."instagramFollowers" = 100000 AND ip.id < 'cmtz000000000infl000000001'))
ORDER BY ip."instagramFollowers" DESC, ip.id DESC
LIMIT 21;
```
- **Plan Analysis**:
  - Execution Time: **0.39 ms** (Buffer hits: hot cache)
  - Nodes: `Sort` &rarr; `Bitmap Heap Scan` &rarr; `Bitmap Index Scan`
  - **Bottleneck**: An in-memory **Sort** node is triggered because existing indexes (`InfluencerProfile_isFeatured_instagramFollowers_averageRati_idx`) require `isFeatured = true` and do not include the tie-breaker `id DESC`.
- **Applied Migration**:
  ```sql
  -- Applied via migration 20261029235000_add_influencer_cursor_followers_index
  CREATE INDEX IF NOT EXISTS "InfluencerProfile_deletedAt_instagramFollowers_id_idx" 
  ON "InfluencerProfile" ("deletedAt", "instagramFollowers" DESC, id DESC);
  ```
  *Status*: **Implemented and deployed to database.** Converts the query into an Index Scan using `InfluencerProfile_deletedAt_instagramFollowers_id_idx`.

---

### Scenario 2: Campaign List & Marketplace Feed
```sql
SELECT c.id, c.title, c."totalBudget", c.status, c."createdAt", bp."companyName"
FROM "Campaign" c
LEFT JOIN "BrandProfile" bp ON c."brandId" = bp.id
WHERE c.status = 'ACTIVE' AND c."deletedAt" IS NULL
ORDER BY c."createdAt" DESC
LIMIT 20;
```
- **Plan Analysis**:
  - Execution Time: **0.25 ms**
  - Nodes: `Index Scan` using `Campaign_createdAt_idx` &rarr; `Index Scan` on `BrandProfile_pkey`
  - **Bottleneck**: None. The composite index `@@index([status, deletedAt, createdAt(sort: Desc)])` in schema is optimal.

---

### Scenario 3: Wallet Ledger & Transaction Feed
```sql
SELECT t.id, t.type, t.amount, t.status, t."createdAt", t.description
FROM "Transaction" t
WHERE t."walletId" = 'seed-wallet-brand-id' AND t."deletedAt" IS NULL
ORDER BY t."createdAt" DESC
LIMIT 20;
```
- **Plan Analysis**:
  - Execution Time: **0.08 ms**
  - Nodes: `Index Scan` using `Transaction_walletId_createdAt_desc_idx`
  - **Bottleneck**: None. Direct b-tree index lookup without any sort or table scan.

---

### Scenario 4: Influencer Deals List Feed
```sql
SELECT d.id, d.status, d.amount, d."totalAmount", d."createdAt", d."submissionDeadline"
FROM "Deal" d
WHERE d."influencerId" = 'seed-influencer-id' AND d.status = 'ACTIVE' AND d."deletedAt" IS NULL
ORDER BY d."createdAt" DESC
LIMIT 20;
```
- **Plan Analysis**:
  - Execution Time: **0.07 ms**
  - Nodes: `Sort` &rarr; `Index Scan` using `Deal_influencerId_idx`
  - **Bottleneck**: An in-memory **Sort** node is triggered because the existing index `Deal_influencerId_idx` only indexes `influencerId` without `createdAt DESC` or `status` (unlike the brand index which already has `@@index([brandId, status, deletedAt, createdAt(sort: Desc)])`).
- **Suggested Index**:
  ```sql
  -- SUGGESTION ONLY (DO NOT RUN UNLESS CREATING A PLANNED MIGRATION)
  CREATE INDEX CONCURRENTLY idx_deal_influencer_status_created 
  ON "Deal" ("influencerId", "status", "deletedAt", "createdAt" DESC);
  ```
  *Impact*: Eliminates memory sort on influencer deal dashboard views under high volume.

