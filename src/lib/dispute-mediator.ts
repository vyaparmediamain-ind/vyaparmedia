import prisma from "./db";
import { logger } from "./logger";
import {
FullDispute,
MediatorAnalysis,
} from "./dispute-mediator/types";
import {
checkContractSignatureIntegrity,
createErrorAnalysis,
} from "./dispute-mediator/helpers";
import {
analyzeTimelineDispute,
analyzeQualityDispute,
analyzeContentDeletedDispute,
analyzePaymentDispute,
analyzeTermsViolationDispute,
} from "./dispute-mediator/analyzers/specific";
import {
analyzeGenericDispute,
} from "./dispute-mediator/analyzers/generic";

export { applyResolution, escalateDispute } from "./dispute-mediator/actions";
export type { MediatorAnalysis, Finding } from "./dispute-mediator/types";

export async function analyzeDispute(
disputeId: string,
): Promise<MediatorAnalysis> {
try {
const dispute = await prisma.dispute.findUnique({
where: { id: disputeId },
include: {
raisedBy: { select: { id: true, userType: true } },
deal: {
include: {
campaign: {
select: {
title: true,
deliverables: true,
requirements: true,
},
},
influencer: {
select: {
userId: true,
displayName: true,
completedDeals: true,
averageRating: true,
},
},
brand: { select: { userId: true, companyName: true } },
contentSubmissions: { orderBy: { version: "desc" as const } },
paymentHold: true,
reviews: true,
},
},
},
});

if (!dispute?.deal) {
return createErrorAnalysis(
disputeId,
"Dispute or associated deal not found"
);
}

const typedDispute = dispute as unknown as FullDispute;
const deal = typedDispute.deal;
const contract = deal.contractTerms as Record<string, unknown> | null;

// Check signature integrity first
const contractIntegrityFinding = checkContractSignatureIntegrity(deal);
if (contractIntegrityFinding.result === "FAIL") {
return {
disputeId,
tier: 1,
verdict: "ESCALATE",
confidence: "HIGH",
refundPercentage: 0,
influencerPayoutPercentage: 0,
trustScoreChanges: { influencer: 0, brand: 0 },
explanation: "Contract signature integrity check failed: " + contractIntegrityFinding.detail,
findings: [contractIntegrityFinding],
suggestedAction: "Escalate to human mediation for contract fraud audit.",
autoResolvable: false,
};
}

// Route based on dispute type
let analysis: MediatorAnalysis;
switch (dispute.type) {
case "TIMELINE":
analysis = analyzeTimelineDispute(typedDispute, deal, contract);
break;
case "QUALITY":
analysis = analyzeQualityDispute(typedDispute, deal, contract);
break;
case "CONTENT_DELETED":
analysis = analyzeContentDeletedDispute(typedDispute, deal);
break;
case "PAYMENT":
analysis = analyzePaymentDispute(typedDispute, deal);
break;
case "TERMS_VIOLATION":
analysis = analyzeTermsViolationDispute(typedDispute, deal, contract);
break;
case "OTHER":
default:
analysis = analyzeGenericDispute(typedDispute, deal);
break;
}

// Prepend contract integrity finding
analysis.findings = [contractIntegrityFinding, ...analysis.findings];
return analysis;
} catch (err: unknown) {
logger.error("Error during dispute auto-mediation:", err);
return createErrorAnalysis(
disputeId,
err instanceof Error ? err.message : String(err)
);
}
}
