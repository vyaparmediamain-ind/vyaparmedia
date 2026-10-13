# VyaparMedia System-Wide Action Validation & Eligibility Audit
**Audit Date:** September 2026  
**Audited Codebase:** `vyaparmedia/src`  
**Standard Enforced:** Premature-Exposure Prevention / Action-Button Rule (`ARCHITECTURE_PATTERNS.md`)  
**Shared Predicates:** `src/lib/action-eligibility.ts`

---

## 1. Executive Summary

This document presents a comprehensive, systematic audit of every user-triggered state-changing action, button, and submission form across the VyaparMedia platform.

### The Architectural Standard
Whenever a button triggers an API call or server action:
1. **Zero Blind Exposure:** Never expose an active, clickable action button that the backend will reject due to known static or stateful business rules (balance requirements, KYC tier limits, workflow state requirements, ledger locks).
2. **Never Completely Hide Feature Triggers:** Discoverable actions (e.g. *Apply to Campaign*, *Release Escrow*, *Submit Content*, *Launch Campaign*, *Accept Offer*) must remain visible in their context so users discover capabilities.
3. **Single-Implementation Rule:** Backend validation and frontend button gating use the **exact same underlying predicate functions** from `src/lib/action-eligibility.ts`. Logic is never duplicated or rewritten separately on client and server.
4. **Explain "Why" & Provide Fix-It CTA:** When disabled, the UI displays an inline badge, tooltip, or message stating the exact shortfall or blocker with a direct link to resolve it (e.g. *"Wallet balance insufficient — need ₹X more"* with `Deposit ₹X →`).

---

## 2. Dev-Time Verification Status

- **Action-Button Eligibility Regression Guard (`npm run lint:actions`):**  
  `0 advisories remaining` (47 of 47 mutating buttons actively gated with explicit `disabled` eligibility).
- **TypeScript Compiler (`npm run typecheck`):**  
  `0 errors` (Clean compilation across 581 source files).
- **Automated Test Battery (`vitest`):**  
  `71 test suites (643 tests) passing` (`deal-lifecycle.e2e.test.ts`, `shiprocket-deal-fulfillment.test.ts`, `matching-roi-scoring.test.ts`, `campaign-roi-report.test.ts`, `collusion-simulation.test.ts`, `auth-security.test.ts`, `wallet.test.ts`).

---

## 3. Systematic Action-to-Backend Rejection Mapping Matrix

### Priority 1: Financial & Escrow Operations

