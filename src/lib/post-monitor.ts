/**
* Post Monitor Enhanced with 30-Day Monitoring & Clawback Logic
*
* Verifies if deal content is still live and compliant.
* Implements a 30-day post-completion monitoring window with:
* - Day 1-7: Daily checks
* - Day 8-14: Every 2 days
* - Day 15-30: Weekly checks
*
* Clawback triggers: If post is deleted/private within 30 days,
* a percentage of the influencer's payment is clawed back based on timing.
*
* STRICT RULE-BASED LOGIC ONLY NO ML.
*/

import prisma from "./db";
import { Prisma } from "@prisma/client";
import { checkPostVerification } from "./fraud-detection";
import { logger } from "./logger";
import { applyProgressivePenalty } from "./penalty-system";
import { NotificationService } from "@/services/notification.service";
import { createActivityLog } from "./audit";

// ==================== TYPES ====================

interface PostStatusResult {
dealId: string;
isAlive: boolean;
status: "ACTIVE" | "DELETED" | "PRIVATE" | "CHANGED";
message?: string;
monitoringDay?: number;
}

interface ClawbackResult {
dealId: string;
triggered: boolean;
clawbackPercentage: number;
clawbackAmountPaise: number;
reason: string;
}

// ==================== MONITORING SCHEDULE ====================

/**
* Determines if a deal should be checked today based on its monitoring day.
* Day 1-7: Check daily
* Day 8-14: Check every 2 days
* Day 15-30: Check weekly
* Day 31+: Monitoring complete
*/
function shouldCheckToday(completedAt?: Date | null): {
shouldCheck: boolean;
day: number;
} {
const time = completedAt?.getTime();
if (time === undefined) {
return { shouldCheck: false, day: 0 };
}
  const daysSinceCompletion = Math.max(
    0,
    Math.floor((Date.now() - time) / (86400 * 1000)),
  );

  if (daysSinceCompletion > 30) {
    return { shouldCheck: false, day: daysSinceCompletion };
  }

  if (daysSinceCompletion <= 7) {
    // Daily checks
    return { shouldCheck: true, day: daysSinceCompletion };
  }

  if (daysSinceCompletion <= 14) {
    // Every 2 days
    return {
      shouldCheck: daysSinceCompletion % 2 === 0,
      day: daysSinceCompletion,
    };
  }

  // Weekly (check on day 21 and 28)
  return {
    shouldCheck: daysSinceCompletion % 7 === 0,
    day: daysSinceCompletion,
  };
}

// ==================== CLAWBACK CALCULATION ====================

/**
* Calculate clawback percentage based on when the post was removed.
* Earlier removal = higher penalty.
*
* Day 1-3: 100% clawback (clear fraud/bad faith)
* Day 4-7: 75% clawback
* Day 8-14: 50% clawback
* Day 15-21: 25% clawback
* Day 22-30: 15% clawback (late removal, still penalized)
*/
function calculateClawbackPercentage(
daysSinceCompletion: number,
): number {
if (daysSinceCompletion <= 3) return 100;
if (daysSinceCompletion <= 7) return 75;
if (daysSinceCompletion <= 14) return 50;
if (daysSinceCompletion <= 21) return 25;
if (daysSinceCompletion <= 30) return 15;
return 0; // Past monitoring window
}

// ==================== CORE VERIFICATION ====================

