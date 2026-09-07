import { FullDeal, FullDispute, MediatorAnalysis, Finding } from "../types";
import {
checkSubmissionDeadline,
checkBrandApprovalTimeliness,
checkPostingDeadline,
determineTimelineVerdict,
} from "../helpers";

// analyzeTimelineDispute, analyzeQualityDispute, analyzeContentDeletedDispute, analyzePaymentDispute, analyzeTermsViolationDispute
export function analyzeTimelineDispute(
dispute: FullDispute,
deal: FullDeal,
_contract: Record<string, unknown> | null,
): MediatorAnalysis {
const findings: Finding[] = [];

// Check 1: Was content submitted?
const hasSubmission = (deal.contentSubmissions || []).length > 0;
findings.push({
check: "Content submitted",
result: hasSubmission ? "PASS" : "FAIL",
detail: hasSubmission
? `${deal.contentSubmissions.length} submission(s) found`
: "No content submissions found",
});

// Check 2: Submission deadline check
const { submissionDeadline, submittedAt } = checkSubmissionDeadline(deal, findings);

// Check 3: Brand approval timeliness check
const brandApprovedLate = checkBrandApprovalTimeliness(deal, findings);

// Check 4: Posting deadline check
checkPostingDeadline(deal, findings);

// Determine verdict
return determineTimelineVerdict(
dispute,
deal,
hasSubmission,
submissionDeadline,
submittedAt,
brandApprovedLate,
findings
);
}

// ==================== QUALITY DISPUTE ====================

export function analyzeQualityDispute(
dispute: FullDispute,
deal: FullDeal,
_contract: Record<string, unknown> | null,
): MediatorAnalysis {
const findings: Finding[] = [];

const submissions = deal.contentSubmissions || [];
findings.push({
check: "Content submitted",
result: submissions.length > 0 ? "PASS" : "FAIL",
detail: `${submissions.length} submission(s) found`,
});

// Check 2: Revision history
const revisionsUsed = deal.revisionsUsed || 0;
const maxRevisions = deal.maxRevisions || 2;
findings.push({
check: "Revisions within policy",
result: revisionsUsed <= maxRevisions ? "PASS" : "WARNING",
detail: `${revisionsUsed}/${maxRevisions} revisions used`,
});

// Check 3: Was there specific feedback from brand?
const latestSubmission = submissions[0];
const hasFeedback =
latestSubmission?.feedback && latestSubmission.feedback.length > 10;
findings.push({
check: "Brand provided specific feedback",
result: hasFeedback ? "PASS" : "FAIL",
detail: hasFeedback
? `Feedback: "${(latestSubmission.feedback || "").substring(0, 100)}..."`
: "No specific feedback provided by brand",
});

// Check 4: Has influencer attempted revisions?
const attemptedRevisions = revisionsUsed > 0;
findings.push({
check: "Influencer attempted revisions",
result: attemptedRevisions ? "PASS" : "WARNING",
detail: attemptedRevisions
? `${revisionsUsed} revision(s) attempted`
: "No revisions attempted",
});

// Decision logic
const raisedByBrand = dispute.raisedBy.userType === "BRAND";

if (raisedByBrand && !hasFeedback) {
// Brand rejected without specific feedback unfair
return {
disputeId: dispute.id,
tier: 1,
verdict: "INFLUENCER_FAVORED",
confidence: "MEDIUM",
refundPercentage: 0,
influencerPayoutPercentage: 100,
trustScoreChanges: { influencer: 0, brand: -30 },
explanation: `Brand raised quality concerns but did not provide specific, actionable feedback. Per revision policy, brand must give clear reasons. Influencer receives full payment.`,
findings,
suggestedAction:
"Pay influencer in full. Remind brand to provide specific feedback when requesting revisions.",
autoResolvable: true,
};
}

if (raisedByBrand && revisionsUsed >= maxRevisions) {
// Brand gave feedback, influencer used all revisions, still not approved
// This is genuinely ambiguous escalate
return {
disputeId: dispute.id,
tier: 1,
verdict: "ESCALATE",
confidence: "LOW",
refundPercentage: 0,
influencerPayoutPercentage: 0,
trustScoreChanges: { influencer: 0, brand: 0 },
explanation: `Quality dispute after ${revisionsUsed} revisions. Brand provided feedback but influencer couldn't meet expectations. This requires human judgment to determine if brand's expectations were reasonable.`,
findings,
suggestedAction:
"Escalate to Tier 2 mediation. Both parties should submit evidence.",
autoResolvable: false,
};
}

if (raisedByBrand && revisionsUsed < maxRevisions) {
// Revisions still available remind both parties
return {
disputeId: dispute.id,
tier: 1,
verdict: "DISMISSED",
confidence: "HIGH",
refundPercentage: 0,
influencerPayoutPercentage: 0,
trustScoreChanges: { influencer: 0, brand: 0 },
explanation: `Quality issue raised but ${maxRevisions - revisionsUsed} revision(s) still available. Brand should request a revision with specific feedback before raising a dispute.`,
findings,
suggestedAction:
"Dismiss dispute. Instruct brand to use available revision rounds first.",
autoResolvable: true,
};
}

// Influencer raised quality dispute (unusual) or other case
return {
disputeId: dispute.id,
tier: 1,
verdict: "ESCALATE",
confidence: "LOW",
refundPercentage: 0,
influencerPayoutPercentage: 0,
trustScoreChanges: { influencer: 0, brand: 0 },
explanation: `Quality dispute requires human assessment of content against brief.`,
findings,
suggestedAction: "Escalate to Tier 2 mediation.",
autoResolvable: false,
};
}