| Action | User Role | Trigger Component & File | Backend Service / Route | Backend Rejection Conditions | Shared Eligibility Predicate | Inline "Why" & Fix-It CTA |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Top Up Wallet** | Brand / Influencer | `WalletTopUpModal.tsx`<br>`src/components/dashboard/wallet/` | `POST /api/wallet/add-funds`<br>`payment.service.ts` | 1. Account not active / suspended (`assertAccountCanTransact`)<br>2. Wallet frozen (`wallet.isFrozen`)<br>3. Amount < ₹100 or > ₹10,00,000<br>4. Non-integer paise | `checkWalletTopUpEligibility` | Disabled when frozen or invalid amount. Inline: *"Wallet is frozen — cannot deposit"* or *"Amount must be between ₹100 and ₹10,00,000"*. |
| **Withdraw Funds** | Influencer / Brand | `WithdrawModal.tsx`<br>`src/components/dashboard/wallet/` | `POST /api/wallet/withdraw`<br>`payment.service.ts` | 1. Balance < amount<br>2. Amount < ₹500 or > ₹5,00,000<br>3. Wallet frozen<br>4. KYC Tier-2 (PAN) not verified<br>5. No verified bank account linked<br>6. Daily withdrawal velocity limit exceeded | `checkWithdrawalEligibility` | Disabled when unverified or insufficient. Inline: *"PAN tax verification required to withdraw"*, *"Add a verified bank account"*, *"Need ₹X more"*. Direct link to KYC tab. |
| **Delete Bank Account** | Brand / Influencer | `BankAccountManager.tsx`<br>`src/components/dashboard/wallet/` | `DELETE /api/wallet/bank-accounts`<br>`payment.service.ts` | 1. Pending withdrawal in-flight to this account<br>2. Sole active bank account with pending payouts | `checkBankAccountDeleteEligibility` | Disabled with lock icon. Inline: *"Cannot remove account while a payout is being processed"*. |
| **Activate Draft Campaign** | Brand | `CampaignDetailClient.tsx`<br>`src/app/dashboard/campaigns/[id]/` | `PATCH /api/campaigns/[id]`<br>`services/campaign.service.ts` | 1. Campaign not in `DRAFT` status<br>2. Non-owner session<br>3. Brand wallet frozen<br>4. Brand wallet balance < `requiredTotalAmountPaise` (budget + platform fee + gateway fee) | `checkCampaignActivationEligibility` | Disabled with shortfall amount. Inline: *"Wallet balance insufficient — need ₹X more to fund campaign escrow"*. Direct Fix-It CTA: `"Deposit ₹X →"` linked to topup flow. |
| **Accept In-Chat Offer** | Brand | `ChatPanel.tsx` (`OfferMessageBubble`)<br>`src/components/dashboard/messages/` | `PATCH /api/messages/[id]`<br>`route.ts` & `executeOfferEscrowTransaction` | 1. Message status not `PENDING`<br>2. Current user not message receiver<br>3. Brand wallet frozen<br>4. Brand wallet balance < `totalAmountToLock` (offer + 10% platform fee + 2% gateway fee) | `checkOfferAcceptanceEligibility` | Disabled with alert: *"Wallet balance insufficient — need ₹X more to fund offer escrow"*. Direct Fix-It CTA: `"Deposit ₹X →"` linked to wallet. |
| **Send Custom Proposal** | Influencer / Brand | `ChatPanel.tsx` (`ChatInputArea`)<br>`src/components/dashboard/messages/` | `POST /api/messages`<br>`services/message.service.ts` | 1. Brand wallet frozen<br>2. Brand wallet balance < required offer total (if brand sender)<br>3. Amount < ₹100 or > ₹10,00,000<br>4. Empty title | `checkOfferAcceptanceEligibility` | Disabled when balance insufficient or invalid amount. Inline reason: *"Wallet balance insufficient — need ₹X more to extend this offer"*. |
| **Release Escrow Payment (Route / Ledger)** | Brand / Admin | `DealContextualActions.tsx`<br>`src/components/dashboard/deals/` | Deal state machine transition (`DealService.transitionDealState`)<br>`services/deal.service.ts`, `services/payment.service.ts` | 1. Deal status not `COMPLETED` or `SUBMITTED`<br>2. Active dispute on deal<br>3. Escrow already released<br>4. Creator KYC Tier-2 not verified (for Route transfer)<br>5. Non-brand, non-admin session | `checkDealEscrowReleaseEligibility` | Disabled when disputed, pending delivery, or creator KYC unverified. Inline: *"Resolve active dispute before releasing escrow"*, *"Awaiting post verification"*, or *"Creator must complete KYC Tier-2 for direct settlement"*. |
| **Accept Application (Escrow Lock)** | Brand | `ApplicationReviewModal.tsx`<br>`src/components/dashboard/applications/` | `POST /api/applications/[id]/accept`<br>`services/application/action.ts` | 1. Application status not `PENDING`<br>2. Campaign max influencers reached<br>3. Brand wallet frozen<br>4. Brand wallet balance < deal total (budget + fees) | `checkApplicationAcceptanceEligibility` | Disabled with exact shortfall. Inline: *"Wallet balance insufficient — need ₹X more"*. Direct CTA: `"Add Funds →"`. |

---

### Priority 2: Trust, Safety, Identity & Disputes

