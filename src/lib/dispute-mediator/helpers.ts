import { FullDeal, FullDispute, MediatorAnalysis, Finding, ContractSig } from "./types";
import { verifyContractSignature, ContractTerms } from "../contract-engine";

function verifySignatures(
contractTerms: ContractTerms,
influencerSig?: ContractSig,
brandSig?: ContractSig
): { failures: string[]; error?: Error } {
const failures: string[] = [];
try {
if (influencerSig && !verifyContractSignature(contractTerms, influencerSig)) {
failures.push("influencer signature hash mismatch");
}
if (brandSig && !verifyContractSignature(contractTerms, brandSig)) {
failures.push("brand signature hash mismatch");
}
return { failures };
} catch (err) {
return {
failures,
error: err instanceof Error ? err : new Error(String(err)),
};
}
}

export function checkContractSignatureIntegrity(
deal: FullDeal,
): Finding {
const contractSignatureRaw = deal.contractSignature;
const contractTerms = deal.contractTerms as ContractTerms | null;

if (!contractTerms) {
return {
check: "Contract signature integrity",
result: "N/A",
detail: "No contract terms stored on the deal signature verification skipped.",
};
}

if (!contractSignatureRaw) {
return {
check: "Contract signature integrity",
result: "WARNING",
detail: "No digital signatures on file. Deal may not have been fully counter-signed.",
};
}

interface ContractSignatureObj {
influencerSignature?: ContractSig;
brandSignature?: ContractSig;
}

const sig = contractSignatureRaw && typeof contractSignatureRaw === "object"
? (contractSignatureRaw as unknown as ContractSignatureObj)
: {};
const influencerSig = sig.influencerSignature;
const brandSig = sig.brandSignature;

const { failures, error } = verifySignatures(contractTerms, influencerSig, brandSig);

if (error) {
return {
check: "Contract signature integrity",
result: "WARNING",
detail: `Signature verification could not be completed: ${error.message}. Proceeding with caution.`,
};
}

if (failures.length > 0) {
return {
check: "Contract signature integrity",
result: "FAIL",
detail: `Contract tampering detected ${failures.join("; ")}. ` +
`Influencer signed: ${influencerSig ? "yes" : "no"}, Brand signed: ${brandSig ? "yes" : "no"}.`,
};
}

const signedParties = [influencerSig ? "influencer" : "", brandSig ? "brand" : ""].filter(Boolean);
const passed = signedParties.length > 0;

return {
check: "Contract signature integrity",
result: passed ? "PASS" : "N/A",
detail: passed
? `All signatures verified: ${signedParties.join(", ")}.`
: "Neither party has signed signature verification skipped.",
};
}

// ==================== TIMELINE DISPUTE ====================

export function checkSubmissionDeadline(deal: FullDeal, findings: Finding[]): { submissionDeadline: Date | null; submittedAt: Date | null } {
const submissionDeadline = deal.submissionDeadline ? new Date(deal.submissionDeadline) : null;
const latestSubmission = deal.contentSubmissions?.[0];
const submittedAt = latestSubmission?.submittedAt ? new Date(latestSubmission.submittedAt) : null;

  if (submissionDeadline && submittedAt) {
    const isOnTime = submittedAt.getTime() <= submissionDeadline.getTime();
    const hoursLate = isOnTime ? 0 : Math.round((submittedAt.getTime() - submissionDeadline.getTime()) / (3600 * 1000));
    findings.push({
      check: "Submitted before deadline",
      result: isOnTime ? "PASS" : "FAIL",
      detail: isOnTime ? `Submitted on time` : `Submitted ${hoursLate}h after deadline`,
    });
} else {
findings.push({
check: "Submitted before deadline",
result: "N/A",
detail: "Deadline or submission timestamp not available",
});
}

return { submissionDeadline, submittedAt };
}

export function checkBrandApprovalTimeliness(deal: FullDeal, findings: Finding[]): { late: boolean; detail: string } {
const brandApprovedLate = checkBrandApprovalDelay(deal);
findings.push({
check: "Brand reviewed within 48h",
result: brandApprovedLate.late ? "FAIL" : "PASS",
detail: brandApprovedLate.detail,
});
return brandApprovedLate;
}

export function checkPostingDeadline(deal: FullDeal, findings: Finding[]) {
const postingDeadline = deal.postingDeadline ? new Date(deal.postingDeadline) : null;
const postedAt = deal.postedAt ? new Date(deal.postedAt) : null;
  if (postingDeadline && postedAt) {
    const isOnTime = postedAt.getTime() <= postingDeadline.getTime();
    findings.push({
      check: "Posted before posting deadline",
      result: isOnTime ? "PASS" : "FAIL",
      detail: isOnTime ? "Posted on time" : "Posted after deadline",
    });
}
}

function getInfluencerFavoredVerdict(disputeId: string, findings: Finding[]): MediatorAnalysis {
  return {
    disputeId,
    tier: 1,
    verdict: "INFLUENCER_FAVORED",
    confidence: "HIGH",
    refundPercentage: 0,
    influencerPayoutPercentage: 100,
    trustScoreChanges: { influencer: 0, brand: -45 },
    explanation: `Brand failed to review content within the 48-hour review window. Per contract terms, content is auto-approved and influencer receives full payment. Brand receives a trust score penalty.`,
    findings,
    suggestedAction: "Auto-approve content and release payment to influencer. Apply 10% late fee from brand.",
    autoResolvable: true,
  };
}