// ==================== CONTENT DELETED DISPUTE ====================

export function analyzeContentDeletedDispute(
dispute: FullDispute,
deal: FullDeal,
): MediatorAnalysis {
const findings: Finding[] = [];

// Check 1: Was post verified originally?
const wasVerified = !!deal.verifiedAt;
findings.push({
check: "Post was originally verified",
result: wasVerified ? "PASS" : "FAIL",
detail:
wasVerified && deal.verifiedAt
? `Verified at ${new Date(deal.verifiedAt).toLocaleString()}`
: "Post was never verified",
});

// Check 2: Is post currently alive?
const isAlive = deal.isPostAlive;
findings.push({
check: "Post currently alive",
result: isAlive ? "PASS" : "FAIL",
detail: isAlive
? "Post is still live"
: "Post appears to be deleted or private",
});

// Check 3: Time since posting (within 30-day contract window?)
const postedAt = deal.postedAt ? new Date(deal.postedAt) : null;
const daysSincePosting = postedAt
? Math.floor((Date.now() - postedAt.getTime()) / (86400 * 1000))
: 0;
findings.push({
check: "Within 30-day monitoring window",
result: daysSincePosting <= 30 ? "PASS" : "N/A",
detail: `${daysSincePosting} days since posting`,
});

// Check 4: Was payment already released?
const paymentReleased =
deal.status === "COMPLETED" || deal.status === "VERIFIED";
findings.push({
check: "Payment status",
result: paymentReleased ? "WARNING" : "PASS",
detail: paymentReleased ? "Payment already released" : "Payment still held",
});

if (!isAlive && wasVerified && daysSincePosting <= 30) {
// Clear case: post was verified but now deleted within 30 days
return {
disputeId: dispute.id,
tier: 1,
verdict: "BRAND_FAVORED",
confidence: "HIGH",
refundPercentage: 50,
influencerPayoutPercentage: 50,
trustScoreChanges: { influencer: -270, brand: 0 },
explanation: `Post was verified but deleted/made private within the 30-day contract window. Per contract terms, 50% clawback applies. Influencer receives major trust score penalty.`,
findings,
suggestedAction:
"Execute 50% clawback from influencer wallet. Apply -270 trust score penalty. Create violation record.",
autoResolvable: true,
};
}

if (!isAlive && !wasVerified) {
// Post was never verified full refund
return {
disputeId: dispute.id,
tier: 1,
verdict: "BRAND_FAVORED",
confidence: "HIGH",
refundPercentage: 100,
influencerPayoutPercentage: 0,
trustScoreChanges: { influencer: -180, brand: 0 },
explanation: `Post was never verified and is not accessible. Full refund to brand.`,
findings,
suggestedAction:
"Full refund to brand. Trust score penalty for influencer.",
autoResolvable: true,
};
}

if (isAlive) {
// Post is still live dismiss dispute
return {
disputeId: dispute.id,
tier: 1,
verdict: "DISMISSED",
confidence: "HIGH",
refundPercentage: 0,
influencerPayoutPercentage: 100,
trustScoreChanges: { influencer: 0, brand: -25 },
explanation: `Post is still live and accessible. Content deletion claim is not substantiated.`,
findings,
suggestedAction: "Dismiss dispute. Post is still live.",
autoResolvable: true,
};
}

// Ambiguous (>30 days, etc.)
return {
disputeId: dispute.id,
tier: 1,
verdict: "ESCALATE",
confidence: "LOW",
refundPercentage: 0,
influencerPayoutPercentage: 0,
trustScoreChanges: { influencer: 0, brand: 0 },
explanation: `Content deletion dispute requires manual verification. Post may have been deleted after the 30-day window.`,
findings,
suggestedAction: "Escalate to Tier 2 mediation.",
autoResolvable: false,
};
}

