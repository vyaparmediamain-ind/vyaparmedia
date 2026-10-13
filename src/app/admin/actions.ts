"use server";

import { z } from "zod";
import { AppError } from "@/lib/errors";

import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { NotificationService } from "@/services/notification.service";
import { revalidatePath } from "next/cache";
import { checkAndAwardBadges, awardBadgeIfNotExists } from "@/lib/gamification-engine";
import { BADGES } from "@/lib/badges";
import { auth } from "@/lib/auth";
import { createActivityLog } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { AdminService } from "@/services/admin.service";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { invalidateUserKYCCache } from "@/lib/kyc";
import {
  checkAdminBanEligibility,
  checkAdminApplicationReviewEligibility,
  checkAdminVerificationReviewEligibility,
} from "@/lib/action-eligibility";
import { MatchingService } from "@/services/matching.service";
import { PaymentService } from "@/services/payment.service";
import { transitionDealState } from "@/lib/deal-state-machine";
import { invalidateDealCache } from "@/services/deal/helpers";

async function requireAdmin() {
const session = await auth();
await requireActiveAdmin(session?.user);
return session!;
}

function getMissingVerificationDocs(
userType: string,
verifiedDocs: string[],
): string[] {
if (userType !== "BRAND") {
return ["PAN_CARD", "AADHAAR", "BANK_STATEMENT"].filter(
(doc) => !verifiedDocs.includes(doc),
);
}

const missing = ["PAN_CARD", "BANK_STATEMENT"].filter(
(doc) => !verifiedDocs.includes(doc),
);
const hasBusinessProof = [
"GST_CERTIFICATE",
"CIN_CERTIFICATE",
"MSME_CERTIFICATE",
"STARTUP_CERTIFICATE",
].some((doc) => verifiedDocs.includes(doc));

return hasBusinessProof ? missing : [...missing, "BUSINESS_PROOF"];
}

async function promoteToFullyVerified(
tx: Prisma.TransactionClient,
userId: string,
currentTrustScore: number,
) {
await tx.user.update({
where: { id: userId },
data: {
status: "ACTIVE",
verificationLevel: "FULL",
trustScore: Math.max(currentTrustScore, 50),
},
});

await checkAndAwardBadges(userId, "VERIFICATION", tx);

await NotificationService.createNotification({
userId,
type: "system",
title: "Verification Approved",
message:
"Your profile is now fully verified. You can now create campaigns and hire influencers!",
}, tx);
}

export async function approveUser(userId: string) {
  const _session = await requireAdmin();
  const reviewEligibility = checkAdminVerificationReviewEligibility(userId, _session.user.id);
  if (!reviewEligibility.allowed) {
    throw AppError.forbidden(reviewEligibility.reason || "Admins cannot self-approve their own account verification");
  }

  // Custom logic not yet in Service, keeping here but using transaction
  await prisma.$transaction(
async (tx: Prisma.TransactionClient) => {
// Accept pending docs
await tx.verificationDocument.updateMany({
where: {
userId: userId,
status: "PENDING",
},
data: {
status: "VERIFIED",
verifiedAt: new Date(),
},
      });

      const taxCompliance = await tx.indiaTaxCompliance.findUnique({
        where: { userId },
      });
      if (taxCompliance) {
        let nextTdsSection = taxCompliance.tdsSection;
        if (nextTdsSection?.endsWith("_REVIEW")) {
          nextTdsSection = nextTdsSection.replace("_REVIEW", "");
        }
        await tx.indiaTaxCompliance.update({
          where: { userId },
          data: {
            status: "VERIFIED",
            verifiedAt: new Date(),
            rejectionReason: null,
            tdsSection: nextTdsSection,
          },
        });
      }

      const user = await tx.user.findUnique({
where: { id: userId },
include: { verificationDocs: true },
});

if (!user) throw AppError.notFound("User not found");

const docs = user.verificationDocs;
const verifiedDocs = docs
.filter((d) => d.status === "VERIFIED" || d.status === "PENDING")
.map((d) => d.type);

const missingDocs = getMissingVerificationDocs(user.userType, verifiedDocs);

if (missingDocs.length > 0) {
// Missing docs -> PARTIAL
await tx.user.update({
where: { id: userId },
data: {
status: "PENDING_VERIFICATION", // Needs more actions
verificationLevel: "BASIC", // Downgraded to BASIC instead of invalid PARTIAL
trustScore: Math.max(user.trustScore, 50),
},
});

await NotificationService.createNotification({
userId,
type: "system",
title: "Document Verified (Action Required)",
message: `Your document was approved, but we still need: ${missingDocs.map((m) => m.replace("_", " ")).join(", ")} to fully verify your account.`,
}, tx);
} else {
// Fully verified
await promoteToFullyVerified(tx, userId, user.trustScore);
}
},
{
maxWait: 10000,
timeout: 15000,
},
);

revalidatePath("/admin/verifications");
revalidatePath(`/admin/verifications/${userId}`);
await invalidateUserKYCCache(userId);

await createActivityLog({
  userId: _session.user.id,
  action: "KYC_APPROVED",
  entityType: "USER",
  entityId: userId,
  metadata: { adminEmail: _session.user.email },
}).catch((err) => {
  logger.warn("Failed to record KYC_APPROVED admin activity log", { userId, error: err });
});
}

