# Codebase Architecture & File/Folder Organization Standards

> **Canonical Reference for Antigravity & Engineering Team**  
> All future contributions, refactoring, and AI-assisted development across this repository (`vyaparmedia`) **MUST** strictly adhere to the patterns documented herein.

---

## 1. Directory Structure Taxonomy

The project follows a modular, feature-oriented structure designed for high scalability, clear separation of concerns, and clean discoverability.

```text
vyaparmedia/
├── prisma/                          # Database schema, migrations, and seed scripts
├── public/                          # Static assets (images, icons, manifest, sw.js)
├── scripts/                         # Operational & automated testing scripts
├── tests/                           # Vitest test suite (unit, integration, e2e)
│   ├── setup.ts
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── src/
    ├── app/                         # Next.js App Router (Pages, Layouts, API Route Handlers)
    │   ├── (auth)/                  # Auth route group
    │   ├── admin/                   # Admin portal views (benchmarks, suspicious-reviews, etc.)
    │   ├── api/                     # Backend REST & Webhook endpoints
    │   ├── dashboard/               # User dashboard views (deals, wallet, campaigns, ROI, etc.)
    │   ├── layout.tsx               # Root layout
    │   └── page.tsx                 # Landing page
    ├── components/                  # React UI components (Feature-scoped + UI Primitives)
    │   ├── admin/                   # Admin-specific UI panels & tables
    │   ├── analytics/               # Visual analytics dashboards & charts
    │   ├── dashboard/               # Dashboard feature folders (deals, wallet, messages, campaigns, etc.)
    │   ├── discovery/               # Search & discovery cards
    │   ├── landing/                 # Landing page sections
    │   ├── navigation/              # Header, footer, app shell navigation
    │   ├── notifications/           # Notification cards & bell triggers
    │   ├── profile/                 # Influencer/Brand profile components
    │   ├── pwa/                     # PWA install prompts & offline banners
    │   ├── register/                # Onboarding & registration flows
    │   ├── security/                # Two-factor & security controls
    │   └── ui/                      # Base design system primitives (Button, Modal, Toast, etc.)
    ├── hooks/                       # Reusable React hooks
    │   ├── api/                     # API query/mutation hooks (useWallet, useCampaigns, etc.)
    │   └── use*.ts                  # Client UI hooks (useChartWidth, useTheme, etc.)
    ├── lib/                         # Core utilities, API clients, security, schemas, DB
    │   ├── api-client/              # Universal client-side typed API fetcher
    │   ├── schemas/                 # Zod validation schemas
    │   ├── auth.ts                  # NextAuth / session management
    │   ├── db.ts                    # Prisma client singleton
    │   ├── redis.ts                 # Upstash Redis & Enterprise caching (ioredis)
    │   ├── logger.ts                # Structured Winston server-side logger
    │   └── utils-client.ts          # Client-side formatting & helpers
    ├── services/                    # Domain Service Layer (Backend Business Logic)
    │   ├── application/             # Application sub-domain modules
    │   ├── campaign/                # Campaign sub-domain modules
    │   ├── deal/                    # Deal lifecycle sub-domain modules
    │   ├── shiprocket.service.ts    # Physical product logistics & automated courier billing
    │   ├── campaign-roi.service.ts  # Relative ROI scoring & benchmark analytics
    │   ├── benchmark.service.ts     # Category benchmark registry & dynamic tuning
    │   ├── review-audit.service.ts  # Review fraud intelligence & collusion detection
    │   ├── razorpay-route.service.ts# Razorpay Route split settlement & RBI compliance
    │   └── *.service.ts             # Domain service facades (DealService, WalletService, etc.)
    └── types/                       # Shared global TypeScript definitions
```

---

## 2. Component Organization & UI Architecture Pattern

### 2.1 Directory Taxonomy & Feature-Folder Scoping
The UI codebase strictly isolates components by scope, domain, and lifecycle:

