# Telemetry & User Consent Architecture Specification

> **Document Status**: Complete Engineering Specification  
> **Repository Target**: `vyaparmedia`  
> **Specification ID**: `docs/design/telemetry-consent.md`  
> **Date**: November 22, 2026  
> **Legal Notice**: Contains technical designs requiring regulatory validation under India's Digital Personal Data Protection (DPDP) Act, 2023.

---

## 1. Executive Overview

VyaparMedia operates a high-trust marketplace connecting brands, creators, and mediators. To deliver performant creator discovery, optimize campaign application funnels, and detect platform bottlenecks without compromising user privacy, this specification establishes the two-tier telemetry architecture:

```
+---------------------------------------------------------------------------------------------------+
|                                  TWO-TIER TELEMETRY ARCHITECTURE                                  |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  Tier A: Anonymous Aggregate Analytics                                                            |
|  ├── Purpose: Route performance, scroll depth, active dwell time, funnel conversion bottlenecks   |
|  ├── User Identification: NONE (userId is strictly null)                                         |
|  ├── Cookies: ZERO cookies used (no persistent cookies, no cross-site cookies)                    |
|  ├── Session Tracking: Ephemeral per-tab random UUID in sessionStorage                            |
|  ├── Cryptographic Hash: HMAC-SHA256(tabId, ServerDailySalt)                                      |
|  ├── IP & User-Agent: STRIPPED at edge. Only coarse deviceType (desktop/mobile/tablet) retained   |
|  └── Regulatory Status: [NEEDS LEGAL REVIEW: DPDPA 2023 §4(1) Legitimate Uses vs Anonymized Telemetry] |
|                                                                                                   |
|  Tier B: Identified Analytics ("Who viewed my profile / campaign")                                |
|  ├── Purpose: High-intent engagement alerts for creators ("Brand X viewed your rate card")        |
|  ├── Prerequisite: Explicit, informed, affirmative consent stored per user                       |
|  ├── Consent Attributes: telemetryConsent (boolean), telemetryConsentAt (UTC), version (string)   |
|  ├── Server-Side Gate: Enforced in backend ingest route; ignores client identity without consent   |
|  ├── User Controls: Instant opt-out toggle in /dashboard/settings                               |
|  └── Data Lifecycle: 30-day raw retention limit with automated background purging                |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Regulatory Compliance: DPDP Act 2023 & ASCI

### 2.1 Anonymous Aggregate Analytics: [NEEDS LEGAL REVIEW]
> **LEGAL REVIEW NOTICE**: Under the Digital Personal Data Protection (DPDP) Act 2023 (Section 3 and Section 4), personal data is defined as any data about an individual who is identifiable by or in relation to such data.
> Purely anonymized telemetry where:
> 1. No IP addresses are stored or logged;
> 2. No persistent cookies or device fingerprints are planted;
> 3. Identifiers are salted with a daily-rotating key, mathematically preventing cross-day correlation;
> is designed to fall outside the scope of "personal data" because individuals cannot be re-identified.
> **Action Item for Legal Counsel**: Confirm whether Section 4(1) exemption applies or if explicit affirmative consent is required prior to firing any anonymous telemetry events on public landing pages.

### 2.2 Identified Analytics: Strict Consent Mandate
For identified events (where `userId` and `role` are linked to profile visits):
- **Affirmative Action**: Pre-ticked checkboxes or implicit scroll-based consent are prohibited.
- **Granular Notice**: Users must be told specifically that brands or creators will see that they viewed a profile.
- **Right to Withdraw**: Users can withdraw consent at any time via `/dashboard/settings`. Withdrawal takes effect immediately on subsequent telemetry ingest.
- **Auditability**: Every consent grant or revocation is recorded with timestamp and active policy version.

---

## 3. Ephemeral Session Hashing & Privacy Plumbing

### 3.1 Client-Side Session Generation
```typescript
// Pure client logic: src/lib/telemetry/client-session.ts
export function getOrCreateTabSessionId(): string {
  if (typeof window === "undefined") return "";
  let tabId = sessionStorage.getItem("vm_telemetry_tab_id");
  if (!tabId) {
    tabId = crypto.randomUUID();
    sessionStorage.setItem("vm_telemetry_tab_id", tabId);
  }
  return tabId;
}
```

### 3.2 Server-Side Daily Rotating Salt & Session Hashing
To prevent long-term tracking of users across sessions:
1. The server maintains a daily rotating salt derived from `TELEMETRY_SALT_SECRET` and the current date (`YYYY-MM-DD` in Asia/Kolkata).
2. The `sessionHash` stored in the database is computed as:
   $$\text{sessionHash} = \text{HMAC-SHA256}(\text{clientTabId}, \text{DailySalt})[0..31]$$
3. Because the salt changes every midnight IST, yesterday's session hash cannot be correlated with today's session hash, even if the user kept the browser tab open.

```typescript
// Pure logic: src/lib/telemetry/salt.ts
import { createHmac } from "node:crypto";

