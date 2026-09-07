import { FullDeal, FullDispute, MediatorAnalysis } from "../types";

// analyzeGenericDispute
export function analyzeGenericDispute(
dispute: FullDispute,
_deal: FullDeal,
): MediatorAnalysis {
return {
disputeId: dispute.id,
tier: 1,
verdict: "ESCALATE",
confidence: "LOW",
refundPercentage: 0,
influencerPayoutPercentage: 0,
trustScoreChanges: { influencer: 0, brand: 0 },
explanation: `Dispute type "${dispute.type}" requires human mediation. Escalating to Tier 2.`,
findings: [],
suggestedAction: "Escalate to Tier 2 mediation.",
autoResolvable: false,
};
}