```text
src/components/
├── ui/                     # Universal Base UI primitives (Button, Modal, Input, Toast, Select, etc.)
│   └── index.ts            # Single barrel export for all primitives (@/components/ui)
├── navigation/             # App shell navigation & responsive frames
│   ├── DesktopSidebar.tsx  # Desktop fixed navigation drawer with role-based links
│   ├── MobileBottomBar.tsx # Mobile fixed bottom navigation with 44pt tap targets & safe-area insets
│   ├── EscrowStoriesBar.tsx# Instagram-style horizontal story strip for deal updates & highlights
│   └── RoleGuard.tsx       # Route access guard by authenticated role
├── discovery/              # Creator & Campaign discovery feed architecture
│   ├── DiscoveryFeed.tsx   # High-concurrency searchable & filterable feed
│   ├── CampaignDiscoveryCard.tsx # Campaign presentation card with quick-apply
│   ├── CreatorDiscoveryCard.tsx  # Influencer showcase card with DRS badge & metrics
│   ├── FilterBottomSheet.tsx     # Mobile-optimized slide-up filter sheet
│   └── PullToRefresh.tsx         # Mobile touch pull-to-refresh handler
├── profile/                # Creator portfolio & brand profile components
│   ├── InfluencerProfileClient.tsx # Interactive profile with rate cards & direct offer CTA
│   └── CampaignProofModal.tsx      # Modal displaying verified past deliverables
├── help/                   # Knowledge base & FAQ help center
│   └── HelpCenterClient.tsx# Interactive categorized FAQ search & ticket escalation
├── register/               # Multi-step onboarding & registration components
│   ├── OtpFields.tsx       # 6-digit individual numeric input with auto-advance & paste
│   ├── Step2RegistrationForm.tsx # Role selection & password confirmation
│   └── useRegistration.ts  # Client state machine with timer & sanitization
├── landing/                # Public marketing landing page components
│   ├── HeroProductMockup.tsx # Live platform preview mockup
│   └── LandingHelpers.tsx    # FAQ accordions, trust badges, feature callouts
├── dashboard/              # User dashboard feature modules
│   ├── home/               # Dashboard home client, action banners, & active feed
│   │   ├── DashboardHomeClient.tsx
│   │   ├── ActionRequiredBanner.tsx
│   │   └── ActiveDealsFeed.tsx
│   ├── deals/              # Deal list, contracts, milestones, dispute modal, steppers
│   │   └── DealProgressStepper.tsx
│   ├── wallet/             # Escrow ledger, bank accounts, withdrawal flow
│   ├── campaigns/          # Campaign creation wizard, applicant review
│   │   └── create/         # CreateCampaignClient, CampaignSummarySidebar, DeliverablesList
│   ├── messages/           # Deal-linked real-time chat & leak-protected messaging
│   ├── disputes/           # Evidence upload & arbitration timeline
│   ├── analytics/          # Reach, GMV, and conversion performance charts
│   └── settings/           # Profile settings, 2FA management, confirmation badges
├── admin/                  # Admin portal control panels & arbitration tools
├── analytics/              # Reusable Recharts wrapper components
├── notifications/          # Notification drawer & Web Push triggers
└── security/               # 2FA QR code modal & session revocations
```

### 2.2 Base UI Headless Primitives (`@base-ui/react`)
- VyaparMedia standardizes on `@base-ui/react` (v1.8.0) primitives styled exclusively with Tailwind CSS variables.
- **Barrel Import Rule**: All consumers **MUST** import primitives through `@/components/ui`:
  ```tsx
  import { Button, Modal, Card, Input, Toast, Select, EmptyState, Skeleton } from "@/components/ui";
  ```
- Primitives must never contain hardcoded domain business logic. They remain purely presentational, accessible (ARIA compliant, keyboard navigable), and theme-aware.

### 2.3 Responsive Navigation Shell Pattern
The application adapts seamlessly between desktop and mobile viewport constraints:
1. **Desktop Viewport (`md:` and above)**:
   - Renders `DesktopSidebar` on the left axis with role-differentiated menu groups (`INFLUENCER`, `BRAND`, `ADMIN`).
   - Displays real-time escrow wallet balances, collapsible section items, and quick action shortcuts.
2. **Mobile Viewport (below `md:`)**:
   - Renders `MobileBottomBar` pinned to the bottom of the screen.
   - Enforces **44pt minimum touch targets** (`.touch-target-44`) for all interactive icons and tabs.
   - Includes `padding-bottom: env(safe-area-inset-bottom)` to accommodate device home bars.
   - Pushes page content up via `pb-20 md:pb-0` to eliminate visual and tap interference.
3. **Escrow Stories Bar (`EscrowStoriesBar`)**:
   - Renders an Instagram-inspired horizontal scrollable story bar across feeds.
   - Showcases live platform escrow settlements, verified creator highlights, and system announcements.

### 2.4 Client vs. Server Component Boundaries
- **Server Component Page Shells (`page.tsx`)**: App Router route entrypoints must remain lightweight composability shells or Server Components that fetch initial data and validate sessions.
- **Interactive Feature Components (`"use client"`)**: Client boundaries must be pushed down to the leaf nodes or feature containers that manage state, form inputs, animations, or browser events.
- **No Monolithic Dashboard Files**: Page controllers must never exceed 250 lines; all complex UI logic must be decomposed into feature folders (`components/dashboard/<feature>/`).

