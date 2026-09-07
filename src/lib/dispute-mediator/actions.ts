import prisma from "../db";
import { redis } from "../redis";
import { logger } from "../logger";
import { updateTrustAndLevel } from "../trust-engine";
import { applyProgressivePenalty, ViolationCategory } from "../penalty-system";
import { createActivityLog } from "../audit";
import { randomInt } from "node:crypto";
import { FullDeal, FullDispute, MediatorAnalysis } from "./types";
import { DisputeStatus, Prisma, DealStatus } from "@prisma/client";
import { getDealTotalAmount } from "../utils";
import { AppError } from "../errors";

import {
applyFinancialResolution,
applyDealStatusAndRevenues,
createResolutionNotifications,
} from "./transaction-helpers";

// Resolution transaction execution types
type AcceptedByType = "AUTO" | "INFLUENCER" | "BRAND" | "ADMIN";

interface ResolutionTransactionConfig {
  tx: Prisma.TransactionClient;
  disputeId: string;
  dispute: FullDispute;
  deal: FullDeal;
  analysis: MediatorAnalysis;
  brandUserId: string | null;
  influencerUserId: string;
  brandRefund: number;
  influencerClawback: number;
  treasuryClawback: number;
  influencerShare: number;
  settlementCharge: number;
  totalAmount: number;
  acceptedBy: AcceptedByType;
  feeRatio: number;
}

interface ResolutionResults {
influencerRefResult: { referrerId?: string } | undefined;
brandRefResult: { referrerId?: string } | undefined;
}

async function executeResolutionTransaction(config: ResolutionTransactionConfig): Promise<ResolutionResults> {
const {
tx,
disputeId,
dispute,
deal,
analysis,
brandUserId,
influencerUserId,
brandRefund,
influencerClawback,
treasuryClawback,
influencerShare,
settlementCharge,
totalAmount,
acceptedBy,
feeRatio,
} = config;

let actualDeduct = 0;
let debtPending = 0;

const isCompleted = deal.status === "COMPLETED";

if (
analysis.verdict !== "ESCALATE" &&
analysis.verdict !== "DISMISSED" &&
isCompleted &&
brandRefund > 0
) {
const influencerWallet = await tx.wallet.findUnique({
where: { userId: influencerUserId },
});
if (!influencerWallet) {
throw AppError.badRequest("Influencer wallet missing during clawback");
}
actualDeduct = Math.min(influencerWallet.balance, influencerClawback);
debtPending = influencerClawback - actualDeduct;
}

// Atomic Status Lock
const lockCheck = await tx.dispute.updateMany({
where: {
id: disputeId,
status: { in: ["OPEN", "TIER1_AUTO", "TIER2_MEDIATION", "TIER3_ARBITRATION"] },
},
data: {
status: analysis.verdict === "ESCALATE" ? "TIER2_MEDIATION" : "RESOLVED",
tier: analysis.verdict === "ESCALATE" ? 2 : 1,
resolution: analysis.explanation,
resolvedAt: analysis.verdict === "ESCALATE" ? null : new Date(),
resolvedAmicably: analysis.verdict !== "ESCALATE",
influencerOutcome: JSON.stringify({
payment_percentage: analysis.influencerPayoutPercentage,
trust_score_change: analysis.trustScoreChanges.influencer,
confidence: analysis.confidence,
...(debtPending > 0 ? { debtPending } : {}),
}),
brandOutcome: JSON.stringify({
refund_percentage: analysis.refundPercentage,
trust_score_change: analysis.trustScoreChanges.brand,
confidence: analysis.confidence,
}),
},
});

if (lockCheck.count === 0) {
throw AppError.badRequest("Dispute lock check failed");
}

// Handle financial resolution
const brandRefundActual = actualDeduct + treasuryClawback;
await applyFinancialResolution(tx, {
analysis,
isCompleted,
deal,
brandUserId,
influencerUserId,
actualDeduct,
debtPending,
treasuryClawback,
brandRefundActual,
influencerShare,
brandRefund,
totalAmount,
});

const { influencerRefResult, brandRefResult } = await applyDealStatusAndRevenues(tx, {
analysis,
deal,
brandUserId,
influencerUserId,
influencerShare,
feeRatio,
settlementCharge,
});

// Log activity
if (influencerUserId) {
await createActivityLog({
userId: influencerUserId,
action: "DISPUTE_RESOLUTION",
entityType: "Dispute",
entityId: disputeId,
metadata: {
verdict: analysis.verdict,
payoutPercentage: analysis.influencerPayoutPercentage,
trustChange: analysis.trustScoreChanges.influencer,
acceptedBy,
},
}, tx);
}

// dismissed, re-open the deal
if (analysis.verdict === "DISMISSED") {
let previousStatus = dispute.dealStatusAtCreation || "PAYMENT_PENDING";
if (!dispute.dealStatusAtCreation && deal.submittedContentUrl) {
previousStatus = "CONTENT_SUBMITTED";
}
await tx.deal.update({
where: { id: deal.id },
data: { status: previousStatus as DealStatus },
});
}

// Notify both parties
await createResolutionNotifications(
tx,
disputeId,
analysis.verdict,
analysis.explanation,
deal.id,
brandUserId,
influencerUserId,
);

return { influencerRefResult, brandRefResult };
}

