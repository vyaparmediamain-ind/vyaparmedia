# VyaparMedia Dead Code, Unused Exports & Dependencies Audit (`docs/audit/dead-code.md`)

> **Audit Date**: November 24, 2026  
> **Auditor**: Antigravity Tooling using Knip 6.48.0 (Official Tooling) & Custom AST Rules  
> **Status**: Verified Clean & Enforced  

---

## 1. Executive Summary & Before / After Metrics

| Dimension | Baseline / Before | After Cleanup | Status / Outcome |
| :--- | :---: | :---: | :--- |
| **Unused Files** | 1 (`src/components/discovery/index.ts`) | **0** | Deleted orphan barrel file |
| **Unused Dependencies** | 3 (`autoprefixer`, `motion-dom`, `motion-utils`) | **0** | Removed legacy / transitive packages from `package.json` |
| **Unused DevDependencies** | 2 (`vite-tsconfig-paths`, `@types/bcryptjs`) | **0** | Removed redundant packages (native vitest alias & built-in types) |
| **Unlisted Dependencies** | 3 (`dotenv`, `fast-check`, `autocannon`) | **0** | Added explicitly to `package.json#devDependencies` |
| **Dead UI: Noop Handlers (`onClick={() => {}}`)** | 0 | **0** | Guarded by ESLint rule & Vitest invariant suite |
| **Dead UI: Placeholder (`href="#"`)** | 0 | **0** | Guarded by ESLint rule & Vitest invariant suite |
| **Dead UI: Disabled-Forever Controls** | 0 | **0** | Gated solely via `src/lib/action-eligibility.ts` |
| **Dead UI: Commented-out JSX** | 0 | **0** | 100% active production markup |
| **TypeScript Diagnostics** | 0 errors | **0 errors** | Clean `tsc --noEmit` verification |
| **Full Validation (`npm run validate`)** | Green | **Green** | ESLint + Theme tokens + Action buttons + RLS + Prisma |
| **Vitest Test Suite (`npm test`)** | 2099 tests | **2099 passed** | 100% passing across node & dom projects |

---

## 2. Knip Configuration (`knip.json`)

Knip was integrated with Next.js App Router, Vitest, and Playwright entry awareness:

```json
{
  "$schema": "https://unpkg.com/knip@5/overview/config-schema.json",
  "entry": [
    "src/app/**/{page,layout,route,loading,error,not-found,global-error,template,default}.{ts,tsx,js,jsx}",
    "src/app/**/{manifest,robots,sitemap}.{ts,js}",
    "sentry.*.config.ts",
    "scripts/**/*.{ts,tsx,js,mjs,cjs}",
    "load-tests/**/*.{ts,js,mjs}",
    "tests/**/*.{ts,tsx,js}"
  ],
  "project": [
    "src/**/*.{ts,tsx,js,jsx}",
    "scripts/**/*.{ts,tsx,js,mjs,cjs}",
    "load-tests/**/*.{ts,js,mjs}",
    "tests/**/*.{ts,tsx,js}"
  ],
  "ignoreDependencies": [
    "k6",
    "@auth/core"
  ]
}
```

Config verification confirmed zero false positives on known-used files across App Router, scripts, load tests, and test suites.

---

## 3. Detailed Triage of Findings

### A. Unused Files
| File | Action | Evidence & Rationale |
| :--- | :---: | :--- |
| `src/components/discovery/index.ts` | **DELETE** | Orphan barrel re-exporting discovery components (`DiscoveryFeed`, `CampaignDiscoveryCard`, etc.). All active pages (`/dashboard/influencers`, `/dashboard/campaigns`) and test files import directly from individual component files or `@/components/ui`. Zero external or internal imports. |

### B. Unused Dependencies
| Package | Action | Evidence & Rationale |
| :--- | :---: | :--- |
| `autoprefixer` | **DELETE** | Tailwind CSS v4 in this repository uses `@tailwindcss/postcss` exclusively (verified in `postcss.config.mjs`). Autoprefixer is an obsolete Tailwind v3 artifact. |
| `motion-dom` | **DELETE** | Package is an internal utility of `framer-motion` and `motion`. Zero direct imports exist anywhere in `src/` or `tests/`. |
| `motion-utils` | **DELETE** | Package is an internal utility of `framer-motion` and `motion`. Zero direct imports exist anywhere in `src/` or `tests/`. |
| `vite-tsconfig-paths` | **DELETE** | Vitest configuration (`vitest.config.ts:28-34`) resolves `@/*` aliases using native `resolve.alias`. `vite-tsconfig-paths` was unused. |
| `@types/bcryptjs` | **DELETE** | `bcryptjs` v3 ships with built-in TypeScript definitions. Removing `@types/bcryptjs` resulted in 0 TypeScript compiler diagnostics. |