### 2.5 Dual-Coded Accessibility & Numeric Precision
- **Dual-Coding**: Every status indicator or trust badge must pair a semantic color token (`verified`, `escrow`, `pending`, `disputed`) with a visible text label and Lucide icon. Never communicate status through color alone.
- **Tabular Numbers (`.tabular-nums`)**: All monetary figures, wallet counters, and percentage metrics must apply `.tabular-nums` (`font-variant-numeric: tabular-nums`) to prevent horizontal layout shift during counter animations.

### 2.6 Multi-Step Form Wizard Pattern
Complex multi-phase interactions (`src/app/onboarding/page.tsx`, `CreateCampaignClient.tsx`) must follow the progressive disclosure wizard pattern:
1. **Client State Machine**: An active step pointer (`currentStep: 1 | 2 | 3 | 4`) with explicit validation guards preventing forward advancement on incomplete data.
2. **Visual Stepper & Progress Bar**: Top-anchored visual stepper rendering completed checkmarks (`Check`, `bg-verified`), active ring indicator (`border-primary`), and upcoming muted steps.
3. **Sticky Summary Sidebar (Desktop)**: On desktop viewports, pair input forms with a sticky right sidebar (`CampaignSummarySidebar.tsx`) calculating real-time escrow deposits, platform fees (5%), and GST (18%) in bold `tabular-nums`.

### 2.7 Public-Facing PII Sanitization Boundary Pattern
Publicly accessible dynamic routes (`src/app/creator/[username]/page.tsx`) must strictly isolate sensitive private data:
1. **Server-Side Sanitization**: The Server Component invokes a dedicated formatter (`formatCreatorProfileData` in `src/lib/creator-profile.ts`) that extracts and validates only public marketing attributes.
2. **Strict Omission Policy**: Phone numbers, personal email addresses, PAN, GST, bank account numbers, residential addresses, and internal user flags are strictly stripped prior to serializing props to client components.

### 2.8 Server-Side Route Guard & Onboarding Completeness Pattern
To prevent orphan user journeys or incomplete profile access:
1. **Signup Funneling**: User registration immediately sets `callbackUrl=/onboarding` upon redirecting to `/login`.
2. **Dashboard Server Guard**: The root `src/app/dashboard/page.tsx` performs an atomic profile completeness check (verifying non-default categories, city, and required company/influencer attributes). If incomplete, it issues an immediate `redirect("/onboarding")`, ensuring new users cannot access dashboard features until completing onboarding.

### 2.9 Zero-Latency Categorized Search & Knowledge Base Pattern
Standalone help surfaces (`src/components/help/HelpCenterClient.tsx`) follow a high-concurrency client search pattern:
1. **Pure Filter Function (`filterFaqs`)**: Filter logic is decoupled into a pure, exported function tested independently via Vitest.
2. **Memoized Multi-Filter**: Uses React `useMemo` to filter across category pills (`GETTING_STARTED`, `PAYMENTS_ESCROW`, `DISPUTES_REVISIONS`, `KYC_SECURITY`) and real-time query substrings matching question, answer, and badge text simultaneously.
3. **Escalation Fallback**: Always pairs self-service documentation with an explicit escalation card linking directly to `/dashboard/support`.

### 2.10 Systematic Spacing & Vertical Rhythm Pattern
To prevent visual dissonance, cramped screens, or arbitrary white-space sprawl, all components and layouts adhere to a unified vertical rhythm hierarchy:
1. **Tier 1: List-Item Gap (`gap-2` / `space-y-2`, 8px)**: Micro-elements inside a list or card: badge tag clusters, filter pills, message bubble groups, flushed list rows (`divide-y divide-border`), compact stat tiles.
2. **Tier 2: Card Gap (`gap-4` / `space-y-4`, 16px)**: Sibling cards at the same hierarchy level: consecutive deal cards in a pipeline, campaign cards in a grid/list, stat metric cards in a grid (`grid gap-4`), form input field groupings.
3. **Tier 3: Sub-Section / Panel Gap (`gap-6` / `space-y-6`, 24px)**: Sub-sections, settings panels within a tab (`space-y-6`), spacing between `PageHeader` and top-level filter bar, or grouped card widgets.
4. **Tier 4: Major Section Gap (`gap-8` / `space-y-8`, 32px)**: Transitions between major independent screen sections on complex views: Hero banner to Active Collaborations to Financial Overview in `DashboardHomeClient`, or Ops Center sections.
5. **Container-Owned Spacing Rule**: Containers own the spacing between sibling elements via `space-y-*` or `gap-*`. Card components must **NOT** hardcode arbitrary bottom margins (`mb-3.5`, `mb-5`, `mb-7`) that conflict with container spacing.