async function verifyPostStatus(
dealId: string,
): Promise<PostStatusResult> {
const deal = await prisma.deal.findUnique({
where: { id: dealId },
select: {
id: true,
postUrl: true,
contractTerms: true,
postingDeadline: true,
completedAt: true,
verifiedAt: true,
postedAt: true,
influencerId: true,
consecutiveMissingChecks: true,
influencer: { select: { userId: true } },
},
});

if (!deal?.postUrl) {
return {
dealId,
isAlive: false,
status: "DELETED",
message: "No post URL found",
};
}

const termsObj = deal.contractTerms as Record<string, unknown> | null;
const rawElements = Array.isArray(termsObj?.mandatoryElements)
? termsObj.mandatoryElements
: termsObj?.mandatoryTags;
const mandatoryElements: string[] = Array.isArray(rawElements)
? rawElements.map((element) => String(element).trim()).filter(Boolean)
: [];
const requiredTags = mandatoryElements.filter((el: string) =>
el.startsWith("@"),
);
const requiredHashtags = mandatoryElements.filter((el: string) =>
el.startsWith("#"),
);

// Use existing fraud detection logic to check URL validity/access
let checkResult = await checkPostVerification({
dealId: deal.id,
influencerUserId: deal.influencer?.userId || "",
postUrl: deal.postUrl,
requiredTags,
requiredHashtags,
postingDeadline: deal.postingDeadline,
});

// Retry with backoff if check failed due to transient API/token/network issue
if (checkResult.flags.some((f) => f.rule === "POST_VERIFICATION_CHECK_FAILED")) {
for (let retry = 1; retry <= 2; retry++) {
await new Promise((resolve) => setTimeout(resolve, retry * 1500));
checkResult = await checkPostVerification({
dealId: deal.id,
influencerUserId: deal.influencer?.userId || "",
postUrl: deal.postUrl,
requiredTags,
requiredHashtags,
postingDeadline: deal.postingDeadline,
});
if (!checkResult.flags.some((f) => f.rule === "POST_VERIFICATION_CHECK_FAILED")) {
break;
}
}
}

// Determine status based on flags
const isCheckFailed = checkResult.flags.some(
(f) => f.rule === "POST_VERIFICATION_CHECK_FAILED" || f.rule === "OFFICIAL_VERIFICATION_UNAVAILABLE",
);
const isUnreachable = checkResult.flags.some(
(f) => f.rule === "POST_NO_LONGER_ACCESSIBLE",
);
const isPrivate = checkResult.flags.some((f) => f.rule === "POST_IS_PRIVATE");

// Calculate monitoring day fallback: completedAt verifiedAt postedAt
const referenceDate = deal.completedAt ?? deal.verifiedAt ?? deal.postedAt;
const monitoringDay = referenceDate
? Math.floor(
(Date.now() - new Date(referenceDate).getTime()) / (86400 * 1000),
)
: 0;

// 1. Transient Check Failure: Do NOT mark deleted and do NOT execute clawback
if (isCheckFailed && !isUnreachable && !isPrivate) {
logger.warn("Post check inconclusive due to transient API error; skipping clawback and retaining post status", {
dealId,
flags: checkResult.flags,
});
await prisma.deal.update({
where: { id: dealId },
data: {
lastPostCheck: new Date(),
postCheckCount: { increment: 1 },
},
});
return {
dealId,
isAlive: true,
status: "ACTIVE",
message: "Post check inconclusive due to transient API failure; clawback deferred",
monitoringDay,
};
}

// 2. Confirmed Unreachable or Private
if (isUnreachable || isPrivate) {
const failureStatus: "DELETED" | "PRIVATE" = isUnreachable ? "DELETED" : "PRIVATE";
const currentConsecutive = deal.consecutiveMissingChecks ?? 0;
const newConsecutive = currentConsecutive + 1;

if (newConsecutive < 2) {
// 1st confirmed deletion check: Warn creator, give 24h grace period, do NOT execute clawback
await prisma.deal.update({
where: { id: dealId },
data: {
consecutiveMissingChecks: newConsecutive,
lastPostCheck: new Date(),
postCheckCount: { increment: 1 },
},
});

if (deal.influencer?.userId) {
await NotificationService.createNotification({
userId: deal.influencer.userId,
type: "trust_warning",
title: "Action Required: Post Not Detected",
message: `Our monitoring could not locate your post for deal #${deal.id.slice(-6)} on day ${monitoringDay}. Please ensure the post is public. If unconfirmed on the next daily check, automated clawback will be initiated.`,
data: { dealId: deal.id, monitoringDay, checkNumber: 1 },
});
}

logger.warn("Post confirmed missing on first check; 24h grace warning issued to creator, clawback withheld pending 2nd consecutive check", {
dealId,
status: failureStatus,
monitoringDay,
consecutiveMissingChecks: newConsecutive,
});

return {
dealId,
isAlive: true,
status: failureStatus,
message: "First confirmed missing check; 24h grace warning issued, clawback pending next check",
monitoringDay,
};
}

// 2+ consecutive confirmed deletions: Proceed with clawback
await prisma.deal.update({
where: { id: dealId },
data: {
consecutiveMissingChecks: newConsecutive,
},
});

await handlePostFailure(deal, failureStatus, monitoringDay);
return {
dealId,
isAlive: false,
status: failureStatus,
message: `Post confirmed ${failureStatus.toLowerCase()} across ${newConsecutive} consecutive checks`,
monitoringDay,
};
}

// 3. Post is alive and active: Reset consecutive missing count
await prisma.deal.update({
where: { id: dealId },
data: {
lastPostCheck: new Date(),
postCheckCount: { increment: 1 },
isPostAlive: true,
consecutiveMissingChecks: 0,
},
});

return { dealId, isAlive: true, status: "ACTIVE", monitoringDay };
}

