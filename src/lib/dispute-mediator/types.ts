import {
Deal,
Dispute,
ContentSubmission,
PaymentHold,
Prisma,
UserType,
} from "@prisma/client";
export type { ContractSignature as ContractSig } from "../contract-engine";

export type FullDeal = Deal & {
campaign: { title: string; deliverables: Prisma.JsonValue; requirements: string };
influencer: {
userId: string;
displayName: string;
completedDeals: number;
averageRating: number;
};
brand: { userId: string; companyName: string } | null;
contentSubmissions: ContentSubmission[];
paymentHold: PaymentHold | null;
reviews: unknown[];
};

export type FullDispute = Dispute & {
deal: FullDeal;
raisedBy: { id: string; userType: UserType };
};

export interface MediatorAnalysis {
disputeId: string;
tier: 1 | 2 | 3;
verdict:
| "INFLUENCER_FAVORED"
| "BRAND_FAVORED"
| "SPLIT"
| "ESCALATE"
| "DISMISSED";
confidence: "HIGH" | "MEDIUM" | "LOW";
refundPercentage: number;
influencerPayoutPercentage: number;
trustScoreChanges: {
influencer: number;
brand: number;
};
explanation: string;
findings: Finding[];
suggestedAction: string;
autoResolvable: boolean;
}

export interface Finding {
check: string;
result: "PASS" | "FAIL" | "WARNING" | "N/A";
detail: string;
}