async function validateDisputeStatus(
  checkDispute: { status: DisputeStatus; tier: number } | null,
  disputeId: string
): Promise<{ success: boolean; message: string }> {
  if (!checkDispute) return { success: false, message: "Dispute not found" };

  if (checkDispute.status === "RESOLVED") {
    return { success: false, message: "Dispute already resolved, closed, or being processed." };
  }

  if (
    checkDispute.status === "TIER2_MEDIATION" ||
    checkDispute.status === "TIER3_ARBITRATION"
  ) {
    const lock = await prisma.dispute.updateMany({
      where: { id: disputeId, status: checkDispute.status },
      data: {
        updatedAt: new Date(),
      },
    });

    if (lock.count === 0) {
      return { success: false, message: "Dispute already resolved, closed, or being processed." };
    }
  }

  return { success: true, message: "" };
}

function calculateResolutionAmounts(analysis: MediatorAnalysis, deal: FullDeal) {
let influencerShare = 0;
let brandRefund = 0;
let totalAmount = 0;
let feeRatio = 0;
let settlementCharge = 0;
let influencerClawback = 0;
let treasuryClawback = 0;

if (
analysis.verdict !== "ESCALATE" &&
analysis.verdict !== "DISMISSED"
) {
const payoutPctInput = analysis.influencerPayoutPercentage ?? 0;
const refundPctInput = analysis.refundPercentage ?? 0;
let payoutPct = Math.min(100, Math.max(0, payoutPctInput));
let refundPct = Math.min(100, Math.max(0, refundPctInput));

if (payoutPct + refundPct !== 100) {
  const total = payoutPct + refundPct;
  if (total > 0) {
    payoutPct = Math.round((payoutPct / total) * 100);
    refundPct = 100 - payoutPct;
  } else {
    payoutPct = 50;
    refundPct = 50;
  }
}

analysis.influencerPayoutPercentage = payoutPct;
analysis.refundPercentage = refundPct;

totalAmount = getDealTotalAmount(deal);
feeRatio = payoutPct / 100;
const payoutBase = deal.influencerPayout ?? deal.amount;
const feeBase = (deal.platformFee || 0) + (deal.gatewayFee || 0);
influencerShare = Math.round(payoutBase * feeRatio);
const feeShare = Math.round(feeBase * feeRatio);
settlementCharge = influencerShare + feeShare;
brandRefund = Math.round(totalAmount * (refundPct / 100));
influencerClawback = Math.round(payoutBase * (refundPct / 100));
treasuryClawback = Math.max(0, brandRefund - influencerClawback);
}

return {
influencerShare,
brandRefund,
totalAmount,
feeRatio,
settlementCharge,
influencerClawback,
treasuryClawback,
};
}

