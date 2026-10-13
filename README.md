# VyaparMedia — India's Premier Influencer Marketing & Escrow Marketplace

> **Production Platform Baseline** | Next.js 16.2.6 (App Router) · React 19.2.6 · TypeScript 5 · Prisma ORM 6.19.3 · Base UI · Tailwind CSS · Upstash Redis & ioredis · Razorpay & Route · Shiprocket

VyaparMedia is an enterprise-grade fintech and marketing marketplace connecting direct-to-consumer (D2C) brands, digital marketing agencies, and corporate sponsors with verified content creators through legally binding digital contracts, milestone-based escrow payments, automated Indian tax compliance (TDS Section 194-O, GST, PAN), and integrated courier logistics.

---

## 1. Key Value Propositions

- **100% Escrow Protection**: Upfront brand funding locked in double-entry ledger escrow holds. Eliminates creator payment default and brand delivery risks.
- **Digital Reputation Score (DRS 0–900)**: Algorithmic creator credibility rating based on on-time delivery rates, verified review sentiment, dispute history, and fraud flags with time-decay recency.
- **Legally Binding Digital Contracts**: Cryptographic SHA-256 contracts with itemized deliverables, revision terms, and dual digital signatures.
- **Automated Indian Tax Compliance**: Real-time Section 194-O (0.1%), Section 206AA (5%), and Section 194J TDS calculations, GST state-code extraction, and encrypted PAN verification.
- **Physical Product Seeding Logistics**: End-to-end Shiprocket courier booking, AWB generation, automated tracking webhooks, and brand wallet courier billing.
- **Zero-Trust Anti-Disintermediation**: Real-time contact leak detection (phone, email, UPI, external messaging handles) preventing off-platform platform bypass.
- **Accessible Instagram-Inspired Design**: OLED dark mode, 44pt minimum touch targets, `tabular-nums` financial counters, and WCAG 2.1 AA dual-coded semantic indicators.

---

## 2. Complete Application Page & Route Catalog

The platform encompasses **55 distinct page entrypoints** organized cleanly across public marketing, authentication/onboarding, dynamic creator portfolios, authenticated user dashboards, admin governance, and system error boundaries:

### 2.1 Public Marketing & Informational Routes
| Route | Source File | Purpose & Description |
| :--- | :--- | :--- |
| `/` | `src/app/page.tsx` | Landing page featuring hero product mockup, trust metrics, escrow value props, and creator showcase |
| `/about` | `src/app/about/page.tsx` | Company mission, founding team, vision, and enterprise escrow security overview |
| `/help` | `src/app/help/page.tsx` | Categorized FAQ & Help Center with real-time query search, category filters, and support ticket escalation |
| `/pricing` | `src/app/pricing/page.tsx` | Platform fee structure, transparent pricing breakdown, and interactive accessible FAQ accordion |
| `/contact` | `src/app/contact/page.tsx` | Support contact form, corporate office details, and enterprise inquiry routing |
| `/blog` | `src/app/blog/page.tsx` | Influencer marketing insights, industry benchmarks, and creator growth guides |
| `/legal` | `src/app/legal/page.tsx` | Central legal hub, master platform terms, escrow rules, and regulatory governance |
| `/privacy` | `src/app/privacy/page.tsx` | Digital Personal Data Protection (DPDP) Act privacy policy, PII encryption disclosure |
| `/terms` | `src/app/terms/page.tsx` | Terms of Service governing Brand and Influencer marketplace participation |
| `/refund` | `src/app/refund/page.tsx` | Escrow cancellation, refund timelines, dispute settlement, and fee return policies |
| `/cookie-policy` | `src/app/cookie-policy/page.tsx` | Session cookies, local storage, analytics, and security tracking disclosures |

### 2.2 Authentication & User Onboarding
| Route | Source File | Purpose & Description |
| :--- | :--- | :--- |
| `/login` | `src/app/login/page.tsx` | Email/Phone + password login with 2FA TOTP verification and rate-limited attempts |
| `/register` | `src/app/register/page.tsx` | 2-step registration with 6-digit OTP verification, role selection, and referral binding |
| `/onboarding` | `src/app/onboarding/page.tsx` | Multi-step role-specific profile wizard for Creators (socials, rates) and Brands (GSTIN, company info) |
| `/forgot-password` | `src/app/forgot-password/page.tsx` | Secure password reset request via rate-limited email token dispatch |
| `/reset-password` | `src/app/reset-password/page.tsx` | Cryptographic token-authenticated password update form |

### 2.3 Dynamic Public Portfolios
| Route | Source File | Purpose & Description |
| :--- | :--- | :--- |
| `/creator/[username]` | `src/app/creator/[username]/page.tsx` | Public SEO-indexed creator profile: Instagram/YouTube stats, verified badges, DRS score, rate slabs, campaign proof modal, and direct collaboration CTA |