// ==================== FAILURE HANDLING + CLAWBACK ====================

async function notifyPartiesAboutPostFailure(
deal: {
id: string;
postUrl?: string | null;
influencer?: { userId: string } | null;
completedAt?: Date | null;
},
status: "DELETED" | "PRIVATE",
monitoringDay: number,
clawback: ClawbackResult | null,
ownerUserId?: string | null
) {
// 4. Notify deal owner (brand) with clawback info
if (ownerUserId) {
const clawbackMsg = clawback?.triggered
? ` A ${clawback.clawbackPercentage}% clawback (${(clawback.clawbackAmountPaise / 100).toFixed(2)}) has been initiated.`
: "";
await NotificationService.createNotification({
userId: ownerUserId,
type: "alert",
title:
status === "DELETED" ? " Post Deleted!" : " Post Made Private!",
message: `Our monitoring detected that the post for deal #${deal.id.slice(-6)} was ${status.toLowerCase()} on day ${monitoringDay} of the 30-day window.${clawbackMsg}`,
data: structuredClone({
dealId: deal.id,
postUrl: deal.postUrl,
monitoringDay,
clawback,
}),
});
}

// 5. Notify influencer about consequence
if (deal.influencer?.userId) {
const clawbackMsg = clawback?.triggered
? ` ${(clawback.clawbackAmountPaise / 100).toFixed(2)} (${clawback.clawbackPercentage}%) has been deducted from your wallet.`
: "";
await NotificationService.createNotification({
userId: deal.influencer.userId,
type: "trust_warning",
title: " Post Removal Detected",
message: `Your post for deal #${deal.id.slice(-6)} was detected as ${status.toLowerCase()} on day ${monitoringDay}.${clawbackMsg} This affects your trust score.`,
data: { dealId: deal.id, monitoringDay },
});
}
}

async function handlePostFailure(
deal: {
id: string;
postUrl?: string | null;
influencer?: { userId: string } | null;
completedAt?: Date | null;
},
status: "DELETED" | "PRIVATE",
monitoringDay: number,
) {
try {
// 1. Mark post as not alive
await prisma.deal.update({
where: { id: deal.id },
data: {
isPostAlive: false,
lastPostCheck: new Date(),
postCheckCount: { increment: 1 },
},
});

// 2. Calculate and execute clawback if within 30 days
let clawback: ClawbackResult | null = null;
if (monitoringDay <= 30) {
clawback = await executeClawback(deal.id, monitoringDay, status);
}

// 3. Fetch brand userId for notification
const fullDeal = await prisma.deal.findUnique({
where: { id: deal.id },
select: {
amount: true,
brand: { select: { userId: true } },
},
});

const ownerUserId = fullDeal?.brand?.userId;

// 4 & 5. Notify parties
await notifyPartiesAboutPostFailure(deal, status, monitoringDay, clawback, ownerUserId);

// 6. Log activity for audit trail
if (deal.influencer?.userId) {
await createActivityLog({
userId: deal.influencer.userId,
action: "POST_STATUS_CHANGE",
metadata: {
dealId: deal.id,
status,
postUrl: deal.postUrl,
monitoringDay,
clawbackTriggered: clawback?.triggered || false,
clawbackPercentage: clawback?.clawbackPercentage || 0,
detectedAt: new Date().toISOString(),
},
});
}

// 7. Apply progressive penalty and record violation
if (deal.influencer?.userId) {
try {
await applyProgressivePenalty(
deal.influencer.userId,
"POST_DELETION",
`Post ${status.toLowerCase()} on day ${monitoringDay} of 30-day monitoring window for deal ${deal.id}`,
deal.postUrl || undefined
);
} catch (penaltyError) {
logger.error("Failed to apply progressive penalty after post failure", penaltyError instanceof Error ? penaltyError : new Error(String(penaltyError)), {
dealId: deal.id,
userId: deal.influencer.userId,
});
}
}
} catch (error) {
logger.error("PostMonitor handlePostFailure error", error instanceof Error ? error : new Error(String(error)), {
dealId: deal.id,
});
}
}