function resolveDisputeCategory(disputeType: string): ViolationCategory {
if (disputeType === "CONTENT_DELETED") return "POST_DELETION";
if (disputeType === "TIMELINE") return "MISSED_DEADLINE";
if (disputeType === "PAYMENT") return "PAYMENT_FRAUD";
return "OTHER";
}

async function applyBrandFavoredPenalty(
influencerUserId: string,
disputeType: string,
explanation: string,
submittedContentUrl?: string,
disputeId?: string
) {
const category = resolveDisputeCategory(disputeType);
try {
await applyProgressivePenalty(
influencerUserId,
category,
`Dispute resolution verdict brand favored: ${explanation || "Terms violation"}`,
submittedContentUrl
);
} catch (penaltyError) {
logger.error(
"Failed to apply progressive penalty in dispute resolution",
penaltyError instanceof Error ? penaltyError : new Error(String(penaltyError)),
{ disputeId, userId: influencerUserId }
);
}
}

async function handlePostResolutionWork(
dispute: FullDispute,
analysis: MediatorAnalysis,
deal: FullDeal,
brandUserId: string | null,
influencerUserId: string,
disputeId: string
) {
if (analysis.verdict === "ESCALATE") return;

if (analysis.verdict === "BRAND_FAVORED") {
await applyBrandFavoredPenalty(
influencerUserId,
dispute.type,
analysis.explanation,
deal.submittedContentUrl ?? undefined,
disputeId
);
} else if (analysis.trustScoreChanges.influencer !== 0) {
await updateTrustAndLevel(influencerUserId, "DISPUTE_RESOLVED");
}

if (brandUserId && analysis.trustScoreChanges.brand !== 0) {
await updateTrustAndLevel(brandUserId, "DISPUTE_RESOLVED");
}
}

async function invalidateDisputePlatformFeeCaches(
influencerRefResult: { referrerId?: string } | undefined,
brandRefResult: { referrerId?: string } | undefined,
) {
const keysToDel = [];
if (influencerRefResult?.referrerId) {
keysToDel.push(`platform_fee:effective:${influencerRefResult.referrerId}`);
}
if (brandRefResult?.referrerId && brandRefResult.referrerId !== influencerRefResult?.referrerId) {
keysToDel.push(`platform_fee:effective:${brandRefResult.referrerId}`);
}
if (keysToDel.length > 0) {
try {
await redis.del(keysToDel);
} catch (err) {
logger.warn("Failed to invalidate platform fee cache after dispute resolution", {
error: err instanceof Error ? err.message : String(err),
});
}
}
}

async function runResolutionTransactionWithRetries(params: {
disputeId: string;
dispute: FullDispute;
deal: FullDeal;
analysis: MediatorAnalysis;
brandUserId: string | null;
influencerUserId: string;
brandRefund: number;
influencerClawback: number;
treasuryClawback: number;
influencerShare: number;
settlementCharge: number;
totalAmount: number;
acceptedBy: "AUTO" | "INFLUENCER" | "BRAND" | "ADMIN";
feeRatio: number;
}) {
const MAX_RETRIES = 5;
let attempt = 0;
while (attempt < MAX_RETRIES) {
attempt++;
try {
const txResult = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
return executeResolutionTransaction({
tx,
disputeId: params.disputeId,
dispute: params.dispute,
deal: params.deal,
analysis: params.analysis,
brandUserId: params.brandUserId,
influencerUserId: params.influencerUserId,
brandRefund: params.brandRefund,
influencerClawback: params.influencerClawback,
treasuryClawback: params.treasuryClawback,
influencerShare: params.influencerShare,
settlementCharge: params.settlementCharge,
totalAmount: params.totalAmount,
acceptedBy: params.acceptedBy,
feeRatio: params.feeRatio,
});
}, {
isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
});

return txResult;
} catch (error) {
const isSerializationConflict =
error instanceof Prisma.PrismaClientKnownRequestError &&
error.code === "P2034";
if (isSerializationConflict && attempt < MAX_RETRIES) {
logger.warn(`applyResolution transaction serialization conflict (attempt ${attempt}/${MAX_RETRIES}), retrying...`, { disputeId: params.disputeId });
await new Promise((resolve) => setTimeout(resolve, randomInt(50, 151)));
continue;
}
logger.error("applyResolution transaction failed", error instanceof Error ? error : new Error(String(error)), { disputeId: params.disputeId });
throw error;
}
}
throw new Error("applyResolution transaction failed after maximum retries");
}