function getBrandFavoredOrSplitVerdict(
  disputeId: string,
  hasSubmission: boolean,
  submissionDeadline: Date | null,
  submittedAt: Date | null,
  findings: Finding[]
): MediatorAnalysis {
  const hoursLate =
    submissionDeadline && submittedAt
      ? Math.round((submittedAt.getTime() - submissionDeadline.getTime()) / (3600 * 1000))
      : 999;

  if (hoursLate > 48 || !hasSubmission) {
    return {
      disputeId,
      tier: 1,
      verdict: "BRAND_FAVORED",
      confidence: "HIGH",
      refundPercentage: 100,
      influencerPayoutPercentage: 0,
      trustScoreChanges: { influencer: -90, brand: 0 },
      explanation: `Influencer ${hasSubmission ? "missed the submission deadline by more than 48 hours" : "did not submit any content"}. Full refund issued to brand.`,
      findings,
      suggestedAction: "Release pre-authorized payment back to brand. Penalize influencer trust score.",
      autoResolvable: true,
    };
  } else {
    return {
      disputeId,
      tier: 1,
      verdict: "SPLIT",
      confidence: "MEDIUM",
      refundPercentage: 50,
      influencerPayoutPercentage: 50,
      trustScoreChanges: { influencer: -45, brand: 0 },
      explanation: `Influencer submitted content ${hoursLate}h after deadline. A 50/50 split is suggested since delivery was late but content was provided.`,
      findings,
      suggestedAction: "50% refund to brand, 50% payment to influencer. Minor trust score penalty for influencer.",
      autoResolvable: true,
    };
  }
}

export function determineTimelineVerdict(
  dispute: FullDispute,
  deal: FullDeal,
  hasSubmission: boolean,
  submissionDeadline: Date | null,
  submittedAt: Date | null,
  brandApprovedLate: { late: boolean; detail: string },
  findings: Finding[]
): MediatorAnalysis {
  const raisedByInfluencer = dispute.raisedBy.userType === "INFLUENCER";

  const subDeadlineStart = submissionDeadline ? new Date(submissionDeadline) : null;
  if (subDeadlineStart) subDeadlineStart.setUTCHours(0, 0, 0, 0);
  const submittedStart = submittedAt ? new Date(submittedAt) : null;
  if (submittedStart) submittedStart.setUTCHours(0, 0, 0, 0);

  const influencerMissedDeadline =
    !hasSubmission ||
    (subDeadlineStart && submittedStart && submittedStart > subDeadlineStart);
  const brandDelayed = brandApprovedLate.late;

  if (raisedByInfluencer && brandDelayed) {
    return getInfluencerFavoredVerdict(dispute.id, findings);
  }

  if (!raisedByInfluencer && influencerMissedDeadline) {
    return getBrandFavoredOrSplitVerdict(dispute.id, hasSubmission, submissionDeadline, submittedAt, findings);
  }

  return {
    disputeId: dispute.id,
    tier: 1,
    verdict: "ESCALATE",
    confidence: "LOW",
    refundPercentage: 0,
    influencerPayoutPercentage: 0,
    trustScoreChanges: { influencer: 0, brand: 0 },
    explanation: `Timeline dispute could not be auto-resolved. Both parties appear to have met some deadlines but the situation is ambiguous. Escalating to human mediation.`,
    findings,
    suggestedAction: "Escalate to Tier 2 human mediation for detailed review.",
    autoResolvable: false,
  };
}


function checkBrandApprovalDelay(deal: FullDeal): {
late: boolean;
hoursToApprove: number;
detail: string;
} {
if (!deal.submittedAt)
return {
late: false,
hoursToApprove: 0,
detail: "No submission timestamp",
};

const submittedAt = new Date(deal.submittedAt);
const reviewPeriodHours = deal.reviewPeriodHours ?? 48;

if (deal.approvedAt) {
const approvedAt = new Date(deal.approvedAt);
const hours = Math.round(
(approvedAt.getTime() - submittedAt.getTime()) / (3600 * 1000),
);
return {
late: hours > reviewPeriodHours,
hoursToApprove: hours,
detail:
hours > reviewPeriodHours
? `Brand took ${hours}h to approve (limit: ${reviewPeriodHours}h)`
: `Brand approved in ${hours}h (within ${reviewPeriodHours}h limit)`,
};
}

// Not approved yet
const hoursSinceSubmission = Math.round(
(Date.now() - submittedAt.getTime()) / (3600 * 1000),
);
return {
late: hoursSinceSubmission > reviewPeriodHours,
hoursToApprove: hoursSinceSubmission,
detail:
hoursSinceSubmission > reviewPeriodHours
? `Brand has not approved after ${hoursSinceSubmission}h (limit: ${reviewPeriodHours}h)`
: `Pending approval for ${hoursSinceSubmission}h (limit: ${reviewPeriodHours}h)`,
};
}

export function createErrorAnalysis(
disputeId: string,
error: string,
): MediatorAnalysis {
return {
disputeId,
tier: 1,
verdict: "ESCALATE",
confidence: "LOW",
refundPercentage: 0,
influencerPayoutPercentage: 0,
trustScoreChanges: { influencer: 0, brand: 0 },
explanation: `Error during auto-analysis: ${error}. Escalating to human mediation.`,
findings: [{ check: "System check", result: "FAIL", detail: error }],
suggestedAction: "Escalate to Tier 2.",
autoResolvable: false,
};
}