// ==================== CLAWBACK EXECUTION ====================

interface PerformClawbackTransactionConfig {
tx: Prisma.TransactionClient;
influencerUserId: string;
clawbackAmountPaise: number;
brandUserId?: string | null;
dealId: string;
clawbackPercentage: number;
reason: string;
monitoringDay: number;
}

interface DeductInfluencerConfig {
tx: Prisma.TransactionClient;
influencerWallet: { id: string };
influencerUserId: string;
deductAmount: number;
debtPending: number;
brandUserId: string | null | undefined;
dealId: string;
clawbackPercentage: number;
reason: string;
monitoringDay: number;
}

async function deductInfluencerAndCreateDebtClaim(config: DeductInfluencerConfig) {
const {
tx,
influencerWallet,
influencerUserId,
deductAmount,
debtPending,
brandUserId,
dealId,
clawbackPercentage,
reason,
monitoringDay,
} = config;
await tx.wallet.update({
where: { userId: influencerUserId },
data: {
...(deductAmount > 0 ? { balance: { decrement: deductAmount } } : {}),
...(debtPending > 0 ? { debt: { increment: debtPending } } : {}),
},
});

if (debtPending > 0 && brandUserId) {
await tx.debtClaim.create({
data: {
debtorWalletId: influencerWallet.id,
creditorUserId: brandUserId,
dealId: dealId,
amount: debtPending,
originalAmount: debtPending,
status: "PENDING",
},
});
}

  const debtSuffix = debtPending > 0 ? ` (Pending debt: ${debtPending} Paise)` : "";
  const description = `Clawback (${clawbackPercentage}%) Post ${reason} on day ${monitoringDay} of 30-day window${debtSuffix}`;

  await tx.transaction.create({
    data: {
      walletId: influencerWallet.id,
      amount: deductAmount,
      type: "DEBIT",
      dealId,
      description,
      status: "COMPLETED",
      metadata: {
        balanceImpact: deductAmount > 0,
        source: "post_monitoring_clawback",
      },
    },
  });
}

async function creditBrandForClawback(
tx: Prisma.TransactionClient,
brandUserId: string,
deductAmount: number,
debtPending: number,
dealId: string,
reason: string,
monitoringDay: number,
) {
  const brandWallet = await tx.wallet.upsert({
    where: { userId: brandUserId },
    create: { userId: brandUserId, balance: deductAmount, pendingBalance: 0 },
    update: { balance: { increment: deductAmount } },
  });

  const unrecoveredSuffix = debtPending > 0 ? ` (Unrecovered debt: ${debtPending} paise)` : "";
  const brandDescription = `Clawback refund Influencer post ${reason} on day ${monitoringDay}${unrecoveredSuffix}`;

  await tx.transaction.create({
    data: {
      walletId: brandWallet.id,
      amount: deductAmount,
      type: "CREDIT",
      dealId,
      description: brandDescription,
      status: "COMPLETED",
    },
  });
}