export async function rejectUser(userId: string, reason: string) {
  const _session = await requireAdmin();
  const reviewEligibility = checkAdminVerificationReviewEligibility(userId, _session.user.id);
  if (!reviewEligibility.allowed) {
    throw AppError.forbidden(reviewEligibility.reason || "Admins cannot review their own account verification");
  }
  const validatedReason = z
    .string()
    .trim()
    .min(5, "Reason must be at least 5 characters")
    .max(500, "Reason cannot exceed 500 characters")
    .parse(reason);

  // Use Service for status update?
  // AdminService.updateUserStatus supports 'set_verification' but logic here is specific to rejection
  // Let's stick to direct DB for now as it's specific to verification flow not generic status management

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        status: "PENDING_VERIFICATION",
        verificationLevel: "NONE",
        trustScore: 0,
      },
    });

    await tx.verificationDocument.updateMany({
      where: {
        userId: userId,
        status: "PENDING",
      },
      data: {
        status: "REJECTED",
        rejectionReason: validatedReason,
      },
    });

    await NotificationService.createNotification({
      userId,
      type: "system",
      title: "Verification Rejected",
      message: `Your verification was rejected. Reason: ${validatedReason}. Please re-upload documents.`,
    }, tx);
  });

revalidatePath("/admin/verifications");
revalidatePath(`/admin/verifications/${userId}`);
await invalidateUserKYCCache(userId);

await createActivityLog({
  userId: _session.user.id,
  action: "KYC_REJECTED",
  entityType: "USER",
  entityId: userId,
  metadata: { adminEmail: _session.user.email, reason: validatedReason },
}).catch((err) => {
  logger.warn("Failed to record KYC_REJECTED admin activity log", { userId, reason: validatedReason, error: err });
});
}

export async function approveDocument(docId: string, userId: string) {
  const session = await requireAdmin();
  if (session.user.id === userId) {
    throw AppError.forbidden("Admins cannot self-approve their own documents");
  }

  await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const existingDoc = await tx.verificationDocument.findUnique({
        where: { id: docId },
        select: { userId: true },
      });
      if (!existingDoc || existingDoc.userId !== userId) {
        throw AppError.notFound("Document not found for this user");
      }

      const doc = await tx.verificationDocument.update({
        where: { id: docId },
        data: {
          status: "VERIFIED",
          verifiedAt: new Date(),
          rejectionReason: null,
        },
      });

      if (doc.type === "PAN_CARD" || doc.type === "GST_CERTIFICATE") {
        const taxCompliance = await tx.indiaTaxCompliance.findUnique({
          where: { userId },
        });
        if (taxCompliance) {
          let nextTdsSection = taxCompliance.tdsSection;
          if (nextTdsSection?.endsWith("_REVIEW")) {
            nextTdsSection = nextTdsSection.replace("_REVIEW", "");
          }
          await tx.indiaTaxCompliance.update({
            where: { userId },
            data: {
              status: "VERIFIED",
              verifiedAt: new Date(),
              rejectionReason: null,
              tdsSection: nextTdsSection,
            },
          });
        }
      }

const user = await tx.user.findUnique({
where: { id: userId },
include: { verificationDocs: true },
});

if (!user) throw AppError.notFound("User not found");

const docs = user.verificationDocs;
// Count just approved doc + any existing verified
const verifiedDocs = docs
.filter((d) => d.id === docId || d.status === "VERIFIED")
.map((d) => d.type);

const missingDocs = getMissingVerificationDocs(user.userType, verifiedDocs);

if (missingDocs.length === 0 && user.verificationLevel !== "FULL") {
await promoteToFullyVerified(tx, userId, user.trustScore);
}
},
{ maxWait: 10000, timeout: 15000 },
);