export async function applyResolution(
disputeId: string,
analysis: MediatorAnalysis,
acceptedBy: "AUTO" | "INFLUENCER" | "BRAND" | "ADMIN",
): Promise<{ success: boolean; message: string }> {
try {
const checkDispute = await prisma.dispute.findUnique({
where: { id: disputeId },
select: { status: true, tier: true, resolution: true },
});
const validation = await validateDisputeStatus(checkDispute, disputeId);
if (!validation.success) return validation;

const dispute = await prisma.dispute.findUnique({
where: { id: disputeId },
include: {
deal: {
include: {
campaign: {
select: { title: true, deliverables: true, requirements: true },
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
raisedBy: { select: { id: true, userType: true } },
},
});

if (!dispute) return { success: false, message: "Dispute not found" };

const deal = dispute.deal;
const influencerUserId = deal.influencer.userId;
const brandUserId = deal.brand?.userId;

const {
influencerShare,
brandRefund,
totalAmount,
feeRatio,
settlementCharge,
influencerClawback,
treasuryClawback,
} = calculateResolutionAmounts(analysis, deal);

const txResult = await runResolutionTransactionWithRetries({
disputeId,
dispute,
deal,
analysis,
brandUserId: brandUserId ?? null,
influencerUserId,
brandRefund,
influencerClawback,
treasuryClawback,
influencerShare,
settlementCharge,
totalAmount,
acceptedBy,
feeRatio,
});

const influencerRefResult = txResult.influencerRefResult;
const brandRefResult = txResult.brandRefResult;

await invalidateDisputePlatformFeeCaches(influencerRefResult, brandRefResult);

await handlePostResolutionWork(dispute, analysis, deal, brandUserId ?? null, influencerUserId, disputeId);

return {
success: true,
message:
analysis.verdict === "ESCALATE"
? "Dispute escalated to Tier 2 human mediation"
: `Dispute resolved: ${analysis.verdict.replace("_", " ")}`,
};
} catch (error) {
logger.error("applyResolution failed", error instanceof Error ? error : new Error(String(error)), { disputeId });
return { success: false, message: "Failed to apply resolution" };
}
}

// ==================== ESCALATION ====================

/**
* Escalate a dispute to the next tier.
*/
export async function escalateDispute(
disputeId: string,
reason: string,
): Promise<{ success: boolean; newTier: number }> {
const dispute = await prisma.dispute.findUnique({
where: { id: disputeId },
select: { tier: true, status: true },
});

if (!dispute) return { success: false, newTier: 0 };

const newTier = Math.min(dispute.tier + 1, 3);
const newStatus = newTier === 2 ? "TIER2_MEDIATION" : "TIER3_ARBITRATION";

await prisma.dispute.update({
where: { id: disputeId },
data: {
tier: newTier,
status: newStatus,
resolution: `Escalated: ${reason}`,
},
});

logger.info("Dispute escalated", { disputeId, newTier, reason });

return { success: true, newTier };
}

// ==================== HELPERS ====================