### 2.4 User Dashboard (`/dashboard`)
| Route | Source File | Purpose & Description |
| :--- | :--- | :--- |
| `/dashboard` | `src/app/dashboard/page.tsx` | Central command center: active deals, wallet summary, notifications, and quick actions |
| `/dashboard/campaigns` | `src/app/dashboard/campaigns/page.tsx` | Campaign management (Brand: my campaigns; Creator: discovery & open briefs) |
| `/dashboard/campaigns/create` | `src/app/dashboard/campaigns/create/page.tsx` | Multi-step campaign creation wizard with budget escrow calculator |
| `/dashboard/campaigns/[id]` | `src/app/dashboard/campaigns/[id]/page.tsx` | Campaign detail view, deliverables specification, applicant management, and status |
| `/dashboard/campaigns/[id]/roi` | `src/app/dashboard/campaigns/[id]/roi/page.tsx` | Campaign ROI report: 4-tier category benchmarks, predictive matchmaking accuracy, and A4 print export |
| `/dashboard/applications` | `src/app/dashboard/applications/page.tsx` | Application tracker (proposals sent by creator or received by brand) |
| `/dashboard/deals` | `src/app/dashboard/deals/page.tsx` | Active and past collaboration deal roster with milestone status pills |
| `/dashboard/deals/[id]` | `src/app/dashboard/deals/[id]/page.tsx` | Full deal lifecycle room: contract terms, timeline, draft submission, revision requests |
| `/dashboard/deals/[id]/dispute` | `src/app/dashboard/deals/[id]/dispute/page.tsx` | Formal dispute initiation form with escrow freezing and evidence upload |
| `/dashboard/disputes` | `src/app/dashboard/disputes/page.tsx` | Active dispute roster and arbitration status monitoring |
| `/dashboard/disputes/[id]` | `src/app/dashboard/disputes/[id]/page.tsx` | Dispute evidence room, timeline, and administrative settlement view |
| `/dashboard/influencers` | `src/app/dashboard/influencers/page.tsx` | Creator discovery feed with composite search, category filters, and bookmarking |
| `/dashboard/influencers/[id]` | `src/app/dashboard/influencers/[id]/page.tsx` | Dashboard creator dossier with verified reach and direct offer issuance |
| `/dashboard/messages` | `src/app/dashboard/messages/page.tsx` | Real-time deal messaging channel with contact leak protection and offer triggers |
| `/dashboard/notifications` | `src/app/dashboard/notifications/page.tsx` | Notification center: categorized alerts, unread counters, and preference controls |
| `/dashboard/wallet` | `src/app/dashboard/wallet/page.tsx` | Escrow wallet: ledger breakdown, Razorpay top-ups, penny-drop bank linking, instant withdrawal requests |
| `/dashboard/analytics` | `src/app/dashboard/analytics/page.tsx` | Performance charts: campaign ROI, influencer reach, engagement, and GMV |
| `/dashboard/leaderboard` | `src/app/dashboard/leaderboard/page.tsx` | DRS reputation leaderboard, gamification rankings, and top performer tiers |
| `/dashboard/badges` | `src/app/dashboard/badges/page.tsx` | Creator achievement badges, verification milestones, and challenge awards |
| `/dashboard/referrals` | `src/app/dashboard/referrals/page.tsx` | Referral program dashboard: invite links, referred user ledger, commission payouts |
| `/dashboard/settings` | `src/app/dashboard/settings/page.tsx` | User profile settings, 2FA TOTP setup, password updates, and notification controls |
| `/dashboard/support` | `src/app/dashboard/support/page.tsx` | Customer support ticketing, help desk inquiries, and ticket history |

### 2.5 Admin Governance Portal (`/admin`)
| Route | Source File | Purpose & Description |
| :--- | :--- | :--- |
| `/admin` | `src/app/admin/page.tsx` | System overview, platform health metrics, GMV, and active escrow volumes |
| `/admin/analytics` | `src/app/admin/analytics/page.tsx` | Macro platform growth metrics, retention curves, and category breakdowns |
| `/admin/applications` | `src/app/admin/applications/page.tsx` | Platform-wide application monitoring and moderation |
| `/admin/audit-logs` | `src/app/admin/audit-logs/page.tsx` | Append-only immutable security audit logs with cryptographic action records |
| `/admin/benchmarks` | `src/app/admin/benchmarks/page.tsx` | Category benchmark registry & dynamic ROI scoring weight tuning console |
| `/admin/disputes` | `src/app/admin/disputes/page.tsx` | Arbitration court: pending dispute cases and escrow arbitration controls |
| `/admin/disputes/[id]` | `src/app/admin/disputes/[id]/page.tsx` | Evidence review room, party statements, and split-settlement release execution |
| `/admin/financial` | `src/app/admin/financial/page.tsx` | Platform fee ledger, escrow balance reconciliation, and drift audit |
| `/admin/newsletter` | `src/app/admin/newsletter/page.tsx` | Platform broadcasts, system announcements, and email campaigns |
| `/admin/payouts` | `src/app/admin/payouts/page.tsx` | RazorpayX payout queues, pending withdrawals, and batch approval controls |
| `/admin/suspicious-reviews` | `src/app/admin/suspicious-reviews/page.tsx` | Suspicious review fraud detection, sentiment collusion audit & moderation console |
| `/admin/users` | `src/app/admin/users/page.tsx` | User directory, account bans, role changes, and trust score overrides |
| `/admin/verifications` | `src/app/admin/verifications/page.tsx` | KYC queue: pending PAN/Aadhaar/GST documents awaiting approval |
| `/admin/verifications/[id]` | `src/app/admin/verifications/[id]/page.tsx` | Detailed KYC document inspection and manual verification decision panel |
| `/admin/violations` | `src/app/admin/violations/page.tsx` | Contact leak flags, abusive content logs, and penalty tier management |