---

## 3. Naming Conventions

| Entity | Convention | Example |
| :--- | :--- | :--- |
| **React Components** | **PascalCase** | `Button.tsx`, `Toast.tsx`, `Pagination.tsx`, `EscrowTrustCard.tsx` |
| **Component Sub-helpers** | **PascalCase** (with domain suffix) | `DealDetailHelpers.tsx`, `CampaignDetailHelpers.tsx` |
| **React Hooks** | **camelCase** (prefixed with `use`) | `useMessages.ts`, `useDealDetail.ts`, `useChartWidth.ts` |
| **Utility & Library Files** | **kebab-case** or **camelCase** | `utils-client.ts`, `clipboard.ts`, `contact-leak-detector.ts` |
| **Backend Services** | `{domain}.service.ts` | `deal.service.ts`, `wallet.service.ts`, `message.service.ts` |
| **Zod Schema Files** | `{domain}.schema.ts` | `deal.schema.ts`, `wallet.schema.ts`, `campaign.schema.ts` |
| **Next.js App Router Folders** | **kebab-case** or `[param]` | `deals/[id]/dispute/`, `audit-logs/`, `create/` |
| **Next.js App Router Files** | **Framework Lowercase** | `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts` |
| **TypeScript Types & Interfaces** | **PascalCase** | `interface DealDetail`, `type ToastType`, `type ApiResponse<T>` |
| **Constants** | **SCREAMING_SNAKE_CASE** | `ALL_CATEGORIES`, `DEFAULT_PAGE_SIZE`, `TRUST_TIER_LIMITS` |

---

## 4. Service-Layer Pattern (Backend)

The backend business logic adheres to the **Static Class Facade Pattern**:

### Structure:
```typescript
// src/services/wallet.service.ts
export class WalletService {
  private static readonly logger = logger.child({ service: "WalletService" });

  static async getBalance(userId: string) { ... }
  static async requestWithdrawal(userId: string, input: WithdrawInput) { ... }
}
```

### Domain Sub-folders:
- Single-file services (`auth.service.ts`, `message.service.ts`, `notification.service.ts`) are used for focused services.
- Sub-folder domains (`deal/`, `campaign/`, `application/`) are used when a domain has multiple high-complexity sub-flows:
  - Submodules handle specific actions (`create.ts`, `list.ts`, `action.ts`).
  - The root service file (`deal.service.ts`, `campaign.service.ts`, `application.service.ts`) serves as the public facade, delegating to internal submodules while providing a clean, cohesive API.

### Transaction Isolation & Escrow Guarantees:
- Any financial state transition (escrow locking, release, refund, withdrawal) **MUST** execute within an interactive `prisma.$transaction`.
- Database row locks (`SELECT ... FOR UPDATE`) and double-entry ledger recording (`WalletLedger` + `EscrowHold`) must be maintained at all times.

---

## 5. Export and Import Conventions

To eliminate inconsistency across the codebase, exports are strictly governed:

### Rule 1: Named Exports for All UI Components, Utilities, and Services
- All React components **MUST** be defined and exported as named exports:
  ```typescript
  export function Button({ variant, children }: ButtonProps) { ... }
  ```
- All services and utilities **MUST** use named exports:
  ```typescript
  export class DealService { ... }
  export function formatCurrency(amount: number): string { ... }
  ```
- *Backward compatibility:* For existing UI primitives, re-exporting default alongside named export is permitted (`export default ComponentName;`), but internal application code should prefer named imports (`import { Button, Modal } from "@/components/ui"`).

### Rule 2: Default Exports ONLY for Next.js App Router Special Files
- Next.js framework files require default exports:
  - `page.tsx` (`export default function Page() { ... }`)
  - `layout.tsx` (`export default function RootLayout() { ... }`)
  - `loading.tsx` (`export default function Loading() { ... }`)
  - `error.tsx` (`export default function ErrorBoundary() { ... }`)
  - `not-found.tsx` (`export default function NotFound() { ... }`)
- Never use default exports for regular internal components or service classes.

### Rule 3: Clean Path Aliasing
Always use the configured root alias `@/` instead of fragile relative paths:
- ✅ `import { Button } from "@/components/ui";`
- ✅ `import { DealService } from "@/services/deal.service";`
- ✅ `import { formatCurrency } from "@/lib/utils-client";`
- ❌ `import { Button } from "../../../components/ui/Button";`

---

## 6. Cross-Cutting Architectural Patterns (Canonical Standards)

To prevent code drift and ensure predictable development across all modules:

