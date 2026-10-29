import {
  DEFAULT_BRAND_PLATFORM_FEE_PERCENT,
  DEFAULT_GATEWAY_FEE_PERCENT,
  DEFAULT_PRODUCT_HANDLING_FEE_PERCENT,
  GST_STANDARD_RATE,
  GST_DEAL_EXEMPT_THRESHOLD_PAISE,
} from "@/constants";

/**
 * Centralized Action Eligibility Rules & Predicates
 * 
 * SINGLE-IMPLEMENTATION RULE:
 * Every state-changing user action in VyaparMedia MUST use the shared predicates
 * defined here for BOTH:
 * 1. Frontend button state gating (`disabled={!eligibility.allowed}`, helper tooltips, status badges)
 * 2. Backend service/route request enforcement (fail-fast assertions throwing AppError / returning error JSON)
 * 
 * NEVER duplicate or rewrite these conditions separately on client and server.
 */

// ---------------------------------------------------------------------------
// 1. CONTENT SUBMISSION & WORK IN PROGRESS
// ---------------------------------------------------------------------------

export interface DealSubmissionEligibilityInput {
  status: string;
  reservedFromWallet?: boolean | null | undefined;
  requiresProduct?: boolean | null | undefined;
  productFulfillmentStatus?: string | null | undefined;
  influencer?: { userId?: string | undefined } | null | undefined;
  influencerUserId?: string | null | undefined;
}

export type SubmissionEligibilityReasonCode =
  | "UNAUTHORIZED"
  | "PAYMENT_NOT_SECURED"
  | "PRODUCT_NOT_RECEIVED";