async function performClawbackTransaction(config: PerformClawbackTransactionConfig) {
const {
tx,
influencerUserId,
clawbackAmountPaise,
brandUserId,
dealId,
clawbackPercentage,
reason,
monitoringDay,
} = config;

const influencerWallet = await tx.wallet.findUnique({
where: { userId: influencerUserId },
});

if (!influencerWallet) return;

const deductAmount = Math.max(0, Math.min(influencerWallet.balance, clawbackAmountPaise));
const debtPending = clawbackAmountPaise - deductAmount;

if (deductAmount > 0 || debtPending > 0) {
await deductInfluencerAndCreateDebtClaim({
tx,
influencerWallet,
influencerUserId,
deductAmount,
debtPending,
brandUserId,
dealId,
clawbackPercentage,
reason,
monitoringDay,
});
}

if (brandUserId && deductAmount > 0) {
await creditBrandForClawback(
tx,
brandUserId,
deductAmount,
debtPending,
dealId,
reason,
monitoringDay,
);
}
}

async function executeClawback(
dealId: string,
monitoringDay: number,
reason: string,
): Promise<ClawbackResult> {
const clawbackPercentage = calculateClawbackPercentage(monitoringDay);

if (clawbackPercentage === 0) {
return {
dealId,
triggered: false,
clawbackPercentage: 0,
clawbackAmountPaise: 0,
reason: "Past monitoring window",
};
}

const deal = await prisma.deal.findUnique({
where: { id: dealId },
select: {
amount: true,
influencerPayout: true,
status: true,
influencer: {
select: {
userId: true,
user: { select: { id: true } },
},
},
brand: { select: { userId: true } },
},
});

if (deal?.status !== "COMPLETED") {
return {
dealId,
triggered: false,
clawbackPercentage: 0,
clawbackAmountPaise: 0,
reason: deal ? "Deal is not completed; clawback skipped" : "Deal not found",
};
}

  // Idempotency guard: if a clawback transaction or debt claim already exists for this deal, skip.
  // Prevents double-deduction when two concurrent cron instances both see isPostAlive=true
  // before either has written isPostAlive=false.
  const [existingClawback, existingDebtClaim] = await Promise.all([
    prisma.transaction.findFirst({
      where: { dealId, type: "DEBIT", description: { contains: "Clawback" } },
      select: { id: true },
    }),
    prisma.debtClaim.findFirst({
      where: { dealId },
      select: { id: true },
    }),
  ]);

  if (existingClawback || existingDebtClaim) {
    logger.warn("Clawback already executed for deal; skipping duplicate", { dealId });
    return {
      dealId,
      triggered: false,
      clawbackPercentage,
      clawbackAmountPaise: 0,
      reason: "Clawback already recorded idempotency guard triggered",
    };
  }

// Use influencerPayout (net, after platform fee) as the clawback base.
// deal.amount is the gross creator fee which includes the platform fee portion;
// the influencer never received that portion so we must not claw it back.
const clawbackBase = deal.influencerPayout ?? deal.amount;
const clawbackAmountPaise = Math.round((clawbackBase * clawbackPercentage) / 100);
const influencerUserId = deal.influencer.userId;
const brandUserId = deal.brand?.userId;

try {
await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
await performClawbackTransaction({
tx,
influencerUserId,
clawbackAmountPaise,
brandUserId: brandUserId ?? null,
dealId,
clawbackPercentage,
reason,
monitoringDay,
});
});

logger.info("Clawback executed", {
dealId,
monitoringDay,
clawbackPercentage,
clawbackAmountPaise,
});

return {
dealId,
triggered: true,
clawbackPercentage,
clawbackAmountPaise,
reason: `Post ${reason} on day ${monitoringDay} ${clawbackPercentage}% clawback applied`,
};
} catch (error) {
logger.error("Clawback execution failed", error instanceof Error ? error : new Error(String(error)), { dealId });
return {
dealId,
triggered: false,
clawbackPercentage,
clawbackAmountPaise,
reason: "Clawback execution failed due to error",
};
}
}

function checkIsStoryDeal(contractTerms: unknown): boolean {
if (!contractTerms || typeof contractTerms !== "object") return false;
const terms = contractTerms as Record<string, unknown>;

if (typeof terms.deliverableType === "string" && terms.deliverableType.toUpperCase().includes("STORY")) {
return true;
}

if (Array.isArray(terms.deliverables)) {
return terms.deliverables.some((d) => {
const item = d && typeof d === "object" ? (d as Record<string, unknown>) : null;
const type = item?.type;
return typeof type === "string" && type.toUpperCase().includes("STORY");
});
}

return false;
}

