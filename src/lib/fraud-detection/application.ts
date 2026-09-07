import prisma from "../db";
import { hashForDuplicateDetection } from "../encryption";
import { FraudCheckResult, FraudFlag, ApplicationCheckParams } from "./types";
import { calculateSimilarity } from "./social";
import { resolveFraudAction } from "./utils";

export async function checkApplicationFraud(
params: ApplicationCheckParams,
): Promise<FraudCheckResult> {
const flags: FraudFlag[] = [];
let riskScore = 0;

// Rule 1: Bulk applications (>10 in last hour)
// Note: Application.influencerId is the InfluencerProfile.id, not the User.id
const influencerProfile = await prisma.influencerProfile.findUnique({
where: { userId: params.userId },
select: { id: true },
});

const recentApplications = influencerProfile
? await prisma.application.count({
where: {
influencerId: influencerProfile.id,
createdAt: {
gte: new Date(Date.now() - 60 * 60 * 1000),
},
},
})
: 0;

if (recentApplications >= 10) {
flags.push({
rule: "BULK_APPLICATIONS",
severity: "HIGH",
description: `${recentApplications} applications in the last hour`,
});
riskScore += 60;
}

// Rule 2: Copy-paste proposal detection
// GUARD: Only run Jaccard similarity on substantive proposals (>20 chars).
// Short generic messages like "Hi, I'm interested" trivially produce
// high similarity scores because the word-set is tiny.
const trimmedProposal = params.proposalContent.trim();

if (trimmedProposal.length > 20) {
const recentProposals = influencerProfile
? await prisma.application.findMany({
where: {
influencerId: influencerProfile.id,
createdAt: {
gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
},
},
select: { proposal: true },
take: 10,
})
: [];

const similarProposals = recentProposals.filter(
(p: { proposal: string }) =>
calculateSimilarity(p.proposal, trimmedProposal) > 0.9,
);

if (similarProposals.length >= 2) {
flags.push({
rule: "COPY_PASTE_PROPOSALS",
severity: "HIGH",
description: `${similarProposals.length} similar proposals detected`,
});
riskScore += 50;
}
}

// Rule 3: Suspiciously low rate (potential fake deal farming)
const campaign = await prisma.campaign.findUnique({
where: { id: params.campaignId },
select: { perInfluencerBudget: true },
});

if (
campaign?.perInfluencerBudget &&
params.proposedRate &&
params.proposedRate < campaign.perInfluencerBudget * 0.2
) {
flags.push({
rule: "SUSPICIOUSLY_LOW_RATE",
severity: "MEDIUM",
description: "Proposed rate significantly below campaign budget",
});
riskScore += 30;
}

// Determine action
const action = resolveFraudAction(riskScore);

return {
passed: action === "ALLOW" || action === "FLAG",
flags,
riskScore,
action,
};
}

// ==================== PAYMENT CHECKS ====================


export async function checkWithdrawalVelocityAndLimits(
userId: string,
amount: number,
flags: FraudFlag[]
): Promise<number> {
let score = 0;
const todayWithdrawals = await prisma.withdrawal.count({
where: {
wallet: { userId },
// M15 FIX: Exclude failed/reversed withdrawals from velocity count.
// Counting failed attempts penalized users unfairly when bank/gateway was down.
status: { notIn: ["FAILED", "REVERSED"] },
createdAt: {
          gte: (() => {
            const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
            return new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 0, 0, 0) - 5.5 * 60 * 60 * 1000);
          })()
        },
},
});

if (todayWithdrawals >= 3) {
flags.push({
rule: "RAPID_WITHDRAWALS",
severity: "HIGH",
description: `${todayWithdrawals} withdrawals today`,
});
score += 60;
}

const last24hWithdrawals = await prisma.withdrawal.findMany({
      take: 50,
where: {
wallet: { userId },
status: { notIn: ["FAILED", "REVERSED"] },
createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
},
select: { amount: true },
});
const totalWithdrawn24h = last24hWithdrawals.reduce((acc: number, w: { amount: number }) => acc + w.amount, 0);
if (totalWithdrawn24h + amount > 5000000) {
flags.push({
rule: "DAILY_WITHDRAWAL_LIMIT_EXCEEDED",
severity: "HIGH",
description: `Total withdrawals in the last 24h exceeds 50,000 limit`,
});
score += 55;
}

return score;
}

export async function checkDuplicatePayoutAccounts(
userId: string,
bankAccount: string | undefined,
upiId: string | undefined,
flags: FraudFlag[]
): Promise<number> {
let score = 0;

if (bankAccount && bankAccount !== "UPI_PAYOUT") {
const bankAccountHash = hashForDuplicateDetection(bankAccount);

const duplicateBank = await prisma.withdrawal.findFirst({
where: {
bankAccountHash,
wallet: { userId: { not: userId } },
// M16 FIX: Only check COMPLETED/PROCESSING withdrawals.
// Including FAILED attempts caused false positives: a malicious actor's
// failed attempt with someone else's account would permanently block the
// legitimate owner with DUPLICATE_BANK_ACCOUNT_REUSE.
status: { in: ["COMPLETED", "PROCESSING"] },
},
select: { id: true },
});

if (duplicateBank) {
flags.push({
rule: "DUPLICATE_BANK_ACCOUNT_REUSE",
severity: "CRITICAL",
description: `This bank account is associated with another user account`,
});
score += 100;
}
}

if (upiId) {
const upiIdHash = hashForDuplicateDetection(upiId);

const duplicateUpi = await prisma.withdrawal.findFirst({
where: {
upiIdHash,
wallet: { userId: { not: userId } },
},
select: { id: true },
});

if (duplicateUpi) {
flags.push({
rule: "DUPLICATE_UPI_REUSE",
severity: "CRITICAL",
description: `This UPI ID is associated with another user account`,
});
score += 100;
}
}

return score;
}

export async function checkMultipleBankAccounts(
userId: string,
bankAccount: string | undefined,
flags: FraudFlag[]
): Promise<number> {
if (!bankAccount) return 0;

const existingWithdrawals = await prisma.withdrawal.findMany({
where: { wallet: { userId } },
select: { bankAccountHash: true },
take: 100,
});

const accountHashes = new Set<string>();
for (const w of existingWithdrawals) {
if (w.bankAccountHash) {
accountHashes.add(w.bankAccountHash);
}
}

const currentHash = hashForDuplicateDetection(bankAccount);
if (accountHashes.size >= 3 && !accountHashes.has(currentHash)) {
flags.push({
rule: "MULTIPLE_BANK_ACCOUNTS",
severity: "HIGH",
description: "Too many different bank accounts used",
});
return 45;
}

return 0;
}