revalidatePath("/admin/verifications");
revalidatePath(`/admin/verifications/${userId}`);
await invalidateUserKYCCache(userId);
}

export async function rejectDocument(
  docId: string,
  userId: string,
  reason: string,
) {
  await requireAdmin();
  const validatedReason = z
    .string()
    .trim()
    .min(5, "Reason must be at least 5 characters")
    .max(500, "Reason cannot exceed 500 characters")
    .parse(reason);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existingDoc = await tx.verificationDocument.findUnique({
      where: { id: docId },
      select: { userId: true, type: true },
    });
    if (!existingDoc || existingDoc.userId !== userId) {
      throw AppError.notFound("Document not found for this user");
    }

    const doc = await tx.verificationDocument.update({
      where: { id: docId },
      data: { status: "REJECTED", rejectionReason: validatedReason },
    });

    if (doc.type === "PAN_CARD" || doc.type === "GST_CERTIFICATE") {
      await tx.indiaTaxCompliance.updateMany({
        where: { userId },
        data: {
          status: "REJECTED",
          rejectionReason: validatedReason,
          verifiedAt: null,
        },
      });
    }

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { verificationLevel: true },
    });

    if (user?.verificationLevel === "FULL") {
      await tx.user.update({
        where: { id: userId },
        data: { verificationLevel: "BASIC", status: "PENDING_VERIFICATION" }, // Downgrade
      });
    }

    await NotificationService.createNotification({
      userId,
      type: "system",
      title: "Document Rejected",
      message: `Your ${doc.type.replace("_", " ")} was rejected. Reason: ${validatedReason}. Please re-upload.`,
    }, tx);
  });

  revalidatePath("/admin/verifications");
  revalidatePath(`/admin/verifications/${userId}`);
  await invalidateUserKYCCache(userId);
}

export async function banUser(userId: string) {
const session = await requireAdmin();

const banCheck = checkAdminBanEligibility(session.user.id, userId);
if (!banCheck.allowed) {
throw AppError.badRequest(banCheck.reason || "Cannot ban this user");
}

await AdminService.updateUserStatus(session.user, userId, {
action: "ban",
reason: "Admin banned via action",
});

revalidatePath("/admin/users");
}

export async function unbanUser(userId: string) {
const session = await requireAdmin();

await AdminService.updateUserStatus(session.user, userId, {
action: "activate",
reason: "Admin unbanned via action",
});

revalidatePath("/admin/users");
}

export async function approveFlaggedApplication(applicationId: string) {
  const _session = await requireAdmin();

  const existingApp = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { status: true, influencer: { select: { userId: true } } },
  });

  if (!existingApp) throw AppError.notFound("Application not found");
  const eligibility = checkAdminApplicationReviewEligibility(existingApp.status);
  if (!eligibility.allowed) {
    throw AppError.badRequest(eligibility.reason || `Cannot approve application with status ${existingApp.status}.`);
  }

  const app = await prisma.application.update({
    where: { id: applicationId },
    data: { status: "PENDING" },
    select: { influencer: { select: { userId: true } } },
  });

  if (app?.influencer?.userId) {
    await NotificationService.createNotification({
      userId: app.influencer.userId,
      type: "system",
      title: "Application Approved by Admin",
      message: "Your flagged application was reviewed and approved. It is now pending brand selection.",
    });
  }

  revalidatePath("/admin");

  await createActivityLog({
    userId: _session.user.id,
    action: "FLAGGED_APPLICATION_APPROVED",
    entityType: "APPLICATION",
    entityId: applicationId,
    metadata: { adminEmail: _session.user.email },
  }).catch((err) => {
    logger.warn("Failed to record FLAGGED_APPLICATION_APPROVED admin activity log", { applicationId, error: err });
  });
}