### 6.1 Unified Formatting Utilities (`src/lib/utils-client.ts`)
- **Currency (`formatCurrency`)**: All monetary figures MUST be parsed via `formatCurrency(amountInPaise)`. Never perform manual `Intl.NumberFormat` or inline `₹${...}` strings in components.
- **Dates (`formatDate`, `formatDateTime`, `formatTime`, `formatRelativeTime`)**: All calendar timestamps MUST use these shared helpers with consistent `en-IN` localization. Direct `.toLocaleDateString()` is strictly forbidden in UI components.
- **Numbers (`formatNumber`)**: Large counts (followers, views) use `formatNumber` to output clean Indian denominations (`10K`, `1.5L`, `1Cr`).

### 6.2 Standardized API Error Shape & Handling
- **Backend API Routes**: Standard error response envelope:
  ```json
  {
    "success": false,
    "error": "BAD_REQUEST",
    "message": "User-friendly, non-technical error description",
    "requestId": "req_xyz"
  }
  ```
- **Throwing Errors**: Throw typed `AppError` instances (`throw AppError.badRequest(...)`, `throw AppError.unauthorized(...)`). Caught automatically by `apiWrapper` with structured logging and metrics.
- **Client Consumption**: Client HTTP transport (`src/lib/api-client/http.ts`) unifies backend errors into `ApiClientError`, exposing `{ status, code, message }` and automatic 401 redirection to `/login`.

### 6.3 Fail-Fast Runtime Contract Safety (Zod Schemas)
- Every frontend API call must supply a Zod response schema:
  ```typescript
  export function listDeals() {
    return get("/api/deals", { schema: dealsListResponseSchema });
  }
  ```
- When using SWR or React Query, use `createSchemaFetcher(schema)`.
- If backend payload fields drift or rename, the client immediately throws `ZodError` at the boundary rather than corrupting UI state with `undefined`.

### 6.4 Skeleton Shimmer vs. Spinner Loading States
- **Data Loading (Pages, Cards, Feeds, Tables)**: MUST render shimmering `<Skeleton className="..." />` placeholders matching the geometric footprint of the expected content. Full-page or container-level spinners are forbidden.
- **Action Triggers (Buttons)**: `<Spinner size="sm" />` or button loading states (`loading={isSubmitting}`) are strictly reserved for inline user action feedback.

### 6.5 Modal & Sheet Base Component Family
- All dialogs must be built on `@/components/ui/Modal`:
  - Portalled to `document.body`
  - Framer Motion `AnimatePresence` with spring physics
  - Built-in Escape key listener and body scroll lock (`overflow-hidden`)
  - ARIA compliance (`role="dialog"`, `aria-modal="true"`)
- Mobile slide-up sheets extend this pattern via `@/components/discovery/FilterBottomSheet`.

### 6.6 Action-Button Rule (Premature-Exposure Prevention & UX Integrity)
**Core Mandate:** *Har naya state-changing button banate waqt, uska backend-rejection-condition pehle dhundo aur frontend-disabled-state me wire karo pehle hi — backend-error-response pe depend mat karo.*

#### The Anti-Pattern to Eliminate ("Premature Exposure"):
Leaving an action button enabled, letting the user fill forms or click with expectation of success, only to receive a toast or 400/403 `AppError` rejection from the backend (e.g., *"Wallet balance insufficient"*, *"Tax compliance required"*, *"Active dispute open"*, *"Product sample not received"*).

#### The 5-Step Action-Button Workflow:
1. **Find All Backend Rejections First**: Before styling or wiring a button/form, open the target API route and service layer. Catalogue every `throw`, `AppError`, rejections, balance requirement, ledger lock, KYC tier limit, or workflow deadline.
2. **Never Completely Hide Discoverable Triggers**: Do **NOT** hide action buttons just because prerequisites fail. If a feature exists (e.g., "Apply to Campaign", "Release Escrow Payment", "Cancel Deal", "Confirm Dispatch", "Accept Offer"), users need to discover that the platform capability exists. *Only exception:* Genuinely inapplicable user actions (e.g., "Message Yourself" on your own profile).
3. **Wire Frontend Disabled State**: Wire `disabled={isSubmitting || !eligibility.allowed}` using shared predicates. Never allow a click that will predictably fail on the server.
4. **Show Inline Specific Reason ("Why")**: Display an immediate, contextual badge, tooltip, or inline message explaining the exact reason:
   - *"Wallet balance insufficient — need ₹X more"*
   - *"Complete PAN tax verification before processing payouts"*
   - *"Physical product must be marked as received before submitting content"*
   - *"Creator authenticity score (32/100) is below platform threshold of 40"*