| Action | User Role | Trigger Component & File | Backend Service / Route | Backend Rejection Conditions | Shared Eligibility Predicate | Inline "Why" & Fix-It CTA |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Raise Dispute** | Brand / Influencer | `DealContextualActions.tsx`<br>`src/components/dashboard/deals/` | `POST /api/disputes`<br>`services/dispute.service.ts` | 1. Deal already in `DISPUTED` or `CANCELLED` status<br>2. Escrow already released (`COMPLETED`)<br>3. Outside 7-day post-deadline dispute window<br>4. Non-participant session | `checkDisputeEligibility` | Disabled when dispute window expired or already disputed. Inline: *"Dispute window closed 7 days after milestone deadline"*. Direct CTA: `"Contact Support"`. |
| **Resolve Dispute (Split/Refund)** | Admin | `AdminDisputeClient.tsx`<br>`src/app/admin/disputes/[id]/` | `POST /api/disputes/[id]`<br>`services/dispute.service.ts` | 1. Dispute status not `OPEN` / `UNDER_REVIEW`<br>2. Split percentages do not sum to 100%<br>3. Resolution notes empty (< 10 chars)<br>4. Non-admin session | `checkDisputeResolutionEligibility` | Disabled with live percentage sum indicator. Inline: *"Total allocation must equal exactly 100%"*. |
| **Review Flagged Application** | Admin | `page.tsx`<br>`src/app/admin/applications/` | Server Actions `approveFlaggedApplication` / `rejectFlaggedApplication`<br>`actions.ts` | 1. Application status not `FLAGGED`<br>2. Application not found<br>3. Non-admin session | `checkAdminApplicationReviewEligibility` | Disabled when not in `FLAGGED` state. Inline: *"Only FLAGGED applications can be reviewed"*. |
| **Approve / Reject Verification** | Admin | `page.tsx`<br>`src/app/admin/verifications/[id]/` | Server Actions `approveUser` / `rejectUser`<br>`actions.ts` | 1. Admin self-approval attempt (`adminId === targetUserId`)<br>2. User status already `VERIFIED`<br>3. Missing mandatory documents for requested tier | `checkAdminVerificationReviewEligibility` | Disabled with warning: *"Admins cannot self-review or self-approve their own account verification"*. |
| **Ban / Restrict User** | Admin | `UserModerationActions.tsx`<br>`src/components/admin/users/` | `PATCH /api/admin/users/[id]`<br>`services/admin.service.ts` | 1. Target user is an Admin or Superadmin<br>2. Target user already banned<br>3. Empty reason (< 5 chars) | `checkAdminBanEligibility` | Disabled with warning: *"Cannot ban platform administrators"*. Reason input required. |
| **Tune Category Benchmarks** | Admin | `page.tsx`<br>`src/app/admin/benchmarks/` | `PATCH /api/admin/benchmarks`<br>`services/benchmark.service.ts` | 1. Non-admin session<br>2. Multipliers negative or invalid<br>3. Metric weights sum != 100% | `categoryBenchmarkUpdateSchema` validation | Save disabled when weight allocations do not sum to exactly 100%. Inline: *"Component weights must sum to exactly 100%"*. |
| **Moderate Suspicious Review** | Admin | `page.tsx`<br>`src/app/admin/suspicious-reviews/` | `PATCH /api/admin/reports/suspicious-reviews`<br>`services/review-audit.service.ts` | 1. Non-admin session<br>2. Review already moderated / dismissed<br>3. Missing action decision | `checkAdminReviewModerationEligibility` | Actions disabled if already actioned. Inline: *"Review has already been moderated"*. |
| **Report User** | Brand / Influencer | `ChatPanel.tsx` (`ReportUserModal`)<br>`src/components/dashboard/messages/` | `POST /api/users/report`<br>`apiClient.users.reportUser` | 1. Reason empty<br>2. Self-report<br>3. Submitting in progress | `reportUserSchema` validation | Disabled while submitting or when report reason is empty. |

---

### Priority 3: Collaboration & Deliverables