// ==================== BATCH MONITORING (CRON) ====================

/**
* Run daily post monitoring for all deals in the 30-day window.
* Returns summary of checks and any failures detected.
*/
/** Finalise monitoring for a story deal that has passed its 24-hour window. */
async function finaliseStoryDeal(
dealId: string,
lastPostCheck: Date | null,
referenceDate: Date,
): Promise<void> {
const hasFinalCheck =
lastPostCheck && new Date(lastPostCheck).getTime() > referenceDate.getTime();
if (hasFinalCheck) return;

await prisma.deal.update({
where: { id: dealId },
data: {
lastPostCheck: new Date(),
isPostAlive: true,
postCheckCount: { increment: 1 },
},
});
}

/** Run a single post-existence check for a regular (non-story) deal. */
async function checkRegularPost(
dealId: string,
referenceDate: Date,
counters: { alive: number; failed: number; clawbacksTriggered: number },
): Promise<void> {
const { shouldCheck, day } = shouldCheckToday(referenceDate);
if (!shouldCheck) return;

const result = await verifyPostStatus(dealId);
if (result.isAlive) {
counters.alive++;
} else {
counters.failed++;
if (day <= 30) counters.clawbacksTriggered++;
}
}

interface MonitoringCounters {
totalChecked: number;
alive: number;
failed: number;
clawbacksTriggered: number;
skipped: number;
}

async function processSingleDealMonitoring(
deal: { id: string; completedAt: Date | null; verifiedAt: Date | null; postedAt: Date | null; contractTerms: Prisma.JsonValue | null; lastPostCheck: Date | null },
counters: MonitoringCounters
): Promise<void> {
const referenceDate = deal.completedAt ?? deal.verifiedAt ?? deal.postedAt;

if (!referenceDate) {
logger.warn("Post monitor: deal has no usable reference date, skipping", {
dealId: deal.id,
});
counters.skipped++;
return;
}

const isStory = checkIsStoryDeal(deal.contractTerms);
const daysSinceCompletion = Math.floor(
(Date.now() - referenceDate.getTime()) / (86400 * 1000)
);

if (isStory && daysSinceCompletion >= 1) {
await finaliseStoryDeal(deal.id, deal.lastPostCheck, referenceDate);
counters.skipped++;
return;
}

if (!shouldCheckToday(referenceDate).shouldCheck) {
counters.skipped++;
return;
}

try {
const regularCounters = { alive: counters.alive, failed: counters.failed, clawbacksTriggered: counters.clawbacksTriggered };
await checkRegularPost(deal.id, referenceDate, regularCounters);
counters.alive = regularCounters.alive;
counters.failed = regularCounters.failed;
counters.clawbacksTriggered = regularCounters.clawbacksTriggered;
counters.totalChecked++;
} catch (error) {
logger.error("Daily monitoring check failed", error instanceof Error ? error : new Error(String(error)), { dealId: deal.id });
counters.failed++;
}
}

export async function runDailyPostMonitoring(): Promise<{
totalChecked: number;
alive: number;
failed: number;
clawbacksTriggered: number;
skipped: number;
}> {
const thirtyOneDaysAgo = new Date(Date.now() - 31 * 86400 * 1000);

// Monitor only completed deals because clawback requires a settled payout.
const deals = await prisma.deal.findMany({
where: {
status: "COMPLETED",
isPostAlive: true,
postUrl: { not: null },
OR: [
{ completedAt: { gte: thirtyOneDaysAgo } },
{ verifiedAt: { gte: thirtyOneDaysAgo } },
{ postedAt: { gte: thirtyOneDaysAgo } },
],
},
select: {
id: true,
completedAt: true,
verifiedAt: true,
postedAt: true,
contractTerms: true,
lastPostCheck: true,
},
});

const counters: MonitoringCounters = {
totalChecked: 0,
alive: 0,
failed: 0,
clawbacksTriggered: 0,
skipped: 0,
};

for (const deal of deals) {
await processSingleDealMonitoring(deal, counters);

// Rate limit: 100ms between checks to avoid overwhelming external services
await new Promise((resolve) => setTimeout(resolve, 100));
}

return counters;
}