5. **Provide a Direct Fix-It CTA**: Link directly to the resolution flow:
   - `"Add Funds"` / `"Deposit ₹X"` → `/dashboard/wallet?topup=true`
   - `"Complete KYC"` / `"Verify Identity"` → `/dashboard/settings?tab=verification`
   - `"View Dispute"` → `/dashboard/disputes`
   - `"Confirm Delivery"` → Product Logistics section

#### Single-Implementation Rule (`src/lib/action-eligibility.ts`):
- All business rejection conditions must be authored in a **shared predicate function** inside `@/lib/action-eligibility.ts`.
- Both the backend API handler/service and the frontend React component must import and use this exact same predicate. Never duplicate eligibility logic across layers.

#### Dev-Time Automated Regression Check:
- Run `npm run lint:actions` (or `npm run validate`) to scan the codebase for any mutating buttons missing explicit `disabled` eligibility gating.
- If a button is strictly non-mutating (e.g. client-side tab switcher, slide-up filter sheet drawer), mark it with `{/* action-button-ignore */}`.

### 6.7 Razorpay Route Split Escrow Settlement Pattern
- **Direct Nodal Split Settlement**: Platform operates in accordance with RBI Payment Aggregator escrow regulations. Rather than pooling creator earnings into unregulated intermediate accounts, funds are settled directly to the Creator's linked Razorpay Route account.
- **Statutory Withholding**: Settlement automatically calculates and retains platform commissions (10%) and statutory Indian withholding taxes (TDS Section 194-O at 0.1% for verified PAN, or Section 206AA at 5% for unverified PAN).
- **Prerequisites & Webhook Reconciliation**:
  - Gated by Creator KYC Tier-2 verification (`PAN_VERIFIED`) and active Route account link.
  - Interactive Prisma transaction marks `EscrowHold.status = RELEASED` and generates `Transaction` record with `transferId`.
  - Asynchronous webhook listener (`/api/webhooks/razorpay/process`) reconciles `transfer.processed` and `transfer.failed` events with ledger idempotency.

### 6.8 Shiprocket Logistics & Brand-Wallet Courier Billing Pattern
- **End-to-End Product Seeding**: Deals requiring physical product sampling integrate with Shiprocket REST API.
- **Workflow State Coupling**:
  1. Creator submits delivery address via `AddressCollectionModal.tsx`.
  2. Brand confirms dispatch via `ProductFulfillmentCard.tsx`. Live courier rates are retrieved from Shiprocket.
  3. Brand wallet is atomically debited for the courier shipping fee (recorded as `Transaction` with category `SHIPPING_FEE`).
  4. Shiprocket order and AWB are generated with printable shipping label.
  5. Asynchronous tracking webhook (`/api/webhooks/shiprocket`) monitors shipment delivery.
  6. Creator's `Submit Content Draft` action remains disabled until product status is verified as `DELIVERED`.

### 6.9 Multi-Layer Redis Caching & O(1) Cache Version Invalidation Pattern
- **Multi-Layer Cache Architecture**: High-frequency read queries (Creator Discovery, Campaign Search, User Dashboard Analytics) consume Redis via `ioredis` with configured TTLs (60s to 300s).
- **O(1) Versioned Invalidation**: Rather than issuing expensive `KEYS` or `SCAN` commands across Redis, namespaces maintain an atomic monotonic version key (e.g. `search:version:campaigns`). Cache keys incorporate this version (`campaigns:v${version}:...`). On write mutations, `redis.incr(versionKey)` atomically renders all previous cached entries obsolete in O(1) time.
- **Fail-Open Resilience**: If Redis becomes unreachable, the client catches the connection error and falls back gracefully to direct PostgreSQL queries, preventing application downtime.

---

## 7. Content Hierarchy Conventions by Screen Archetype