export function computeDailySessionHash(
  clientTabId: string,
  serverSecret: string,
  dateStr: string // YYYY-MM-DD in Asia/Kolkata
): string {
  return createHmac("sha256", `${serverSecret}:${dateStr}`)
    .update(clientTabId)
    .digest("hex")
    .slice(0, 32);
}
```

---

## 4. Database Schema Contract

### 4.1 Raw Events Table (`PageViewEvent`)
```prisma
model PageViewEvent {
  id                 String    @id @default(cuid())
  sessionHash        String    // 32-char hex derived from daily salted HMAC
  userId             String?   // Set ONLY when user consented to identified telemetry
  role               String?   // INFLUENCER | BRAND | ADMIN (only when userId is set)
  routeKey           String    // Normalized route: e.g. "CREATOR_PROFILE", "CAMPAIGN_DETAIL"
  targetInfluencerId String?   // For profile impression analytics
  targetCampaignId   String?   // For campaign discovery analytics
  deviceType         String    // "desktop" | "mobile" | "tablet" (No raw User-Agent)
  referrerHost       String?   // Sanitized host only (no query strings or PII)
  activeMs           Int       // Active foreground dwell time in milliseconds
  maxScrollPct       Int       // Maximum scroll depth reached (0 - 100)
  createdAt          DateTime  @default(now())

  user               User?     @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([routeKey, createdAt])
  @@index([targetInfluencerId, createdAt])
  @@index([targetCampaignId, createdAt])
}
```

### 4.2 Aggregated Rollup Tables
Raw events are aggregated daily into compact rollups and purged after 30 days:

```prisma
model DailyRouteStat {
  date           DateTime @db.Date // Truncated to day in Asia/Kolkata
  routeKey       String
  uniqueVisitors Int      // Count of distinct sessionHash values
  pageViews      Int      // Total event count
  avgActiveMs    Int      // Mean active dwell time
  avgScrollPct   Int      // Mean maxScrollPct
  bounceBps      Int      // Bounces in basis points (activeMs < 5000 & maxScrollPct < 25)

  @@id([date, routeKey])
}

model DailyFunnelStat {
  date      DateTime @db.Date
  funnelKey String   // e.g. "CAMPAIGN_APPLICATION", "CREATOR_ONBOARDING"
  stepKey   String   // e.g. "VIEW_BRIEF", "ENTER_RATES", "SUBMIT_PITCH"
  sessions  Int      // Distinct sessions reaching this funnel step

  @@id([date, funnelKey, stepKey])
}
```

---

## 5. Server-Side Consent & Ingest Pipeline

```
[Incoming POST /api/telemetry/event]
                   │
                   ▼
  [Step 1: Check Feature Flag: telemetry_anonymous]
  ├── If OFF -> HTTP 200 { status: "disabled" } (No DB write)
  └── If ON -> Proceed to Step 2
                   │
                   ▼
  [Step 2: Payload Validation (Zod .strict())]
  ├── Verify: routeKey, activeMs >= 0, maxScrollPct (0-100), deviceType
  └── Reject: Any request attempting to pass IP, headers, or unescaped strings
                   │
                   ▼
  [Step 3: Identity & Consent Verification]
  ├── If caller session exists AND caller requested identified logging:
  │     ├── Check Feature Flag: telemetry_identified
  │     ├── Verify caller User.telemetryConsent === true in DB / Redis cache
  │     └── If both TRUE -> Persist event with userId and role
  └── Else:
        └── Strip userId, role -> Persist event as purely ANONYMOUS
                   │
                   ▼
  [Step 4: Async Insertion (p95 < 50 ms)]
  └── Insert into PageViewEvent with sanitized referrerHost & sessionHash
```

---

## 6. Retention & Purge Protocol

1. **Raw Events (`PageViewEvent`)**:
   - Retention: **30 calendar days**.
   - Purged daily by background cron (`/api/cron/cleanup-telemetry`).
2. **Aggregated Statistics (`DailyRouteStat`, `DailyFunnelStat`)**:
   - Retention: **Indefinite**.
   - Contains zero personal data, zero session hashes, and zero user identifiers. Fully compliant with DPDP Act statutory data minimization principles.