export function checkContentSubmissionEligibility(
  deal: DealSubmissionEligibilityInput | null | undefined,
  actingUserId?: string | undefined,
): { allowed: boolean; reason?: string | undefined; reasonCode?: SubmissionEligibilityReasonCode | undefined; ctaText?: string | undefined; ctaHref?: string | undefined } {
  if (!deal) {
    return { allowed: false, reason: "Deal details not loaded", reasonCode: "UNAUTHORIZED" };
  }

  const influencerId = deal.influencer?.userId || deal.influencerUserId;
  if (actingUserId && influencerId && influencerId !== actingUserId) {
    return { allowed: false, reason: "Only the designated creator can submit content for this deal.", reasonCode: "UNAUTHORIZED" };
  }

  // Payment Guard: Deal must be PAYMENT_HELD, REVISION_REQUESTED, or ACTIVE with reservedFromWallet
  const isPaymentSecured =
    ["PAYMENT_HELD", "REVISION_REQUESTED"].includes(deal.status) ||
    (deal.status === "ACTIVE" && Boolean(deal.reservedFromWallet));

  if (!isPaymentSecured) {
    return {
      allowed: false,
      reason: "Payment must be secured in escrow before content can be submitted.",
      reasonCode: "PAYMENT_NOT_SECURED",
      ctaText: "Deposit Escrow",
    };
  }

  // Product Seeding Guard: If required, physical product must be confirmed RECEIVED
  if (
    deal.requiresProduct &&
    deal.productFulfillmentStatus !== "RECEIVED" &&
    deal.status !== "REVISION_REQUESTED"
  ) {
    return {
      allowed: false,
      reason: "Physical product must be marked as received before submitting content.",
      reasonCode: "PRODUCT_NOT_RECEIVED",
      ctaText: "Confirm Delivery",
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 1B. DEAL ESCROW FUNDING (RAZORPAY ROUTE SPLIT SETTLEMENT)
// ---------------------------------------------------------------------------

export interface DealEscrowFundingEligibilityInput {
  status: string;
  totalAmount?: number | null | undefined;
  reservedFromWallet?: boolean | null | undefined;
  brand?: { userId?: string | undefined } | null | undefined;
  brandUserId?: string | null | undefined;
  paymentHold?: { status?: string | undefined } | null | undefined;
  creatorHasVerifiedBank?: boolean | undefined;
  creatorRouteAccountActive?: boolean | undefined;
}

export type DealEscrowFundingReasonCode =
  | "UNAUTHORIZED"
  | "INVALID_STATUS"
  | "ALREADY_FUNDED"
  | "ACCOUNT_SUSPENDED"
  | "CREATOR_BANK_MISSING"
  | "CREATOR_KYC_PENDING";

export function checkDealEscrowFundingEligibility(
  deal: DealEscrowFundingEligibilityInput | null | undefined,
  actingUserId?: string | undefined,
  userStatus?: string | undefined,
): {
  allowed: boolean;
  reason?: string | undefined;
  reasonCode?: DealEscrowFundingReasonCode | undefined;
  ctaText?: string | undefined;
  ctaHref?: string | undefined;
} {
  if (!deal) {
    return { allowed: false, reason: "Deal details not found.", reasonCode: "UNAUTHORIZED" };
  }

  if (userStatus && ["SUSPENDED", "BANNED", "FLAGGED", "DELETED"].includes(userStatus)) {
    return {
      allowed: false,
      reason: "Your account is currently restricted from initiating escrow payments.",
      reasonCode: "ACCOUNT_SUSPENDED",
    };
  }

  const brandId = deal.brand?.userId || deal.brandUserId;
  if (actingUserId && brandId && brandId !== actingUserId) {
    return {
      allowed: false,
      reason: "Only the brand owner can fund this deal escrow.",
      reasonCode: "UNAUTHORIZED",
    };
  }

  if (deal.reservedFromWallet || deal.paymentHold?.status === "HELD") {
    return {
      allowed: false,
      reason: "Escrow funds have already been secured for this deal.",
      reasonCode: "ALREADY_FUNDED",
    };
  }

  if (!["PAYMENT_PENDING", "PENDING_SIGNATURE"].includes(deal.status)) {
    return {
      allowed: false,
      reason: `Deal is in ${deal.status} status and cannot be funded.`,
      reasonCode: "INVALID_STATUS",
    };
  }

  if (deal.creatorHasVerifiedBank === false) {
    return {
      allowed: false,
      reason: "Creator has not yet linked a verified bank account for payouts.",
      reasonCode: "CREATOR_BANK_MISSING",
      ctaText: "Remind Creator",
      ctaHref: "/dashboard/messages",
    };
  }

  if (deal.creatorRouteAccountActive === false) {
    return {
      allowed: false,
      reason: "Creator's payout account is awaiting payment gateway KYC activation.",
      reasonCode: "CREATOR_KYC_PENDING",
      ctaText: "Awaiting Creator KYC",
    };
  }

  return { allowed: true, ctaText: "Deposit Escrow via Razorpay Route" };
}

// ---------------------------------------------------------------------------
// 2. CONTRACT SIGNING
// ---------------------------------------------------------------------------

export function checkContractSigningEligibility(
  deal: {
    status: string;
    signDeadline?: string | Date | null | undefined;
  } | null | undefined,
  userHasSigned: boolean,
): { allowed: boolean; reason?: string | undefined; ctaText?: string | undefined; ctaHref?: string | undefined } {
  if (!deal) {
    return { allowed: false, reason: "Deal not found" };
  }
  if (deal.status !== "PENDING_SIGNATURE") {
    return { allowed: false, reason: "Deal is not pending signature." };
  }
  if (userHasSigned) {
    return { allowed: false, reason: "You have already signed this contract.", ctaText: "View Agreement" };
  }
  if (deal.signDeadline && new Date() > new Date(deal.signDeadline)) {
    return { allowed: false, reason: "Contract signature deadline has expired." };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 3. DELIVERABLE REVISION REQUESTS (BRAND)
// ---------------------------------------------------------------------------

export function checkRevisionRequestEligibility(
  deal: {
    revisionsUsed?: number | unknown;
    maxRevisions?: number | unknown;
    contractTerms?: unknown;
  } | null | undefined,
  brandWalletBalancePaise?: number | null | undefined,
  isWalletFrozen?: boolean | null | undefined,
): { allowed: boolean; costPaise: number; reason?: string | undefined; ctaText?: string | undefined; ctaHref?: string | undefined } {
  if (!deal) {
    return { allowed: false, costPaise: 0, reason: "Deal not found" };
  }

  const revisionsUsed = Number(deal.revisionsUsed ?? 0);
  const maxRevisions = Number(deal.maxRevisions ?? 1);
  const terms = (deal.contractTerms as { costPerExtraRevision?: number; maxRevisionsLimit?: number } | null) || {};
  const costPerExtraRevision = terms.costPerExtraRevision || 0;

  if (terms.maxRevisionsLimit !== undefined && revisionsUsed >= terms.maxRevisionsLimit) {
    return {
      allowed: false,
      costPaise: 0,
      reason: `Maximum revision limit of ${terms.maxRevisionsLimit} reached. No further revisions are allowed.`,
    };
  }

  if (revisionsUsed < maxRevisions) {
    return { allowed: true, costPaise: 0 };
  }

  // Extra paid revision
  if (costPerExtraRevision <= 0) {
    return {
      allowed: false,
      costPaise: 0,
      reason: `Maximum free revisions limit (${maxRevisions}) reached. No extra revisions permitted under this contract.`,
    };
  }

  if (isWalletFrozen) {
    return {
      allowed: false,
      costPaise: costPerExtraRevision,
      reason: "Your brand wallet is currently frozen. Cannot fund additional revisions.",
      ctaText: "Contact Support",
      ctaHref: "/dashboard/support",
    };
  }

  if (brandWalletBalancePaise !== undefined && brandWalletBalancePaise !== null) {
    if (brandWalletBalancePaise < costPerExtraRevision) {
      return {
        allowed: false,
        costPaise: costPerExtraRevision,
        reason: `Insufficient wallet balance. Extra revision requires ₹${(costPerExtraRevision / 100).toFixed(2)}, but available balance is ₹${(brandWalletBalancePaise / 100).toFixed(2)}.`,
        ctaText: "Add Funds",
        ctaHref: "/dashboard/wallet?topup=true",
      };
    }
  }

  return {
    allowed: true,
    costPaise: costPerExtraRevision,
    reason: `All ${maxRevisions} free revisions used. Additional revision costs ₹${(costPerExtraRevision / 100).toFixed(2)}.`,
  };
}

// ---------------------------------------------------------------------------
// 4. DISPUTE RAISING & MEDIATION ELIGIBILITY
// ---------------------------------------------------------------------------

export const ALLOWED_DISPUTE_DEAL_STATUSES = [
  "PAYMENT_HELD",
  "CONTENT_SUBMITTED",
  "REVISION_REQUESTED",
  "CONTENT_APPROVED",
  "POSTED",
  "VERIFICATION_PENDING",
  "VERIFIED",
  "DISPUTED",
] as const;

export function checkDisputeEligibility(
  deal: {
    status: string;
    hasActiveDispute?: boolean | null | undefined;
  } | null | undefined,
  actingUserId?: string | undefined,
  participants?: { influencerUserId?: string | null | undefined; brandUserId?: string | null | undefined } | null | undefined,
): { allowed: boolean; reason?: string | undefined; ctaText?: string | undefined; ctaHref?: string | undefined } {
  if (!deal) {
    return { allowed: false, reason: "Deal not found" };
  }

  if (actingUserId && participants) {
    const isParticipant =
      actingUserId === participants.influencerUserId ||
      actingUserId === participants.brandUserId;
    if (!isParticipant) {
      return { allowed: false, reason: "You are not an authorized party to this deal." };
    }
  }

  if (!(ALLOWED_DISPUTE_DEAL_STATUSES as readonly string[]).includes(deal.status)) {
    return {
      allowed: false,
      reason: `Cannot raise dispute on a deal in ${deal.status.replace(/_/g, " ")} status. Disputes can only be raised once escrow payment is secured and work is underway.`,
      ctaText: deal.status === "COMPLETED" ? "Contact Support" : undefined,
      ctaHref: deal.status === "COMPLETED" ? "/dashboard/support" : undefined,
    };
  }

  if (deal.hasActiveDispute) {
    return {
      allowed: false,
      reason: "An active dispute already exists for this collaboration.",
      ctaText: "View Dispute",
      ctaHref: "/dashboard/disputes",
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 5. CAMPAIGN CANCELLATION
// ---------------------------------------------------------------------------

export function checkCampaignCancelEligibility(
  campaign: {
    status: string;
    openDealCount?: number | undefined;
    activeDealsCount?: number | undefined;
    disputedDealCount?: number | undefined;
    _count?: { deals?: number | undefined } | undefined;
  } | null | undefined,
  isOwner: boolean,
  isWalletFrozen?: boolean | null | undefined,
  campaignId?: string | null | undefined,
): { allowed: boolean; reason?: string | undefined; ctaText?: string | undefined; ctaHref?: string | undefined } {
  if (!campaign) {
    return { allowed: false, reason: "Campaign not found" };
  }
  if (!isOwner) {
    return { allowed: false, reason: "Only the campaign owner can cancel this campaign." };
  }
  if (campaign.status === "CANCELLED") {
    return { allowed: false, reason: "Campaign is already cancelled." };
  }
  if (campaign.status === "COMPLETED") {
    return { allowed: false, reason: "Completed campaigns cannot be cancelled." };
  }
  if (isWalletFrozen) {
    return {
      allowed: false,
      reason: "Brand wallet is frozen. Unfreeze wallet to process cancellations/refunds.",
      ctaText: "Contact Support",
      ctaHref: "/dashboard/support",
    };
  }

  const disputedDeals = campaign.disputedDealCount ?? 0;
  const openDeals =
    campaign.openDealCount ??
    campaign.activeDealsCount ??
    0;

  if (disputedDeals > 0) {
    const nonDisputedOpen = Math.max(0, openDeals - disputedDeals);
    if (nonDisputedOpen > 0) {
      return {
        allowed: false,
        reason: `Cannot cancel campaign while deals are in active dispute (${disputedDeals} disputed deal${disputedDeals > 1 ? "s" : ""}) and ${nonDisputedOpen} ongoing deal${nonDisputedOpen > 1 ? "s exist" : " exists"}. Resolve disputes and finalize all deals first.`,
        ctaText: "View Disputes",
        ctaHref: "/dashboard/disputes",
      };
    }
    return {
      allowed: false,
      reason: `Cannot cancel campaign while deals are in active dispute (${disputedDeals} disputed deal${disputedDeals > 1 ? "s" : ""}). Please resolve or settle all disputes with arbitration first.`,
      ctaText: "View Disputes",
      ctaHref: "/dashboard/disputes",
    };
  }

  if (openDeals > 0) {
    return {
      allowed: false,
      reason: `Cannot cancel campaign while active deals exist (${openDeals} active deal${openDeals > 1 ? "s" : ""}). Complete, cancel, or resolve all deals first.`,
      ctaText: "View Active Deals",
      ctaHref: campaignId ? `/dashboard/deals?campaignId=${campaignId}` : "/dashboard/deals",
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 6. ADMIN SELF-ACTION & USER ACTIONS
// ---------------------------------------------------------------------------

export function checkAdminBanEligibility(
  adminUserId: string,
  targetUserId: string,
): { allowed: boolean; reason?: string | undefined; ctaText?: string | undefined; ctaHref?: string | undefined } {
  if (adminUserId === targetUserId) {
    return { allowed: false, reason: "Administrators cannot ban or suspend their own account." };
  }
  return { allowed: true };
}

export function checkDisputeResolutionEligibility(
  dispute: {
    status: string;
    deal?: {
      status: string;
      influencer?: { userId?: string | undefined } | null | undefined;
      brand?: { userId?: string | undefined } | null | undefined;
    } | null | undefined;
  } | null | undefined,
  adminUserId?: string | undefined,
): { allowed: boolean; reason?: string | undefined; ctaText?: string | undefined; ctaHref?: string | undefined } {
  if (!dispute) {
    return { allowed: false, reason: "Dispute not found" };
  }

  if (["RESOLVED", "CLOSED"].includes(dispute.status)) {
    return { allowed: false, reason: "This dispute has already reached a final verdict." };
  }

  if (dispute.deal) {
    if (dispute.deal.status === "COMPLETED") {
      return { allowed: false, reason: "Cannot resolve dispute for an already completed deal." };
    }
    if (dispute.deal.status === "CANCELLED") {
      return { allowed: false, reason: "Cannot resolve dispute for an already cancelled deal." };
    }
    if (
      adminUserId &&
      (dispute.deal.influencer?.userId === adminUserId ||
        dispute.deal.brand?.userId === adminUserId)
    ) {
      return {
        allowed: false,
        reason: "Conflict of Interest: Administrators cannot adjudicate disputes where they are a participating party.",
      };
    }
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 7. SECURITY & 2FA DISABLE
// ---------------------------------------------------------------------------

export function checkDisable2FAEligibility(
  isTwoFactorEnabled: boolean,
  authInput: { password?: string | undefined; code?: string | undefined; otp?: string | undefined; token?: string | undefined },
): { allowed: boolean; reason?: string | undefined; ctaText?: string | undefined; ctaHref?: string | undefined } {
  if (!isTwoFactorEnabled) {
    return {
      allowed: false,
      reason: "Two-Factor Authentication is not currently enabled.",
      ctaText: "Enable 2FA",
    };
  }
  const hasCredential = Boolean(
    authInput.password?.trim() ||
    authInput.code?.trim() ||
    authInput.otp?.trim() ||
    authInput.token?.trim()
  );
  if (!hasCredential) {
    return { allowed: false, reason: "Re-authentication required: Please enter your current account password to disable 2FA." };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 8. BANK ACCOUNT & BENEFICIARY DELETION
// ---------------------------------------------------------------------------

export function checkBankAccountDeleteEligibility(
  account: { id: string; isDefault?: boolean | undefined } | null | undefined,
  hasPendingWithdrawals?: boolean | undefined,
): { allowed: boolean; reason?: string | undefined; ctaText?: string | undefined; ctaHref?: string | undefined } {
  if (!account) {
    return { allowed: false, reason: "Account not found" };
  }
  if (hasPendingWithdrawals) {
    return {
      allowed: false,
      reason: "Cannot delete bank account while a withdrawal is currently pending or processing.",
      ctaText: "View Withdrawals",
      ctaHref: "/dashboard/wallet?tab=withdrawals",
    };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 9. ACCOUNT DELETION (DANGER ZONE)
// ---------------------------------------------------------------------------

export function checkAccountDeletionEligibility(
  wallet?: { balance?: number | undefined; pendingBalance?: number | undefined; debt?: number | undefined } | null | undefined,
  activeDealsCount?: number | undefined,
  confirmText?: string | undefined,
  password?: string | undefined,
  disputedDealsCount?: number | undefined,
): { allowed: boolean; reason?: string | undefined; ctaText?: string | undefined; ctaHref?: string | undefined } {
  if (disputedDealsCount && disputedDealsCount > 0) {
    return {
      allowed: false,
      reason: `Cannot delete account while you have deals in active dispute (${disputedDealsCount} disputed deal${disputedDealsCount > 1 ? "s" : ""}). Please resolve all disputes with mediation first.`,
      ctaText: "View Disputes",
      ctaHref: "/dashboard/disputes",
    };
  }

  if (activeDealsCount && activeDealsCount > 0) {
    return {
      allowed: false,
      reason: `Cannot delete account with active or disputed deals (${activeDealsCount} ongoing deal${activeDealsCount > 1 ? "s" : ""}). Please complete, cancel, or resolve all deals first.`,
      ctaText: "Go to Deals",
      ctaHref: "/dashboard/deals",
    };
  }

  if (wallet) {
    if ((wallet.balance ?? 0) > 0) {
      return {
        allowed: false,
        reason: `Cannot delete account with an active wallet balance of ₹${((wallet.balance ?? 0) / 100).toFixed(2)}. Please withdraw your balance before deleting.`,
        ctaText: "Withdraw Balance",
        ctaHref: "/dashboard/wallet",
      };
    }
    if ((wallet.pendingBalance ?? 0) > 0) {
      return {
        allowed: false,
        reason: "Cannot delete account with pending escrow funds. Please wait for pending transactions to settle.",
        ctaText: "View Escrow Funds",
        ctaHref: "/dashboard/wallet",
      };
    }
    if ((wallet.debt ?? 0) > 0) {
      return {
        allowed: false,
        reason: `Cannot delete account with an outstanding platform debt of ₹${((wallet.debt ?? 0) / 100).toFixed(2)}. Please clear dues first.`,
        ctaText: "Clear Dues",
        ctaHref: "/dashboard/wallet",
      };
    }
  }

  if (confirmText !== undefined && confirmText.trim() !== "DELETE") {
    return { allowed: false, reason: "Please type DELETE to confirm." };
  }

  if (password !== undefined && !password.trim()) {
    return { allowed: false, reason: "Account password is required for security verification." };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 10. WALLET TOP-UP (ADD FUNDS)
// ---------------------------------------------------------------------------

export const MIN_WALLET_TOPUP_PAISE = 10000; // ₹100
export const MAX_WALLET_TOPUP_PAISE = 50000000; // ₹5,00,000

export function checkWalletTopUpEligibility(
  amountRupees: number | string,
  wallet?: { isFrozen?: boolean | undefined } | null | undefined,
  userStatus?: string | null | undefined,
): { allowed: boolean; reason?: string | undefined; ctaText?: string | undefined; ctaHref?: string | undefined } {
  if (wallet?.isFrozen) {
    return {
      allowed: false,
      reason: "Your wallet is currently frozen or locked. Top-ups are blocked.",
      ctaText: "Contact Support",
      ctaHref: "/dashboard/support",
    };
  }
  if (userStatus && ["SUSPENDED", "BANNED", "FLAGGED", "DELETED"].includes(userStatus)) {
    return {
      allowed: false,
      reason: "Your account is currently restricted from topping up wallet funds.",
      ctaText: "Contact Support",
      ctaHref: "/dashboard/support",
    };
  }
  const parsed = typeof amountRupees === "string" ? parseFloat(amountRupees) : amountRupees;
  if (!parsed || Number.isNaN(parsed) || parsed <= 0) {
    return { allowed: false, reason: "Please enter a valid top-up amount." };
  }
  const paise = Math.round(parsed * 100);
  if (paise < MIN_WALLET_TOPUP_PAISE) {
    return { allowed: false, reason: `Minimum top-up is ₹${MIN_WALLET_TOPUP_PAISE / 100}.` };
  }
  if (paise > MAX_WALLET_TOPUP_PAISE) {
    return { allowed: false, reason: `Maximum top-up per transaction is ₹${(MAX_WALLET_TOPUP_PAISE / 100).toLocaleString("en-IN")}.` };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 11. CAMPAIGN APPLICATION ELIGIBILITY
// ---------------------------------------------------------------------------

export interface CampaignApplicationEligibilityInput {
  id?: string | undefined;
  status: string;
  applicationDeadline?: string | Date | null | undefined;
  minFollowers?: number | null | undefined;
  maxFollowers?: number | null | undefined;
  maxInfluencers?: number | null | undefined;
  selectedInfluencers?: number | null | undefined;
  perInfluencerBudget?: number | null | undefined;
  totalBudget?: number | null | undefined;
  productValue?: number | null | undefined;
  requiresProduct?: boolean | null | undefined;
  brand?: { userId?: string | undefined } | null | undefined;
}

export interface InfluencerApplicationViewerInput {
  id?: string | undefined;
  userId?: string | undefined;
  userType?: string | undefined;
  hasApplied?: boolean | undefined;
  applicationStatus?: string | null | undefined;
  followerCount?: number | null | undefined;
  kycTier?: number | undefined;
  verificationLevel?: string | undefined;
  proposedRate?: number | undefined;
}

export function checkCampaignApplicationEligibility(
  campaign: CampaignApplicationEligibilityInput | null | undefined,
  influencer?: InfluencerApplicationViewerInput | null | undefined,
): { allowed: boolean; reason?: string | undefined; reasonCode?: string | undefined; ctaText?: string | undefined; ctaHref?: string | undefined } {
  if (!campaign) {
    return { allowed: false, reason: "Campaign details not loaded" };
  }

  // If user is brand owner, application is not applicable
  if (influencer?.userId && campaign.brand?.userId && influencer.userId === campaign.brand.userId) {
    return {
      allowed: false,
      reason: "You are the creator of this campaign.",
      reasonCode: "OWN_CAMPAIGN",
    };
  }

  // Already applied
  if (influencer?.hasApplied) {
    const statusText = influencer.applicationStatus ? ` (Status: ${influencer.applicationStatus})` : "";
    return {
      allowed: false,
      reason: `You have already applied to this campaign${statusText}.`,
      reasonCode: "ALREADY_APPLIED",
      ctaText: "View My Application",
      ctaHref: "/dashboard/applications",
    };
  }

  // Campaign Status
  if (campaign.status !== "ACTIVE") {
    return {
      allowed: false,
      reason: `Campaign is currently ${campaign.status.replace(/_/g, " ").toLowerCase()} and not accepting applications.`,
      reasonCode: "CAMPAIGN_NOT_ACTIVE",
    };
  }

  // Application Deadline
  if (campaign.applicationDeadline) {
    const deadline = new Date(campaign.applicationDeadline);
    if (!Number.isNaN(deadline.getTime()) && new Date() > deadline) {
      return {
        allowed: false,
        reason: `Application deadline passed on ${deadline.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}.`,
        reasonCode: "DEADLINE_PASSED",
      };
    }
  }

  // Slots full
  if (
    typeof campaign.maxInfluencers === "number" &&
    campaign.maxInfluencers > 0 &&
    typeof campaign.selectedInfluencers === "number" &&
    campaign.selectedInfluencers >= campaign.maxInfluencers
  ) {
    return {
      allowed: false,
      reason: `This campaign has reached its maximum capacity (${campaign.maxInfluencers} creator slots filled).`,
      reasonCode: "SLOTS_FULL",
    };
  }

  // Follower count checks
  if (typeof influencer?.followerCount === "number" && influencer.followerCount >= 0) {
    if (typeof campaign.minFollowers === "number" && campaign.minFollowers > 0 && influencer.followerCount < campaign.minFollowers) {
      return {
        allowed: false,
        reason: `Minimum ${campaign.minFollowers.toLocaleString("en-IN")} followers required (you have ${influencer.followerCount.toLocaleString("en-IN")}).`,
        reasonCode: "MIN_FOLLOWERS_NOT_MET",
        ctaText: "View Other Campaigns",
        ctaHref: "/dashboard/campaigns",
      };
    }
    if (typeof campaign.maxFollowers === "number" && campaign.maxFollowers > 0 && influencer.followerCount > campaign.maxFollowers) {
      return {
        allowed: false,
        reason: `Maximum ${campaign.maxFollowers.toLocaleString("en-IN")} followers allowed for this tier.`,
        reasonCode: "MAX_FOLLOWERS_EXCEEDED",
        ctaText: "View Other Campaigns",
        ctaHref: "/dashboard/campaigns",
      };
    }
  }

  // Resolve effective KYC tier (either explicit numeric tier 0..3 or verificationLevel string)
  let effectiveTier: number | undefined = influencer?.kycTier;
  if (effectiveTier === undefined && influencer?.verificationLevel) {
    if (influencer.verificationLevel === "NONE") effectiveTier = 0;
    else if (influencer.verificationLevel === "BASIC") effectiveTier = 1;
    else if (["VERIFIED", "ENTERPRISE"].includes(influencer.verificationLevel)) effectiveTier = 2;
  }

  // KYC Tier 0: Identity (Aadhaar + Selfie) not verified -> Cannot apply to any campaigns
  if (effectiveTier !== undefined && effectiveTier === 0) {
    return {
      allowed: false,
      reason: "Please complete your identity verification (Aadhaar card + Selfie) before applying to campaigns.",
      reasonCode: "KYC_TIER1_REQUIRED",
      ctaText: "Verify Identity",
      ctaHref: "/dashboard/settings?tab=verification",
    };
  }

  // KYC Tier 1: Capped at ₹50,000 monthly / per deal limit -> Requires Tier 2 (PAN + Bank statement)
  const campaignBudget = (campaign.requiresProduct && campaign.totalBudget === 0)
    ? (campaign.productValue ?? 0)
    : (campaign.perInfluencerBudget ?? 0);

  const effectiveAmountPaise =
    typeof influencer?.proposedRate === "number" && influencer.proposedRate > 0
      ? Math.round(influencer.proposedRate * 100)
      : campaignBudget;

  if (effectiveAmountPaise > 5000000 && effectiveTier !== undefined && effectiveTier < 2) {
    const rateText = typeof influencer?.proposedRate === "number" && influencer.proposedRate > 0
      ? `proposed rate of ₹${influencer.proposedRate.toLocaleString("en-IN")}`
      : `campaign budget of ₹${(campaignBudget / 100).toLocaleString("en-IN")}`;

    return {
      allowed: false,
      reason: `Complete KYC Tier-2 (PAN Card + Bank Statement) to apply for ${rateText} (exceeds Tier-1 limit of ₹50,000).`,
      reasonCode: "KYC_TIER2_REQUIRED",
      ctaText: "Complete KYC Tier-2",
      ctaHref: "/dashboard/settings?tab=verification",
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 12. DIRECT MESSAGING ELIGIBILITY
// ---------------------------------------------------------------------------

export function checkDirectMessageEligibility(
  canMessage: boolean,
  isOwnProfile?: boolean | undefined,
): { allowed: boolean; reason?: string | undefined; reasonCode?: string | undefined; ctaText?: string | undefined; ctaHref?: string | undefined } {
  if (isOwnProfile) {
    return {
      allowed: false,
      reason: "You cannot message yourself.",
      reasonCode: "OWN_PROFILE",
    };
  }
  if (!canMessage) {
    return {
      allowed: false,
      reason: "Start a deal first to message this creator.",
      reasonCode: "DEAL_REQUIRED",
      ctaText: "Start Deal",
    };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 13. WITHDRAWAL & PAYOUT ELIGIBILITY
// ---------------------------------------------------------------------------

export const MIN_WITHDRAWAL_PAISE = 50000; // ₹500
export const MAX_WITHDRAWAL_PAISE = 50000000; // ₹5,00,000

export interface WithdrawalEligibilityInput {
  wallet?: { balance?: number | undefined; isFrozen?: boolean | undefined } | null | undefined;
  bankAccount?: { id: string; isVerified?: boolean | undefined } | null | undefined;
  hasPanCompliance?: boolean | undefined;
  amountPaise?: number | undefined;
  hasVerifiedBankAccount?: boolean | undefined;
}

export function checkWithdrawalEligibility(
  input: WithdrawalEligibilityInput
): {
  allowed: boolean;
  reason?: string | undefined;
  reasonCode?:
    | "WALLET_FROZEN"
    | "INSUFFICIENT_BALANCE"
    | "BELOW_MINIMUM"
    | "EXCEEDS_MAXIMUM"
    | "EXCEEDS_BALANCE"
    | "PAN_COMPLIANCE_REQUIRED"
    | "UNVERIFIED_BANK_ACCOUNT"
    | "NO_BANK_ACCOUNT"
    | undefined;
  shortfallPaise?: number | undefined;
  ctaText?: string | undefined;
  ctaHref?: string | undefined;
} {
  // 1. Frozen Wallet Guard
  if (input.wallet?.isFrozen) {
    return {
      allowed: false,
      reason: "Your wallet is currently frozen or locked. Payouts are blocked.",
      reasonCode: "WALLET_FROZEN",
      ctaText: "Contact Support",
      ctaHref: "/dashboard/support",
    };
  }

  // 2. Minimum Wallet Balance Guard
  const balance = input.wallet?.balance ?? 0;
  if (balance < MIN_WITHDRAWAL_PAISE) {
    const shortfall = MIN_WITHDRAWAL_PAISE - balance;
    return {
      allowed: false,
      reason: `Wallet balance insufficient — need ₹${(shortfall / 100).toFixed(2)} more (minimum payout is ₹${MIN_WITHDRAWAL_PAISE / 100}).`,
      reasonCode: "INSUFFICIENT_BALANCE",
      shortfallPaise: shortfall,
    };
  }

  // 3. Requested Amount Guards (if an amount is specified)
  if (input.amountPaise !== undefined && input.amountPaise > 0) {
    if (input.amountPaise < MIN_WITHDRAWAL_PAISE) {
      return {
        allowed: false,
        reason: `Minimum withdrawal amount is ₹${MIN_WITHDRAWAL_PAISE / 100}.`,
        reasonCode: "BELOW_MINIMUM",
      };
    }
    if (input.amountPaise > MAX_WITHDRAWAL_PAISE) {
      return {
        allowed: false,
        reason: `Maximum single withdrawal is ₹${(MAX_WITHDRAWAL_PAISE / 100).toLocaleString("en-IN")}.`,
        reasonCode: "EXCEEDS_MAXIMUM",
      };
    }
    if (input.amountPaise > balance) {
      const diff = input.amountPaise - balance;
      return {
        allowed: false,
        reason: `Amount exceeds available wallet balance (short by ₹${(diff / 100).toFixed(2)}).`,
        reasonCode: "EXCEEDS_BALANCE",
        shortfallPaise: diff,
      };
    }
  }

  // 4. PAN Tax Compliance Guard (Income Tax Act Section 194J / 194R requirement)
  if (input.hasPanCompliance === false) {
    return {
      allowed: false,
      reason: "PAN tax compliance is required by government regulations before processing withdrawals.",
      reasonCode: "PAN_COMPLIANCE_REQUIRED",
      ctaText: "Complete PAN Verification",
      ctaHref: "/dashboard/settings?tab=verification",
    };
  }

  // 5. Bank Account Verification Guards
  if (input.hasVerifiedBankAccount === false) {
    return {
      allowed: false,
      reason: "A verified Indian bank account or UPI ID is required for withdrawals.",
      reasonCode: "NO_BANK_ACCOUNT",
      ctaText: "Add & Verify Bank Account",
      ctaHref: "/dashboard/wallet?tab=bank-accounts",
    };
  }

  if (input.bankAccount && input.bankAccount.isVerified === false) {
    return {
      allowed: false,
      reason: "Selected bank account has not completed penny-drop verification yet.",
      reasonCode: "UNVERIFIED_BANK_ACCOUNT",
      ctaText: "Verify Account",
      ctaHref: "/dashboard/wallet?tab=bank-accounts",
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 14. DEAL ESCROW PAYMENT RELEASE (BRAND)
// ---------------------------------------------------------------------------

export interface DealEscrowReleaseInput {
  status: string;
  amount: number;
  totalAmount?: number | undefined;
  requiresPostVerification?: boolean | null | undefined;
  hasActiveDispute?: boolean | null | undefined;
  reservedFromWallet?: boolean | null | undefined;
}

export function checkDealEscrowReleaseEligibility(
  deal: DealEscrowReleaseInput | null | undefined,
  isBrand: boolean,
  brandPendingBalancePaise?: number | null | undefined,
): {
  allowed: boolean;
  reason?: string | undefined;
  reasonCode?: "UNAUTHORIZED" | "INVALID_STATUS" | "DISPUTED" | "POST_VERIFICATION_REQUIRED" | "INSUFFICIENT_ESCROW" | undefined;
  ctaText?: string | undefined;
  ctaHref?: string | undefined;
} {
  if (!deal) {
    return { allowed: false, reason: "Deal details not found", reasonCode: "UNAUTHORIZED" };
  }

  if (!isBrand) {
    return {
      allowed: false,
      reason: "Only the brand client can authorize release of escrow payment.",
      reasonCode: "UNAUTHORIZED",
    };
  }

  // Active Dispute Guard
  if (deal.status === "DISPUTED" || deal.hasActiveDispute) {
    return {
      allowed: false,
      reason: "Payment release is locked while an active dispute is open.",
      reasonCode: "DISPUTED",
      ctaText: "View Dispute",
      ctaHref: "/dashboard/disputes",
    };
  }

  // Status Guard: Escrow release allowed from POSTED, VERIFIED, VERIFICATION_PENDING, or CONTENT_APPROVED (if no post verification)
  const allowedStatuses = ["POSTED", "VERIFIED", "VERIFICATION_PENDING", "CONTENT_APPROVED"];
  if (!allowedStatuses.includes(deal.status)) {
    return {
      allowed: false,
      reason: `Escrow payment can only be released once deliverables are submitted or verified (currently ${deal.status.replace(/_/g, " ")}).`,
      reasonCode: "INVALID_STATUS",
    };
  }

  // Post Verification Guard
  if (deal.status === "CONTENT_APPROVED" && deal.requiresPostVerification !== false) {
    return {
      allowed: false,
      reason: "Creator must publish content live and provide a live post link before payment release.",
      reasonCode: "POST_VERIFICATION_REQUIRED",
    };
  }

  // Brand Escrow Balance Guard (if not pre-reserved from wallet)
  if (!deal.reservedFromWallet && brandPendingBalancePaise !== undefined && brandPendingBalancePaise !== null) {
    const requiredTotal = deal.totalAmount ?? deal.amount;
    if (brandPendingBalancePaise < requiredTotal) {
      return {
        allowed: false,
        reason: `Reserved campaign escrow is insufficient (₹${(brandPendingBalancePaise / 100).toFixed(2)} available vs ₹${(requiredTotal / 100).toFixed(2)} required).`,
        reasonCode: "INSUFFICIENT_ESCROW",
        ctaText: "Add Funds",
        ctaHref: "/dashboard/wallet?topup=true",
      };
    }
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 15. DEAL CANCELLATION ELIGIBILITY (BRAND)
// ---------------------------------------------------------------------------

export function checkDealCancellationEligibility(
  deal: { status: string; hasActiveDispute?: boolean | null | undefined } | null | undefined,
  isBrand: boolean,
): {
  allowed: boolean;
  reason?: string | undefined;
  reasonCode?: "UNAUTHORIZED" | "TERMINAL_STATUS" | "DISPUTED" | undefined;
  ctaText?: string | undefined;
  ctaHref?: string | undefined;
} {
  if (!deal) {
    return { allowed: false, reason: "Deal details not found", reasonCode: "UNAUTHORIZED" };
  }

  if (!isBrand) {
    return {
      allowed: false,
      reason: "Only the brand client can cancel this deal.",
      reasonCode: "UNAUTHORIZED",
    };
  }

  const brandCancellableStatuses = [
    "PENDING_SIGNATURE",
    "PAYMENT_PENDING",
    "PAYMENT_HELD",
    "ACTIVE",
    "CONTENT_SUBMITTED",
    "REVISION_REQUESTED",
    "CONTENT_APPROVED",
  ];

  if (!brandCancellableStatuses.includes(deal.status)) {
    return {
      allowed: false,
      reason:
        deal.status === "COMPLETED" || deal.status === "CANCELLED"
          ? `This deal is already ${deal.status.toLowerCase()} and cannot be cancelled.`
          : `Deals in ${deal.status} status cannot be cancelled once content has been published.`,
      reasonCode:
        deal.status === "COMPLETED" || deal.status === "CANCELLED"
          ? "TERMINAL_STATUS"
          : undefined,
    };
  }

  if (deal.status === "DISPUTED" || deal.hasActiveDispute) {
    return {
      allowed: false,
      reason: "Cannot cancel a deal while an active dispute is open. Please resolve the dispute first.",
      reasonCode: "DISPUTED",
      ctaText: "View Dispute",
      ctaHref: "/dashboard/disputes",
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 16. PRODUCT FULFILLMENT & SHIPPING ELIGIBILITY
// ---------------------------------------------------------------------------

export function checkProductFulfillmentEligibility(
  deal: {
    id?: string | undefined;
    status: string;
    requiresProduct?: boolean | null | undefined;
    productFulfillmentStatus?: string | null | undefined;
    shippingAddress?: unknown;
    hasActiveDispute?: boolean | null | undefined;
    /** Estimated courier charge in paise (from Shiprocket rate lookup). Used for wallet pre-flight. */
    estimatedShippingCharge?: number | undefined;
    /** Brand's current wallet balance in paise. Used for shipping balance pre-flight. */
    brandWalletBalance?: number | undefined;
  } | null | undefined,
  userRole: "INFLUENCER" | "BRAND" | "ADMIN",
  action: "submit_address" | "confirm_dispatch" | "confirm_received" | "create_shipment",
): {
  allowed: boolean;
  reason?: string | undefined;
  reasonCode?:
    | "NO_PRODUCT_REQUIRED"
    | "TERMINAL_DEAL"
    | "UNAUTHORIZED"
    | "DISPATCHED_ALREADY"
    | "PAYMENT_NOT_SECURED"
    | "ADDRESS_MISSING"
    | "NOT_DISPATCHED"
    | "INSUFFICIENT_SHIPPING_BALANCE"
    | undefined;
  ctaText?: string | undefined;
  ctaHref?: string | undefined;
} {
  if (!deal) {
    return { allowed: false, reason: "Deal details not found" };
  }

  if (!deal.requiresProduct) {
    return {
      allowed: false,
      reason: "This deal does not require physical product shipment.",
      reasonCode: "NO_PRODUCT_REQUIRED",
    };
  }

  if (["CANCELLED", "COMPLETED", "DISPUTED"].includes(deal.status) || deal.hasActiveDispute) {
    return {
      allowed: false,
      reason: `Product shipping actions are disabled on ${deal.status.replace(/_/g, " ").toLowerCase()} deals.`,
      reasonCode: "TERMINAL_DEAL",
    };
  }

  const fulfillmentStatus = deal.productFulfillmentStatus || "ADDRESS_PENDING";

  if (action === "submit_address") {
    if (userRole !== "INFLUENCER") {
      return {
        allowed: false,
        reason: "Only the creator can submit or update the shipping address.",
        reasonCode: "UNAUTHORIZED",
      };
    }
    if (!["ADDRESS_PENDING", "READY_TO_DISPATCH"].includes(fulfillmentStatus)) {
      return {
        allowed: false,
        reason: "Shipping address cannot be updated after the product has been dispatched.",
        reasonCode: "DISPATCHED_ALREADY",
      };
    }
  }

  if (action === "confirm_dispatch" || action === "create_shipment") {
    if (userRole !== "BRAND" && userRole !== "ADMIN") {
      return {
        allowed: false,
        reason: "Only the brand client can confirm product dispatch or create shipments.",
        reasonCode: "UNAUTHORIZED",
      };
    }
    if (["PENDING_SIGNATURE", "PAYMENT_PENDING"].includes(deal.status)) {
      return {
        allowed: false,
        reason: "Escrow payment must be secured before dispatching products.",
        reasonCode: "PAYMENT_NOT_SECURED",
      };
    }
    if (fulfillmentStatus !== "READY_TO_DISPATCH" || !deal.shippingAddress) {
      return {
        allowed: false,
        reason: "Creator shipping address is required before the product can be dispatched.",
        reasonCode: "ADDRESS_MISSING",
        ctaText: "View Deal",
        ctaHref: `/dashboard/deals/${deal.id}`,
      };
    }
    // Wallet balance pre-flight for create_shipment (estimated courier charge)
    if (
      action === "create_shipment" &&
      typeof deal.estimatedShippingCharge === "number" &&
      deal.estimatedShippingCharge > 0 &&
      typeof deal.brandWalletBalance === "number" &&
      deal.brandWalletBalance < deal.estimatedShippingCharge
    ) {
      const shortfallRupees = ((deal.estimatedShippingCharge - deal.brandWalletBalance) / 100).toFixed(2);
      return {
        allowed: false,
        reason: `Wallet balance insufficient for courier charge — deposit ₹${shortfallRupees} more to proceed.`,
        reasonCode: "INSUFFICIENT_SHIPPING_BALANCE",
        ctaText: `Deposit ₹${shortfallRupees}`,
        ctaHref: "/dashboard/wallet",
      };
    }
  }

  if (action === "confirm_received") {
    if (userRole !== "INFLUENCER") {
      return {
        allowed: false,
        reason: "Only the recipient creator can confirm product receipt.",
        reasonCode: "UNAUTHORIZED",
      };
    }
    if (fulfillmentStatus !== "DISPATCHED") {
      return {
        allowed: false,
        reason: "Product must be marked as dispatched before receipt can be confirmed.",
        reasonCode: "NOT_DISPATCHED",
      };
    }
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 17. CAMPAIGN APPLICATION ACCEPTANCE (BRAND)
// ---------------------------------------------------------------------------

export function checkApplicationAcceptanceEligibility(
  application: {
    status: string;
    influencer?: { followerAuthenticityScore?: number | null | undefined; [key: string]: unknown } | null | undefined;
    matchBreakdown?: { authenticityScore?: number | null | undefined; [key: string]: unknown } | null | undefined;
  } | null | undefined,
  campaign?: {
    status: string;
    maxInfluencers?: number | null | undefined;
    selectedInfluencers?: number | null | undefined;
    [key: string]: unknown;
  } | null | undefined,
): {
  allowed: boolean;
  reason?: string | undefined;
  reasonCode?: "AUTHENTICITY_TOO_LOW" | "ALREADY_PROCESSED" | "CAMPAIGN_NOT_ACTIVE" | "SLOTS_FULL" | undefined;
} {
  if (!application) {
    return { allowed: false, reason: "Application details not found" };
  }

  const authenticityScore =
    application.influencer?.followerAuthenticityScore ??
    application.matchBreakdown?.authenticityScore ??
    100;
  if (authenticityScore < 40) {
    return {
      allowed: false,
      reason: `Creator authenticity score (${authenticityScore}/100) is below platform threshold of 40.`,
      reasonCode: "AUTHENTICITY_TOO_LOW",
    };
  }

  const appStatus = application.status.toUpperCase();
  if (!["PENDING", "SHORTLISTED"].includes(appStatus)) {
    return {
      allowed: false,
      reason: `Application has already been ${appStatus.toLowerCase()}.`,
      reasonCode: "ALREADY_PROCESSED",
    };
  }

  if (campaign) {
    if (campaign.status !== "ACTIVE") {
      return {
        allowed: false,
        reason: "Campaign is no longer active.",
        reasonCode: "CAMPAIGN_NOT_ACTIVE",
      };
    }

    if (
      typeof campaign.maxInfluencers === "number" &&
      campaign.maxInfluencers > 0 &&
      typeof campaign.selectedInfluencers === "number" &&
      campaign.selectedInfluencers >= campaign.maxInfluencers
    ) {
      return {
        allowed: false,
        reason: `All creator slots for this campaign are filled (${campaign.maxInfluencers} filled).`,
        reasonCode: "SLOTS_FULL",
      };
    }
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 18. REVIEW SUBMISSION ELIGIBILITY
// ---------------------------------------------------------------------------

const CONTACT_PATTERNS = [
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
  /https?:\/\/\S+/i,
  /\b(?:wa\.me|t\.me|instagram\.com|insta:|ig:|upi:|vpa:)\b/i,
];

export function checkReviewSubmissionEligibility(
  deal: { status: string } | null | undefined,
  rating: number,
  comment?: string | undefined,
): {
  allowed: boolean;
  reason?: string | undefined;
  reasonCode?: "DEAL_NOT_COMPLETED" | "INVALID_RATING" | "CONTACT_INFO_DETECTED" | undefined;
} {
  if (!deal || deal.status !== "COMPLETED") {
    return {
      allowed: false,
      reason: "Reviews can only be submitted for completed deals.",
      reasonCode: "DEAL_NOT_COMPLETED",
    };
  }

  if (!rating || rating < 1 || rating > 5) {
    return {
      allowed: false,
      reason: "Please select a star rating (1–5) to submit your review.",
      reasonCode: "INVALID_RATING",
    };
  }

  if (comment) {
    const hasContact = CONTACT_PATTERNS.some((pattern) => pattern.test(comment));
    if (hasContact) {
      return {
        allowed: false,
        reason: "Contact details (phone numbers, emails, links, handles, or UPI) are not permitted in review comments.",
        reasonCode: "CONTACT_INFO_DETECTED",
      };
    }
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 19. CAMPAIGN LAUNCH / ACTIVATION ELIGIBILITY (BRAND)
// ---------------------------------------------------------------------------

export interface CampaignActivationEligibilityInput {
  status: string;
  totalBudget: number; // in paise
  perInfluencerBudget?: number | null | undefined;
  maxInfluencers?: number | null | undefined;
  productValue?: number | null | undefined;
  requiresProduct?: boolean | null | undefined;
}

export interface CampaignActivationWalletInput {
  balance?: number | null | undefined;
  isFrozen?: boolean | null | undefined;
}

export function calculateCampaignActivationCostPaise(params: {
  totalBudget: number;
  perInfluencerBudget?: number | null | undefined;
  maxInfluencers?: number | null | undefined;
  productValue?: number | null | undefined;
  requiresProduct?: boolean | null | undefined;
  platformFeePercent?: number | undefined;
  gatewayFeePercent?: number | undefined;
}): number {
  const {
    totalBudget,
    perInfluencerBudget,
    maxInfluencers,
    productValue,
    requiresProduct,
    platformFeePercent = DEFAULT_BRAND_PLATFORM_FEE_PERCENT,
    gatewayFeePercent = DEFAULT_GATEWAY_FEE_PERCENT,
  } = params;

  let slots = 1;
  if (maxInfluencers && maxInfluencers > 0) {
    slots = maxInfluencers;
  } else if (perInfluencerBudget && perInfluencerBudget > 0) {
    slots = Math.max(1, Math.floor(totalBudget / perInfluencerBudget));
  }

  const isProductOnly = Boolean(requiresProduct && totalBudget === 0);
  let handlingFeePerSlot = 0;
  if (requiresProduct && productValue) {
    if (isProductOnly) {
      handlingFeePerSlot = Math.max(0, Math.round((productValue * platformFeePercent) / 100));
    } else {
      handlingFeePerSlot = Math.max(
        0,
        Math.round((productValue * DEFAULT_PRODUCT_HANDLING_FEE_PERCENT) / 100)
      );
    }
  }

  const totalProductHandlingFee = handlingFeePerSlot * slots;
  const platformFee = Math.round((totalBudget * platformFeePercent) / 100) + totalProductHandlingFee;
  const isGstApplicable = totalBudget > GST_DEAL_EXEMPT_THRESHOLD_PAISE;
  const gstAmount = isGstApplicable ? Math.round(platformFee * GST_STANDARD_RATE) : 0;
  const gatewayFee = Math.round(((totalBudget + platformFee + gstAmount) * gatewayFeePercent) / 100);

  return totalBudget + platformFee + gstAmount + gatewayFee;
}

export function checkCampaignActivationEligibility(
  campaign: CampaignActivationEligibilityInput | null | undefined,
  isOwner: boolean,
  wallet?: CampaignActivationWalletInput | null | undefined,
  options?: {
    customPlatformFeePercent?: number | undefined;
    requiredTotalAmountPaise?: number | undefined;
  },
): {
  allowed: boolean;
  reason?: string | undefined;
  reasonCode?: "CAMPAIGN_NOT_FOUND" | "UNAUTHORIZED" | "NOT_DRAFT" | "WALLET_FROZEN" | "INSUFFICIENT_FUNDS" | undefined;
  requiredAmountPaise?: number | undefined;
  shortfallPaise?: number | undefined;
  ctaText?: string | undefined;
  ctaHref?: string | undefined;
} {
  if (!campaign) {
    return { allowed: false, reason: "Campaign details not loaded", reasonCode: "CAMPAIGN_NOT_FOUND" };
  }

  if (!isOwner) {
    return {
      allowed: false,
      reason: "Only the campaign owner can launch this campaign.",
      reasonCode: "UNAUTHORIZED",
    };
  }

  if (campaign.status !== "DRAFT") {
    return {
      allowed: false,
      reason: `Only draft campaigns can be launched (currently ${campaign.status.replace(/_/g, " ").toLowerCase()}).`,
      reasonCode: "NOT_DRAFT",
    };
  }

  if (wallet?.isFrozen) {
    return {
      allowed: false,
      reason: "Your brand wallet is currently frozen. Cannot activate campaign.",
      reasonCode: "WALLET_FROZEN",
      ctaText: "Contact Support",
      ctaHref: "/dashboard/support",
    };
  }

  const requiredAmountPaise =
    options?.requiredTotalAmountPaise ??
    calculateCampaignActivationCostPaise({
      totalBudget: campaign.totalBudget,
      perInfluencerBudget: campaign.perInfluencerBudget,
      maxInfluencers: campaign.maxInfluencers,
      productValue: campaign.productValue,
      requiresProduct: campaign.requiresProduct,
      platformFeePercent: options?.customPlatformFeePercent,
    });

  if (wallet && wallet.balance !== undefined && wallet.balance !== null) {
    if (wallet.balance < requiredAmountPaise) {
      const shortfallPaise = requiredAmountPaise - wallet.balance;
      return {
        allowed: false,
        reason: `Wallet balance insufficient — need ₹${(shortfallPaise / 100).toFixed(2)} more to fund campaign escrow (Total required: ₹${(requiredAmountPaise / 100).toFixed(2)}).`,
        reasonCode: "INSUFFICIENT_FUNDS",
        requiredAmountPaise,
        shortfallPaise,
        ctaText: `Deposit ₹${Math.ceil(shortfallPaise / 100)}`,
        ctaHref: `/dashboard/wallet?topup=true&amount=${Math.ceil(shortfallPaise / 100)}`,
      };
    }
  }

  return { allowed: true, requiredAmountPaise };
}



// ---------------------------------------------------------------------------
// 22. ADMIN REVIEW ACTIONS (APPLICATIONS & VERIFICATIONS)
// ---------------------------------------------------------------------------

export function checkAdminApplicationReviewEligibility(
  applicationStatus: string | null | undefined
): { allowed: boolean; reason?: string | undefined } {
  if (applicationStatus !== "FLAGGED") {
    return {
      allowed: false,
      reason: `Only FLAGGED applications can be reviewed (currently ${applicationStatus || "UNKNOWN"}).`,
    };
  }
  return { allowed: true };
}

export function checkAdminVerificationReviewEligibility(
  targetUserId: string,
  adminUserId?: string | null | undefined,
  currentStatus?: string | null | undefined
): { allowed: boolean; reason?: string | undefined } {
  if (adminUserId && targetUserId === adminUserId) {
    return {
      allowed: false,
      reason: "Admins cannot self-review or self-approve their own account verification.",
    };
  }
  if (currentStatus === "VERIFIED") {
    return {
      allowed: false,
      reason: "User account is already fully verified.",
    };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 23. INFLUENCER FRAUD & AUTHENTICITY APPEAL
// ---------------------------------------------------------------------------

export interface FraudAppealEligibilityInput {
  userType?: string | null | undefined;
  userStatus?: string | null | undefined;
  followerAuthenticityScore?: number | null | undefined;
  hasPendingAppeal?: boolean | null | undefined;
  appealReasonLength?: number | null | undefined;
}

export function checkFraudAppealEligibility(input: FraudAppealEligibilityInput): {
  allowed: boolean;
  reason?: string | undefined;
  reasonCode?: "NOT_INFLUENCER" | "ACCOUNT_HEALTHY" | "PENDING_APPEAL" | "REASON_TOO_SHORT" | undefined;
  ctaText?: string | undefined;
  ctaHref?: string | undefined;
} {
  if (input.userType && input.userType !== "INFLUENCER") {
    return {
      allowed: false,
      reason: "Authenticity appeals are only available for creator/influencer accounts.",
      reasonCode: "NOT_INFLUENCER",
    };
  }

  const isFlagged = input.userStatus === "FLAGGED";
  const isLowScore = (input.followerAuthenticityScore ?? 100) < 60;
  if (!isFlagged && !isLowScore) {
    return {
      allowed: false,
      reason: "Account authenticity is healthy. No manual appeal is necessary.",
      reasonCode: "ACCOUNT_HEALTHY",
    };
  }

  if (input.hasPendingAppeal) {
    return {
      allowed: false,
      reason: "An authenticity appeal is already submitted and pending admin review.",
      reasonCode: "PENDING_APPEAL",
    };
  }

  if (typeof input.appealReasonLength === "number" && input.appealReasonLength < 15) {
    const remaining = 15 - input.appealReasonLength;
    return {
      allowed: false,
      reason: `Please provide at least 15 characters explaining your audience metrics or evidence (${remaining} more needed).`,
      reasonCode: "REASON_TOO_SHORT",
    };
  }

  return { allowed: true };
}