export async function rejectFlaggedApplication(applicationId: string, reason: string) {
  const _session = await requireAdmin();

  const existingApp = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { status: true, influencer: { select: { userId: true } } },
  });

  if (!existingApp) throw AppError.notFound("Application not found");
  const eligibility = checkAdminApplicationReviewEligibility(existingApp.status);
  if (!eligibility.allowed) {
    throw AppError.badRequest(eligibility.reason || `Cannot reject application with status ${existingApp.status}.`);
  }

  const app = await prisma.application.update({
    where: { id: applicationId },
    data: { status: "REJECTED" },
    select: { influencer: { select: { userId: true } } },
  });

if (app?.influencer?.userId) {
await NotificationService.createNotification({
userId: app.influencer.userId,
type: "system",
title: "Application Rejected",
message: `Your application was rejected by security review. Reason: ${reason}`,
});
}

revalidatePath("/admin");

await createActivityLog({
  userId: _session.user.id,
  action: "FLAGGED_APPLICATION_REJECTED",
  entityType: "APPLICATION",
  entityId: applicationId,
  metadata: { adminEmail: _session.user.email, reason },
}).catch((err) => {
  logger.warn("Failed to record FLAGGED_APPLICATION_REJECTED admin activity log", { applicationId, reason, error: err });
});
}

async function awardBadgeManually(targetUserId: string, badgeId: string) {
const _session = await requireAdmin();

const user = await prisma.user.findUnique({
where: { id: targetUserId },
});
if (!user) {
throw AppError.notFound("User not found");
}

// Award the badge using the existing gamification engine function
await awardBadgeIfNotExists(targetUserId, badgeId);

// Notify the user about the badge award
const badgeDef = BADGES.find((b) => b.id === badgeId);
await NotificationService.createNotification({
userId: targetUserId,
type: "badge",
title: ` Badge Awarded: ${badgeDef?.name || badgeId}`,
message: `An admin has manually awarded you the "${badgeDef?.name || badgeId}" badge!`,
});

revalidatePath("/admin/users");
revalidatePath(`/admin/users/${targetUserId}`);

await createActivityLog({
  userId: _session.user.id,
  action: "BADGE_AWARDED_MANUALLY",
  entityType: "USER",
  entityId: targetUserId,
  metadata: { adminEmail: _session.user.email, badgeId },
}).catch((err) => {
  logger.warn("Failed to record BADGE_AWARDED_MANUALLY admin activity log", { targetUserId, badgeId, error: err });
});
}

export async function awardBadgeAction(formData: FormData) {
  const session = await requireAdmin();
  const userId = formData.get("userId") as string;
  const badgeId = formData.get("badgeId") as string;
  if (!userId || !badgeId) return;
  if (session.user.id === userId) {
    throw AppError.forbidden("Admins cannot award badges to their own accounts");
  }
  await awardBadgeManually(userId, badgeId);
}