| Action | User Role | Trigger Component & File | Backend Service / Route | Backend Rejection Conditions | Shared Eligibility Predicate | Inline "Why" & Fix-It CTA |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Apply to Campaign** | Influencer | `CampaignDetailClient.tsx`<br>`src/app/dashboard/campaigns/[id]/` | `POST /api/applications`<br>`services/application.service.ts` | 1. User not INFLUENCER<br>2. Trust score < 40<br>3. KYC Tier 0: Missing Aadhaar+Selfie or email/phone verification (blocked from all campaigns)<br>4. KYC Tier 1: Capped at ₹50,000 (applying above ₹50k or entering proposedRate > ₹50k requires Tier-2 PAN+Bank Statement)<br>5. Application deadline passed<br>6. Max applicant capacity reached<br>7. Already applied / active deal | `checkCampaignApplicationEligibility` | Gated on both "Apply to Campaign" page button and Apply Modal "Submit Proposal" button. Disabled when prerequisites fail with specific tier reason: *"Please complete your identity verification (Aadhaar card + Selfie) before applying to campaigns"* or *"Complete KYC Tier-2 (PAN Card + Bank Statement) to apply for proposed rate of ₹X (exceeds Tier-1 limit of ₹50,000)"*. Direct Fix-It CTA: `"Verify Identity →"` / `"Complete KYC Tier-2 →"` linked to `/dashboard/settings?tab=verification`. |
| **Submit Content Draft** | Influencer | `DealContextualActions.tsx`<br>`src/components/dashboard/deals/` | Deal state machine transition (`DealService.transitionDealState`)<br>`services/deal.service.ts` | 1. Non-creator session<br>2. Escrow payment not secured (`PAYMENT_HELD`, `REVISION_REQUESTED`, or `ACTIVE` with `reservedFromWallet`)<br>3. Physical product required but not marked `DELIVERED` | `checkContentSubmissionEligibility` | Disabled with alert: *"Payment must be secured in escrow before content can be submitted"* or *"Awaiting physical product delivery before content can be created"*. |
| **Sign Deal Contract** | Brand / Influencer | `DealContextualActions.tsx`<br>`src/components/dashboard/deals/` | `POST /api/deals/[id]/sign`<br>`services/deal.service.ts` | 1. Non-participant session<br>2. User already signed<br>3. Deal not in signable state (`DRAFT` / `AWAITING_SIGNATURES`) | `checkContractSigningEligibility` | Renders `<Button disabled><CheckCircle2 /> Signed (Awaiting Counterparty)</Button>` once signed instead of vanishing. |
| **Request Content Revision** | Brand | `DealContextualActions.tsx`<br>`src/components/dashboard/deals/` | Deal state machine transition (`DealService.transitionDealState`)<br>`services/deal.service.ts` | 1. Non-brand session<br>2. Deal status not `SUBMITTED`<br>3. Max revisions (3) exceeded<br>4. Feedback empty (< 10 chars) | `checkRevisionRequestEligibility` | Disabled with count: *"Revision limit reached (3/3). Please approve or raise a dispute if unresolved"*. Direct CTA: `"Raise Dispute"`. |
| **Dispatch Physical Product (Shiprocket)** | Brand | `ProductFulfillmentCard.tsx`<br>`src/components/dashboard/deals/` | `POST /api/deals/[id]/product`<br>`services/deal.service.ts`, `services/shiprocket.service.ts` | 1. Non-brand session<br>2. Product not required or shipping address missing<br>3. Brand wallet balance < courier shipping rate<br>4. Product already dispatched / delivered | `checkProductFulfillmentEligibility` | Submit disabled until valid pickup & destination pincodes provided and wallet balance covers courier charge: *"Add ₹X to wallet to cover Shiprocket courier fee"*. |
| **Cancel Deal** | Brand / Influencer | `DealContextualActions.tsx`<br>`src/components/dashboard/deals/` | `POST /api/deals/[id]/cancel`<br>`services/deal.service.ts` | 1. Non-participant session<br>2. Content already submitted or approved<br>3. Active dispute open | `checkDealCancellationEligibility` | Disabled once content has been submitted. Inline: *"Deals cannot be unilaterally cancelled after content submission. Raise a dispute if needed"*. |
| **Send Direct Message** | Brand / Influencer | `InfluencerProfileClient.tsx`<br>`src/components/profile/` | `POST /api/messages`<br>`services/message.service.ts` | 1. No active deal, application, or direct invite between parties (`validateDealAccess`) | `checkDirectMessageEligibility` | Disabled with lock icon: *"Start a deal or send an invitation to message this creator"*. Direct CTA: `"Invite to Campaign →"`. |

