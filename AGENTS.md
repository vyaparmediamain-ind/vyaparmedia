<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# VyaparMedia Agent Operating Instructions & Architectural Standards

All AI coding assistants (including Antigravity) working on this codebase **MUST** strictly follow the standards documented in `ARCHITECTURE_PATTERNS.md`:

### 1. The Action-Button Rule (Premature-Exposure Prevention)
**Mandate:** Whenever creating, modifying, or reviewing ANY state-changing / API-triggering button, form, or interactive trigger:
1. **Find all backend rejection conditions first**: Inspect the target API route and service layer for all `throw`, `AppError`, rejections, balance requirements, ledger locks, status checks, or deadlines.
2. **Never completely hide buttons** that users need to discover exists (e.g., "Apply to Campaign", "Release Escrow Payment", "Cancel Deal", "Confirm Dispatch" must remain visible in their context).
3. **Wire frontend `disabled` state** using shared predicates from `src/lib/action-eligibility.ts`. Do NOT depend on backend runtime errors.
4. **Show inline specific reason ("Why")**: Display exact shortfall or blocker (e.g., *"Wallet balance insufficient — need ₹X more"*, *"Complete PAN tax verification before processing payouts"*, *"Creator authenticity score (32/100) is below platform threshold of 40"*).
5. **Provide a direct Fix-It CTA**: Link directly to the resolution flow (e.g., `"Deposit ₹X"`, `"Verify Account"`, `"View Dispute"`).
6. **Single-Implementation Rule**: Business eligibility predicates must be written once in `src/lib/action-eligibility.ts` and shared between backend enforcement and frontend components.

### 2. Design System & Theme Tokens
- Always use semantic tokens from `DESIGN_TOKENS.md` (`bg-background`, `bg-card`, `bg-muted`, `border-border`, `text-foreground`, etc.). Never use raw utility colors (`bg-white`, `bg-black`, `bg-slate-*`, `bg-gray-*`).

### 3. Dev-Time Verification
- Run `npm run lint:actions` to scan for any ungated action buttons.
- Run `npm run typecheck` to ensure 0 TypeScript compiler diagnostics.