### 2.6 System & Error Boundaries
| Route / Boundary | Source File | Purpose & Description |
| :--- | :--- | :--- |
| `/not-found` (404) | `src/app/not-found.tsx` | Branded 404 recovery page with Return Home, Support, Browse FAQ CTAs, quick destination grid, and 100% escrow protection footer |
| App Error (500) | `src/app/error.tsx` | Root error boundary with polite user message and retry button |
| Global Error | `src/app/global-error.tsx` | Fallback html/body error boundary for catastrophic rendering failures |
| Dashboard Error | `src/app/dashboard/error.tsx` | Scoped dashboard error boundary isolating dashboard component failures |

---

## 3. SEO Sitemap (`src/app/sitemap.ts`)

Next.js dynamically generates `/sitemap.xml` for search indexing:

```text
https://vyaparmedia-nine.vercel.app/             (Priority: 1.0, Weekly)
https://vyaparmedia-nine.vercel.app/campaigns    (Priority: 0.8, Hourly)
https://vyaparmedia-nine.vercel.app/leaderboard  (Priority: 0.7, Daily)
https://vyaparmedia-nine.vercel.app/about        (Priority: 0.6, Monthly)
https://vyaparmedia-nine.vercel.app/help         (Priority: 0.7, Weekly)
https://vyaparmedia-nine.vercel.app/legal        (Priority: 0.3, Monthly)
https://vyaparmedia-nine.vercel.app/privacy      (Priority: 0.3, Monthly)
https://vyaparmedia-nine.vercel.app/terms        (Priority: 0.3, Monthly)
https://vyaparmedia-nine.vercel.app/refund       (Priority: 0.3, Monthly)
https://vyaparmedia-nine.vercel.app/cookie-policy(Priority: 0.3, Monthly)
```

Robots directives (`src/app/robots.ts`) grant crawler access to public pages while strictly disallowing private and administrative sections (`/api/*`, `/admin/*`, `/dashboard/*`).

---

## 4. UI Architecture & Design System

- **UI Primitives**: Headless `@base-ui/react` (v1.8.0) primitives with Tailwind styling (`@/components/ui`).
- **Responsive Shell**:
  - Desktop: Collapsible sidebar (`DesktopSidebar`) with role-based navigation and wallet preview.
  - Mobile: Fixed bottom bar (`MobileBottomBar`) with 44pt tap targets and safe-area inset protection.
  - Story Bar: Horizontal Instagram-style highlight strip (`EscrowStoriesBar`).
- **Accessibility**: Dual-coded status badges (Lucide icon + text + semantic token), zero layout jitter via `tabular-nums`, and universal `prefers-reduced-motion` reset.

---

## 5. Development & Verification Commands

```bash
# Setup environment configuration
cp .env.example .env

# Install dependencies
npm install

# Run development server (http://localhost:3000)
npm run dev

# Run action-button premature exposure regression guard (49 mutating buttons verified)
npm run lint:actions

# Run semantic design token consistency check (579 source files verified)
npm run lint:theme

# Run full project validation (ESLint + Theme + Actions + TypeScript + Prisma)
npm run validate

# Run automated Vitest test battery (50 test files, 546 passed tests)
npm test

# Run full pre-deployment pipeline (validate + test + build)
npm run deploy:check
```

---

## 6. Architecture & Product Documentation

For deep technical specifications, refer to canonical repository references:
- **[PRD.md](./PRD.md)** — Comprehensive Master Product Requirements Document (v3.4)
- **[PAGE_INVENTORY.md](./PAGE_INVENTORY.md)** — 55-Page Master Catalog & Verified Route Directory
- **[ARCHITECTURE_PATTERNS.md](./ARCHITECTURE_PATTERNS.md)** — Codebase Architecture, File Conventions & Cross-Cutting Standards
- **[DESIGN_TOKENS.md](./DESIGN_TOKENS.md)** — Design Tokens, Typography, Dark Mode Palettes, and WCAG AA Specifications
- **[MESSAGES.md](./MESSAGES.md)** — Centralized User-Facing Message Architecture & Error Sanitization Catalog
- **[DEPLOY.md](./DEPLOY.md)** — Complete Production Deployment, Core Architecture, Indian Compliance & Integrations Manual
- **[ACTION_VALIDATION_AUDIT.md](./ACTION_VALIDATION_AUDIT.md)** — System-Wide Action Validation, Gating & Eligibility Audit
- **[FEATURE_VERIFICATION.md](./FEATURE_VERIFICATION.md)** — End-to-End Feature Tracing & Verification Report (18 Core Features)
- **[.env.example](./.env.example)** — Master Environment Variable Template (18 sections, 0 drift)


