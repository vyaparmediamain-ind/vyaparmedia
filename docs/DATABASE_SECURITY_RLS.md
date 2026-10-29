# Database Security, RLS & Infrastructure Runbook

**Service Scope:** VyaparMedia Production Database & Infrastructure  
**Core Technologies:** PostgreSQL, Prisma ORM, Supabase (Supavisor pooler + PITR), NextAuth.js, AWS S3 / Cloudflare R2  
**Security References:** TP-01, TP-09, P7-SEC-01, P11 REL-16  

---

## 1. Realtime Architecture & TP-01 Decision (Option A)

### 1.1 The TP-01 Problem
- **Root Cause:** VyaparMedia uses NextAuth (HTTP-only session cookies and custom JWT in Node.js runtime) rather than Supabase Auth.
- When the client instantiated `@supabase/supabase-js` using `NEXT_PUBLIC_SUPABASE_ANON_KEY`, the client lacked a Supabase Auth session token.
- In PostgreSQL, the connection context evaluated to `auth.role() = 'anon'` and `auth.uid() = NULL`.
- Because defense-in-depth Row Level Security (RLS) policies on sensitive entities (`Deal`, `Wallet`, `Message`, `Notification`) strictly require `auth.uid() IS NOT NULL`, Supabase Realtime silently dropped all `postgres_changes` events.
- Concurrently (TP-09), Content Security Policy (CSP) headers in `src/middleware.ts` omitted `https://*.supabase.co` and `wss://*.supabase.co`, blocking client websocket handshakes.

### 1.2 The Resolution: Option A (Polling & SWR)
VyaparMedia adopts **Option A**:
1. **Supabase Client-Side Realtime Dropped Entirely:**
   - Removed direct client-side Supabase client initialization.
   - Removed `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the client environment bundle and `src/env.ts`.
2. **Adaptive Visibility-Aware SWR Polling:**
   - **Deals (`useDealRealtime.ts`):** 2.0s adaptive polling when the browser tab is visible during active deal stages; halts when tab is backgrounded or deal reaches terminal states (`COMPLETED`, `CANCELLED`).
   - **Messages (`useMessages.ts`):** 2.5s adaptive polling when a conversation is actively open and focused; typing indicators leverage Redis `/api/messages/typing`.
   - **Notifications (`useNotificationCenter.ts`):** 30s background poll with instant reconciliation on window focus and network `online` events.
   - **Wallet (`useWallet.ts`):** Wrapped in `useSWR` with `revalidateOnFocus: true` and optimistic local mutations.
3. **Benefits:**
   - Zero exposure of Supabase API keys to the client browser.
   - Zero dependence on Supabase RLS for client realtime streaming.
   - 100% resilient across mobile browsers, low-power modes, and corporate firewalls where WebSockets are routinely blocked.

---

## 2. Row Level Security (RLS) & PostgREST Hardening (P7-SEC-01)

Even though client-side PostgREST is not used, defense-in-depth guarantees that direct attacks against Supabase endpoints return `401/403` with zero data exposure.

### 2.1 Role Privilege Revocation
Via migration `20261016000000_deny_anon_authenticated_all_tables`:
- Direct `SELECT`, `INSERT`, `UPDATE`, and `DELETE` privileges on ALL tables, routines, and sequences in schema `public` are permanently **REVOKED** from Supabase default roles `anon` and `authenticated`.
- `ALTER DEFAULT PRIVILEGES` ensures newly created tables automatically inherit this restriction.

### 2.2 Default-Deny RLS Enforcement
- Row Level Security (`ENABLE ROW LEVEL SECURITY`) is enforced across all tables in `public`.
- Server connections via Prisma use the PostgreSQL superuser / service connection which possesses `BYPASSRLS`.
- If an unauthenticated client queries any table via PostgREST, PostgreSQL applies default-deny and returns 0 rows.

### 2.3 CI RLS Verification Gate
Run automated RLS verification in CI:
```bash
npm run db:verify-rls
```
Scans all Prisma migrations to guarantee that every sensitive table has RLS enabled and privileges revoked.

---

## 3. Database Connection Pooling & Sizing (Supavisor)

### 3.1 Connection String Topology
- **`DATABASE_URL` (Runtime Pooler):**
  - Connects to Supavisor in **Transaction Mode** on port `6543`.
  - Format: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`
  - **`connection_limit=1`:** Essential on Vercel Serverless. Each Lambda container maintains at most 1 connection to avoid pooler exhaustion across horizontal cold starts.
  - Automatically adapts to `connection_limit=10` in non-serverless long-running processes (tests, local dev) to prevent in-memory query queueing.
- **`DIRECT_URL` (DDL & Migrations Only):**
  - Connects directly to PostgreSQL on port `5432` in session mode.
  - Used exclusively by `prisma migrate deploy` and `prisma db push` during CI/CD.

### 3.2 Transaction Timeouts & Guardrails
- **Default Interactive Transactions:** `src/lib/db.ts` extends Prisma default timeouts to `maxWait: 10000ms`, `timeout: 15000ms` to withstand cross-region WAN latency.
- **Financial Deal Completion:** `PaymentService.processDealCompletion` explicitly specifies `{ maxWait: 10000, timeout: 20000 }` to accommodate double-entry ledger debiting, escrow release, and referral payouts without hitting pooler limits.

---

## 4. Backup & Disaster Recovery (PITR)

### 4.1 Point-in-Time Recovery (PITR)
- **Status:** Enabled on Supabase Production Database (⚠️ verify in Supabase dashboard under *Database -> Backups*).
- **Retention:** 7 to 30 days continuous WAL archiving.
- **Recovery Point Objective (RPO):** <= 2 minutes.
- **Recovery Time Objective (RTO):** <= 15 minutes.

### 4.2 Restoration Drill Runbook
In the event of catastrophic data corruption or accidental table drop:
1. **Halt Mutating Traffic:** Activate operational kill switch via Redis:
   ```bash
   # Block all mutations platform-wide
   curl -X POST https://vyaparmedia.in/api/admin/kill-switch -d '{"feature": "killswitch:all", "active": true}'
   ```
2. **Clone Point-in-Time Instance:**
   - In Supabase Dashboard, select *Database -> Backups -> Point in Time*.
   - Select the timestamp immediately prior to the incident (e.g. `2026-10-16 14:00:00 UTC`).
   - Restore to a new project or fork instance.
3. **Validate Restored Ledger Integrity:**
   - Run double-entry drift scan on the restored database:
     ```bash
     npx tsx scripts/run-ledger-audit.ts
     ```
4. **Switch Connection Strings:**
   - Update `DATABASE_URL` and `DIRECT_URL` in Vercel environment variables.
   - Redeploy or trigger redeploy without build cache.
5. **Resume Traffic:** Deactivate operational kill switches.

### 4.3 Deployment Region & Latency
- Primary AWS Region: **`ap-south-1` (Mumbai)**.
- Vercel Function Region: **`bom1` (Mumbai, India)**.
- Latency between Vercel Serverless Lambdas and Supabase PostgreSQL is < 3ms.

---

## 5. Storage Buckets Audit

- **Supabase Storage:** **100% UNUSED**.
- **Object Storage Architecture:**
  - All file assets (profile avatars, deal content deliverables, verification PAN/GST documents, dispute evidence) are stored in **AWS S3 / Cloudflare R2** via `@aws-sdk/client-s3` (`src/lib/storage.ts`).
  - Access is restricted via pre-signed URLs with a 15-minute expiry.
  - Strict MIME type verification and magic byte sniffing are performed before upload.