export async function resolveFraudAppealAction(
  targetUserId: string,
  decision: "APPROVE_APPEAL" | "CONFIRM_FLAG",
  notes?: string
) {
  const session = await requireAdmin();
  const result = await AdminService.resolveInfluencerFraudAppeal(
    session.user.id,
    targetUserId,
    decision,
    notes
  );
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${targetUserId}`);
  return result;
}

export async function updateCategoryBenchmarkAction(
  category: string,
  baselinePaise: number
) {
  const session = await requireAdmin();
  if (!category || typeof category !== "string") {
    throw AppError.badRequest("Valid category is required");
  }
  if (!baselinePaise || baselinePaise < 1 || baselinePaise > 5000) {
    throw AppError.badRequest("Baseline CPV must be between 1 paise and 5000 paise (₹50)");
  }

  await MatchingService.updateCategoryBaselineCpv(category, baselinePaise, session.user.id);

  await createActivityLog({
    userId: session.user.id,
    action: "CATEGORY_BENCHMARK_UPDATED",
    entityType: "SYSTEM_CONFIG",
    entityId: category,
    metadata: {
      category,
      baselinePaise,
      baselineRupees: (baselinePaise / 100).toFixed(2),
      adminEmail: session.user.email,
    },
  }).catch((err) => {
    logger.warn("Failed to record CATEGORY_BENCHMARK_UPDATED admin activity log", { category, baselinePaise, error: err });
  });

  revalidatePath("/admin/benchmarks");
  revalidatePath("/admin");
  return { success: true, category, baselinePaise };
}

export async function resetCategoryBenchmarkAction(category: string) {
  const session = await requireAdmin();
  if (!category || typeof category !== "string") {
    throw AppError.badRequest("Valid category is required");
  }

  await MatchingService.resetCategoryBaselineCpv(category, session.user.id);

  await createActivityLog({
    userId: session.user.id,
    action: "CATEGORY_BENCHMARK_RESET",
    entityType: "SYSTEM_CONFIG",
    entityId: category,
    metadata: {
      category,
      adminEmail: session.user.email,
    },
  }).catch((err) => {
    logger.warn("Failed to record CATEGORY_BENCHMARK_RESET admin activity log", { category, error: err });
  });

  revalidatePath("/admin/benchmarks");
  revalidatePath("/admin");
  return { success: true, category };
}

export async function approveDeliverableVerification(dealId: string) {
  const session = await requireAdmin();
  if (!dealId || typeof dealId !== "string") {
    throw AppError.badRequest("dealId is required");
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { brand: true, influencer: true },
  });

  if (!deal) {
    throw AppError.notFound("Deal not found");
  }

  if (!["POSTED", "VERIFICATION_PENDING", "CONTENT_APPROVED"].includes(deal.status)) {
    throw AppError.badRequest(`Deal cannot be verified from status ${deal.status}`);
  }

  // 1. Transition to VERIFIED
  await transitionDealState({
    dealId,
    fromState: deal.status,
    toState: "VERIFIED",
    actor: {
      userId: session.user.id,
      role: "ADMIN",
    },
    reason: "Admin approved deliverable verification",
  });

  // 2. Mark verifiedAt date and disable further post verification blocking
  await prisma.deal.update({
    where: { id: dealId },
    data: {
      verifiedAt: new Date(),
      requiresPostVerification: false,
    },
  });

  // 3. Process payout release
  await PaymentService.processDealCompletion(dealId);
  await invalidateDealCache(dealId);

  await createActivityLog({
    userId: session.user.id,
    action: "DEAL_DELIVERABLE_VERIFIED",
    entityType: "DEAL",
    entityId: dealId,
    metadata: {
      adminEmail: session.user.email,
      influencerId: deal.influencerId,
      brandId: deal.brandId,
    },
  }).catch((err) => {
    logger.warn("Failed to record DEAL_DELIVERABLE_VERIFIED admin activity log", { dealId, error: err });
  });

  revalidatePath("/admin/deals");
  revalidatePath(`/admin/deals/${dealId}`);

  return { success: true, message: "Deliverable verified and payment processed successfully" };
}

export async function rejectDeliverableVerification(dealId: string, reason: string) {
  const session = await requireAdmin();
  if (!dealId || typeof dealId !== "string") {
    throw AppError.badRequest("dealId is required");
  }
  if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
    throw AppError.badRequest("A valid rejection reason (at least 5 characters) is required");
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
  });

  if (!deal) {
    throw AppError.notFound("Deal not found");
  }

  if (!["POSTED", "VERIFICATION_PENDING", "CONTENT_APPROVED"].includes(deal.status)) {
    throw AppError.badRequest(`Cannot reject deliverable verification from status ${deal.status}`);
  }

  await transitionDealState({
    dealId,
    fromState: deal.status,
    toState: "DISPUTED",
    actor: {
      userId: session.user.id,
      role: "ADMIN",
    },
    reason: `Admin rejected deliverable verification: ${reason.trim()}`,
  });

  await prisma.deal.update({
    where: { id: dealId },
    data: {
      rejectionReason: `DELIVERABLE_VERIFICATION_REJECTED: ${reason.trim()}`,
    },
  });

  await invalidateDealCache(dealId);

  await createActivityLog({
    userId: session.user.id,
    action: "DEAL_DELIVERABLE_REJECTED",
    entityType: "DEAL",
    entityId: dealId,
    metadata: {
      adminEmail: session.user.email,
      reason: reason.trim(),
    },
  }).catch((err) => {
    logger.warn("Failed to record DEAL_DELIVERABLE_REJECTED admin activity log", { dealId, error: err });
  });

  revalidatePath("/admin/deals");
  revalidatePath(`/admin/deals/${dealId}`);

  return { success: true, message: "Deliverable rejected and moved to disputed state" };
}