### C. Unlisted Dependencies
| Package | Action | Evidence & Rationale |
| :--- | :---: | :--- |
| `dotenv` | **ADD (dev)** | Imported in `scripts/setup-qstash-crons.ts`, `tests/setup.ts`, and `scripts/mock-server-only.cjs`. Moved from transitive dependency to explicit devDependency. |
| `fast-check` | **ADD (dev)** | Imported in property invariant test suite `tests/unit/property-invariants.test.ts`. Explicitly declared in devDependencies. |
| `autocannon` | **ADD (dev)** | Imported in `load-tests/run-autocannon.mjs`. Explicitly declared in devDependencies. |
| `k6` | **KEEP (ignored)** | Binary executable for k6 load testing invoked via `k6 run`. Added to `knip.json#ignoreDependencies`. |
| `@auth/core` | **KEEP (ignored)** | Types re-exported by NextAuth v5 in `src/lib/auth.ts`. Packaged transitively by `next-auth`. Added to `knip.json#ignoreDependencies`. |

### D. Candidate Backend Routes
| Route | File | Action | Triage Rationale |
| :--- | :--- | :---: | :--- |
| `/api/telemetry/event` | `src/app/api/telemetry/event/route.ts` | **KEEP** | Complete authenticated, rate-limited endpoint implementing `PageViewEventInputSchema`. Retained as a direct REST fallback to beacon dispatch (`/api/telemetry/track`) for API consumers and server-to-server tracking. |
| `/api/upload/confirm` | `src/app/api/upload/confirm/route.ts` | **KEEP** | Server-side security post-verification hook inspecting magic bytes, SVG content, and file dimensions for direct client-to-S3/R2 presigned upload workflows. |

---

## 4. Dead UI & Action Gating Audit

Scanned all 302 JSX/TSX source files using AST regex inspection:

1. **Noop Handlers (`onClick={() => {}}`)**: 0 occurrences.
2. **Placeholder Anchors (`href="#"`)**: 0 occurrences.
3. **Disabled-Forever Controls (`disabled={true}`)**: 0 uncontrolled instances. Only 2 purposefully disabled action buttons exist, and both enforce explicit business eligibility with tooltip reasons per AGENTS.md §1 Action-Button Rule:
   - `src/app/dashboard/deals/[id]/page.tsx:710`: Disabled dispute trigger with `title={disputeEligibility.reason}`.
   - `src/components/profile/InfluencerProfileClient.tsx:427`: Disabled message trigger with `title={messageEligibility.reason}`.
4. **Commented-out JSX**: 0 occurrences.
5. **Enforcement Guards Added**:
   - **ESLint Plugin**: Added `dead-ui/no-noop-onclick` and `dead-ui/no-hash-href` in `eslint.config.mjs`.
   - **Vitest Invariant Test**: Created `tests/unit/dead-ui.test.ts` scanning all source files on CI runs.

---

## 5. Duplicate Logic & Helper Consolidation

1. **Currency & Conversion Helpers**:
   - `paiseToRupees(paise: number): string` consolidated centrally in `src/lib/csv-export.ts:130`.
   - `formatCurrency(amountInPaise)` consolidated centrally in `src/lib/utils-client.ts:4`.
   - `formatCurrencyPaise` consolidated in `src/lib/audit-formatters.ts:15`.
2. **Date & IST Timezone Helpers**:
   - `formatDate`, `formatDateTime`, `formatTime`, `formatRelativeTime` consolidated in `src/lib/utils-client.ts` with explicit `timeZone: "Asia/Kolkata"`.
   - Re-exports in `DealDetailHelpers.tsx` cleaned to point directly to `@/lib/utils-client`.
3. **Report Metadata & Integrity**:
   - Corporate headers, cryptographic verification seals, and data quality flags consolidated in `src/lib/report-meta.ts` and `src/services/report-verification.service.ts`.

---

## 6. Release & CI Checklist Integration

The Knip script is now wired into `package.json`:
```json
"scripts": {
  "knip": "knip"
}
```

- **Daily / Pre-Release Verification**: Run `npm run knip` to verify no new orphan files, unused dependencies, or unlisted packages are introduced.
- **Combined Validation Command**: `npm run validate && npm test`