---

### Priority 4: Account & Security Operations

| Action | User Role | Trigger Component & File | Backend Service / Route | Backend Rejection Conditions | Shared Eligibility Predicate | Inline "Why" & Fix-It CTA |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Disable Two-Factor Authentication** | All Users | `TwoFactorSettings.tsx`<br>`src/components/dashboard/settings/` | `POST /api/user/2fa/disable`<br>`route.ts` | 1. 2FA not currently enabled<br>2. Missing re-authentication token / password / TOTP | `checkDisable2FAEligibility` | Disabled when 2FA is inactive. Inline: *"Two-factor authentication is currently disabled"*. |
| **Delete Account** | All Users | `DeleteAccountSection.tsx`<br>`src/components/dashboard/settings/` | `DELETE /api/user/delete-account`<br>`route.ts` & `userService.deleteAccount` | 1. Non-zero wallet balance (funds must be withdrawn first)<br>2. Active in-progress deals<br>3. Open unresolved disputes | `checkAccountDeletionEligibility` | Disabled with exact blocker: *"Withdraw remaining balance of ₹X before closing account"* or *"Complete 2 active deals before deleting account"*. Direct CTA: `"Go to Wallet"`. |

---

## 4. Key Architectural Patterns Standardized

### Pattern A: Shared Predicate Function Signature
Every predicate in `src/lib/action-eligibility.ts` adheres to a strict contract:
```typescript
export function check<Action>Eligibility(
  target: TargetEntity | null | undefined,
  context?: ActingContext | undefined,
): {
  allowed: boolean;
  reason?: string;
  reasonCode?: string;
  shortfallPaise?: number;
  requiredAmountPaise?: number;
  ctaText?: string;
  ctaHref?: string;
}
```

### Pattern B: Gating Action Buttons (Frontend)
```tsx
const eligibility = checkCampaignActivationEligibility(campaign, {
  wallet: walletData,
  isOwner: campaign.brandId === session?.user?.id,
});

<Button
  onClick={handleActivate}
  disabled={!eligibility.allowed || isActivating}
>
  Launch Campaign
</Button>

{!eligibility.allowed && eligibility.reason && (
  <div className="flex flex-col gap-1 text-xs text-destructive">
    <p>{eligibility.reason}</p>
    {eligibility.ctaText && eligibility.ctaHref && (
      <Link href={eligibility.ctaHref} className="text-primary font-bold underline">
        {eligibility.ctaText} →
      </Link>
    )}
  </div>
)}
```

### Pattern C: Fail-Fast Enforcement (Backend)
```typescript
const eligibility = checkCampaignActivationEligibility(campaign, {
  wallet: brandWallet,
  isOwner: campaign.brandId === brandProfile.id,
});

if (!eligibility.allowed) {
  throw AppError.badRequest(eligibility.reason || "Campaign activation requirements not met.");
}
```

---

## 5. Ongoing Dev-Time Maintenance

To maintain this standard for all future features:
1. Run `npm run lint:actions` before submitting PRs or finalizing tasks.
2. Run `npm run typecheck` to verify TypeScript compiler diagnostics across all imports.
3. Review `ARCHITECTURE_PATTERNS.md` section *"The Action-Button Rule (Premature-Exposure Prevention)"* during code reviews.