// ==================== PAYMENT DISPUTE ====================

export function analyzePaymentDispute(
dispute: FullDispute,
deal: FullDeal,
): MediatorAnalysis {
const findings: Finding[] = [];

// Check 1: Payment wallet escrow status
const isPaymentSecured = [
"PAYMENT_HELD",
"ACTIVE",
"CONTENT_SUBMITTED",
"CONTENT_APPROVED",
"POSTED",
"VERIFIED",
].includes(deal.status);

const isCompleted = deal.status === "COMPLETED" || deal.status === "VERIFIED";

findings.push(
{
check: "Payment secured in wallet escrow",
result: isPaymentSecured ? "PASS" : "FAIL",
detail: `Deal status: ${deal.status}`,
},
{
check: "Deal completed",
result: isCompleted ? "PASS" : "WARNING",
detail: `Deal status: ${deal.status}`,
},
{
check: "Wallet reserve system integrity",
result: "PASS",
detail: "Wallet escrow system secures funds prior to deal activation",
}
);

  return {
    disputeId: dispute.id,
    tier: 1,
    verdict: isPaymentSecured ? "DISMISSED" : "ESCALATE",
    confidence: isPaymentSecured ? "HIGH" : "LOW",
    refundPercentage: 0,
    influencerPayoutPercentage: 0,
    trustScoreChanges: { influencer: 0, brand: 0 },
    explanation: isPaymentSecured
      ? `Payment is secured and held in wallet escrow. If deal conditions are met, payment will release. No payment dispute is valid while escrow is active.`
      : `Payment dispute detected with status "${deal.status}". This is unusual. Escalating for manual investigation.`,
    findings,
    suggestedAction: isPaymentSecured
      ? "Dismiss dispute. Payment is secured via wallet escrow."
      : "Escalate to Tier 2 for technical payment investigation.",
    autoResolvable: isPaymentSecured,
  };
}

// ==================== TERMS VIOLATION DISPUTE ====================

export function analyzeTermsViolationDispute(
dispute: FullDispute,
deal: FullDeal,
contract: Record<string, unknown> | null,
): MediatorAnalysis {
const findings: Finding[] = [];

// Check contract mandatory elements
const rawMandatoryElements = Array.isArray(contract?.mandatoryElements)
? contract.mandatoryElements
: contract?.mandatoryTags;
const mandatoryElements = Array.isArray(rawMandatoryElements)
? rawMandatoryElements.map((element) => String(element).trim()).filter(Boolean)
: [];
findings.push({
check: "Contract has mandatory elements",
result: mandatoryElements.length > 0 ? "PASS" : "N/A",
detail:
mandatoryElements.length > 0
? `Required: ${mandatoryElements.join(", ")}`
: "No mandatory elements specified in contract",
});

// Check no-gos
const noGos = Array.isArray(contract?.noGos) ? contract.noGos : [];
findings.push({
check: "Contract has no-go rules",
result: noGos.length > 0 ? "PASS" : "N/A",
detail:
noGos.length > 0
? `No-gos: ${noGos.join(", ")}`
: "No no-go rules specified",
});

// Terms violations always need human review (subjective)
return {
disputeId: dispute.id,
tier: 1,
verdict: "ESCALATE",
confidence: "LOW",
refundPercentage: 0,
influencerPayoutPercentage: 0,
trustScoreChanges: { influencer: 0, brand: 0 },
explanation: `Terms violation disputes require human review to assess compliance with contract terms. Contract mandatory elements: ${mandatoryElements.join(", ") || "none specified"}. No-gos: ${noGos.join(", ") || "none specified"}.`,
findings,
suggestedAction:
"Escalate to Tier 2 mediation. Both parties should submit evidence of compliance/violation.",
autoResolvable: false,
};
}

// ==================== GENERIC / OTHER DISPUTE ====================