Following reference consumer and creator platforms (Instagram, Collabr, CRED, Stripe), all application screens and cards are categorized into three clear visual grammar archetypes:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SCREEN CONTENT HIERARCHY ARCHETYPES                   │
├─────────────────────────┬─────────────────────────┬─────────────────────────┤
│    1. IMAGE-FIRST       │     2. TEXT-FIRST       │   3. HYBRID BALANCED    │
│  (Discovery / Profiles) │   (Settings / Utility)  │   (Deals / Campaigns)   │
├─────────────────────────┼─────────────────────────┼─────────────────────────┤
│ • Media leads (>50%)    │ • Zero decorative media │ • 44px logo visual      │
│ • Large aspect ratios   │ • 36–44px icon boxes    │ • 3-zone layout grammar │
│ • Overlay chips         │ • Bold primary info     │ • Deliverables + escrow │
│ • Minimal text payload  │ • Tabular mono numbers  │ • Expandable accordion  │
└─────────────────────────┴─────────────────────────┴─────────────────────────┘
```

### 7.1 Archetype A: Image-First (Discovery Feed & Creator Showcase)
*Applicable views:* `DiscoveryFeed.tsx`, `CreatorDiscoveryCard.tsx`, `InfluencerProfileClient.tsx`, `CampaignProofModal.tsx`.

1. **Visual Dominance**: The user's eye must land on visual authenticity and creator aesthetic before reading metadata. Media containers must occupy at least 50% of the initial card height.
2. **Aspect Ratio Standardization**:
   - **Discovery Feed Cards**: Standardized to `aspect-[16/10]` (`relative aspect-[16/10] w-full bg-muted overflow-hidden`).
   - **Portfolio Proof Grids**: Standardized to `aspect-square` (`1:1`) 3-column media grid (`grid-cols-2 sm:grid-cols-3`).
   - **Deliverable Proof Modal**: Standardized to `aspect-[9/16]` for vertical short-form video/reel deliverables.
   - **Profile Hero Avatar**: Standardized to 96px–112px (`w-24 h-24 sm:w-28 sm:h-28`) circular avatar surrounded by a vibrant gradient trust ring (`from-primary via-verified to-escrow`).
3. **Aspect-Ratio Protection (No Squishing)**:
   - All images **MUST** use Next.js `<Image>` with `fill` and `className="object-cover"`. Never apply fixed pixel dimensions that stretch or distort image ratios.
   - When an image is missing or loading, cards must render a branded gradient fallback (`bg-gradient-to-br`) with a monogram avatar and ambient glow, preserving the exact layout dimensions.
4. **Metadata Restraint**:
   - Overlaid high-contrast chips: Top-left DRS Trust Score badge (`DRS 780`) and top-right Niche pill (`Fashion & Beauty`).
   - Text below media is compact: 1-line bold creator name, single-line handle/location, and a 3-column micro-metrics row (Starting Rate, Followers, Engagement Rate). Text must never crowd the visual thumbnail.

### 7.2 Archetype B: Text-First (Information-Dense Utility & Lists)
*Applicable views:* `src/app/dashboard/settings/page.tsx`, `src/app/dashboard/notifications/page.tsx`, `VirtualizedTransactionList.tsx`, `BankAccountManager.tsx`, `IndiaTaxCompliancePanel.tsx`.

1. **Readability & Scanning Speed**: Primary utility screens require maximum information density, fast scanning, and zero visual friction.
2. **Zero Decorative Images**:
   - Never insert stock photos, marketing illustrations, or decorative banners into utility or financial screens. Every pixel of visual media must serve a functional purpose.
3. **Functional Icon Standards**:
   - Navigation & Tab Icons: 16px (`w-4 h-4`) in line with text labels.
   - Activity & Category Icons: 36px–44px rounded containers (`w-9 h-9 rounded-full` in ledger, `w-11 h-11 rounded-xl` in notifications) paired with semantic status tokens (`verified`, `escrow`, `pending`, `disputed`).
4. **Typographic Hierarchy**:
   - **Primary Label**: High-contrast bold (`text-sm font-bold text-foreground` or `text-xs sm:text-sm font-semibold text-foreground`).
   - **Secondary Description**: Muted, single-line or 2-line clamped (`text-xs text-muted-foreground line-clamp-2`).
   - **Financial & Time Precision**: Strict monospace tabular numbers (`font-mono tabular-nums text-foreground` or `text-verified`) for dates, timestamps, transaction references, and monetary amounts (`+ ₹15,000` / `- ₹5,000`).
   - **Section Headers**: Uppercase micro-labels (`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/80`).

### 7.3 Archetype C: Hybrid Balanced Cards (Deals & Campaigns)
*Applicable views:* `DealPipelineCard.tsx`, `CampaignDiscoveryCard.tsx`, `ActiveDealsFeed.tsx`.

1. **Balanced 50/50 Visual vs. Operational Data**: Deals and campaigns represent legal/financial commitments where brand identity and deliverable specifications are equally critical. Cards must balance immediate brand recognition with structured contractual data.
2. **Standard 44px Leading Visual Anchor**:
   - Brand logo avatar standardized at 44px (`w-11 h-11 rounded-xl overflow-hidden bg-muted border border-border shrink-0`).
   - Immediate brand recognition without consuming disproportionate vertical space. Fallback to 2-letter uppercase initials.
3. **3-Zone Horizontal Layout Grammar**:
   - **Zone 1 (Leading Visual)**: 44px brand logo avatar + verified shield pill.
   - **Zone 2 (Central Operational Data)**: Bold title, status badge with semantic color, "Due Soon" / "Action Required" indicator, partner link • formatted deadline, deliverable chips (`IG Reel ×1`, `IG Story ×2`).
   - **Zone 3 (Trailing Financial Anchor)**: Escrow state micro-label (`Escrow Locked` / `Escrow Released`), prominent formatted amount (`text-base sm:text-lg font-extrabold font-mono tabular-nums`), and explicit CTA button (`View Brief` / `Open Workroom`).
4. **Progressive Disclosure via Accordion**:
   - Granular milestone steppers, revision requests, dispute buttons, and message shortcuts are housed in an expandable accordion drawer (`DealPipelineCard.tsx`). The primary card remains compact, uncluttered, and scannable.

### 7.4 Content Hierarchy Matrix by Archetype

| Dimension | Archetype A: Image-First | Archetype B: Text-First | Archetype C: Hybrid Balanced |
| :--- | :--- | :--- | :--- |
| **Primary Goal** | Visual attraction, creator aesthetic | High scanning efficiency, ledger precision | Deal operational status & financial clarity |
| **Visual Media Ratio** | ≥ 50% card height | ≤ 10% (functional icon only) | ~20% (44px logo anchor) |
| **Media Aspect Ratio** | `16:10` (card), `1:1` (grid), `9:16` (proof) | None (36–44px icon containers) | 44px square / circular logo (`1:1`) |
| **Image Fit Strategy** | `fill`, `object-cover`, gradient fallback | Functional SVG icons only | `fill`, `object-cover`, monogram fallback |
| **Primary Typography** | `text-sm font-bold text-foreground` | `text-sm font-bold text-foreground` | `text-sm sm:text-base font-bold text-foreground` |
| **Secondary Typography** | `text-[11px] text-muted-foreground` | `text-xs text-muted-foreground line-clamp-2` | `text-xs text-muted-foreground` |
| **Financial / Numeric** | Compact badge (`Starting from ₹X`) | `font-mono tabular-nums` (`+ ₹15,000`) | `text-lg font-extrabold font-mono tabular-nums` |
| **Key Components** | `CreatorDiscoveryCard`, `InfluencerProfile` | `SettingsPage`, `Notifications`, `TransactionList` | `DealPipelineCard`, `CampaignDiscoveryCard` |

---

## 8. Definition of Done Checklist for New Features & Code Reviews

When writing new code, reviewing PRs, or developing features with Antigravity, verify against this checklist:

1. [ ] **Action-Button Rule (Premature-Exposure Prevention)**: Has every state-changing / API-triggering button or form pre-checked its backend rejection conditions? Is it disabled with `disabled={!eligibility.allowed}`?
2. [ ] **Single-Implementation Rule**: Is the business eligibility predicate authored once in `src/lib/action-eligibility.ts` and shared between backend validation (`throw AppError`) and frontend gating?
3. [ ] **Inline Reason ("Why") & Fix-It CTA**: Does the disabled button present a clear explanation of the shortfall/blocker, accompanied by a direct action link (`Deposit Funds`, `Verify PAN`, `Contact Support`)?
4. [ ] **No Inadvertent Hiding**: Are discoverable buttons kept visible in their disabled state rather than vanishing?
5. [ ] **Content Hierarchy Adherence**: Does the view strictly adhere to its assigned archetype (Image-First for discovery, Text-First for utility/ledger, Hybrid for deals/campaigns)?
6. [ ] **Automated Action Guard**: Does `npm run lint:actions` pass with 0 ungated advisories across all 49 mutating buttons?
7. [ ] **Design Token Consistency**: Does `npm run lint:theme` pass with 0 hardcoded colors across all 579 source files?
8. [ ] **File Location**: Is the component in the appropriate feature folder (`components/dashboard/<feature>/` or `components/ui/`)?
9. [ ] **File Casing**: Is the component file PascalCase (`MyNewCard.tsx`)?
10. [ ] **Export Style**: Does the component provide a named export (`export function MyNewCard`)?
11. [ ] **Service Pattern**: Is new backend business logic encapsulated in a static class service (`export class FeatureService`) in `src/services/`?
12. [ ] **Import Aliasing**: Are all imports utilizing `@/...` rather than deep `../../` relative paths?
13. [ ] **Formatting Utilities**: Does all currency and date rendering use `formatCurrency` and `formatDate` from `@/lib/utils-client`?
14. [ ] **Loading States**: Are skeleton shimmer loaders (`<Skeleton>`) used for asynchronous data fetching instead of raw full-page spinners?
15. [ ] **Type Integrity**: Does `npm run typecheck` pass with 0 diagnostics?
16. [ ] **Test Coverage**: Does `npm test` execute and pass across the entire test suite (50 test files, 546 tests)?


