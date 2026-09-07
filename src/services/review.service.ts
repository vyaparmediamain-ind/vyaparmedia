import { AppError } from "@/lib/errors";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { checkMessageForContacts } from "@/lib/contact-filter";
import { updateTrustAndLevel } from "@/lib/trust-engine";
import { checkAndAwardBadges, awardBadgeIfNotExists } from "@/lib/gamification-engine";
import { getDealAndVerifyParticipant } from "@/lib/utils";
import { NotificationService } from "@/services/notification.service";
import { checkChallengeProgress } from "@/lib/weekly-challenges";
import { logger } from "@/lib/logger";

export class ReviewService {
static async listReviews(
userId: string,
targetId?: string,
page: number = 1,
limit: number = 20,
) {
const where: Prisma.ReviewWhereInput = {};

if (targetId) {
where.receiverId = targetId;
} else {
// Default: reviews received by the user
where.receiverId = userId;
}

const viewer = await prisma.user.findUnique({
where: { id: userId },
select: { userType: true },
});
const viewerType = viewer?.userType;

const [reviews, total] = await Promise.all([
prisma.review.findMany({
where,
include: {
reviewer: {
select: {
id: true,
userType: true,
influencerProfile: {
select: { displayName: true, avatar: true },
},
brandProfile: { select: { companyName: true, logo: true } },
},
},
},
orderBy: { createdAt: "desc" },
skip: (page - 1) * limit,
take: limit,
}),
prisma.review.count({ where }),
]);

const sanitizedReviews = reviews.map((review) => {
if (viewerType === "BRAND" && review.reviewerType === "BRAND" && review.reviewerId !== userId) {
const sanitized = {
...review,
comment: "Comment is confidential",
dealId: "confidential",
reviewerId: "confidential",
};
if (sanitized.reviewer) {
sanitized.reviewer = {
...sanitized.reviewer,
id: "confidential",
brandProfile: sanitized.reviewer.brandProfile
? {
...sanitized.reviewer.brandProfile,
companyName: "Anonymous Brand",
logo: null,
}
: null,
};
}
return sanitized;
}
return review;
});

return { reviews: sanitizedReviews, total };
}

static async createReview(
reviewerId: string,
data: {
receiverId?: string;
dealId: string;
rating: number;
comment?: string;
},
) {
if (data.comment && checkMessageForContacts(data.comment).hasContactInfo) {
throw AppError.badRequest("Contact details (phone, email, links, social handles, or UPI) are not allowed in review comments.");
}

if (data.rating < 1 || data.rating > 5)
throw AppError.badRequest("Rating must be between 1 and 5");

// Fetch Deal to verify and deduce receiver if needed
const deal = await getDealAndVerifyParticipant(data.dealId, reviewerId);

if (deal.status !== "COMPLETED")
throw AppError.badRequest("Deal must be completed before reviewing");

const participants = [deal.influencer.userId, deal.brand?.userId].filter(
Boolean,
) as string[];

// Deduce receiverId if not provided
let targetId = data.receiverId;
if (!targetId) {
targetId = participants.find((p) => p !== reviewerId);
if (!targetId) throw AppError.badRequest("Could not determine review target");
}

if (targetId === reviewerId) throw AppError.badRequest("Cannot review yourself");
if (!participants.includes(targetId))
throw AppError.badRequest("Target user is not part of this deal");

// Check if review already exists
const existing = await prisma.review.findUnique({
where: {
dealId_reviewerId_receiverId: {
dealId: data.dealId,
reviewerId: reviewerId,
receiverId: targetId,
},
},
});
if (existing)
throw AppError.badRequest("You have already reviewed this user for this deal");

const receiverId = targetId; // ensure it's set for transaction usage

// Fetch reviewer type
const reviewerUser = await prisma.user.findUnique({
where: { id: reviewerId },
select: { userType: true },
});
if (!reviewerUser) throw AppError.notFound("Reviewer not found");

// Transaction: Create Review + Update Aggregates (averageRating) + Check Badges
try {
    const review = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Fetch Receiver's Profile first to resolve reviewee type foreign keys
      const receiver = await tx.user.findUnique({
        where: { id: receiverId },
        include: {
          influencerProfile: true,
          brandProfile: true,
        },
      });

      if (!receiver) throw AppError.notFound("Receiver not found");

      const influencerRevieweeId = receiver.userType === "INFLUENCER" ? (receiver.influencerProfile?.id ?? null) : null;
      const brandRevieweeId = receiver.userType === "BRAND" ? (receiver.brandProfile?.id ?? null) : null;

      const newReview = await tx.review.create({
        data: {
          dealId: data.dealId,
          reviewerId: reviewerId,
          receiverId: receiverId,
          reviewerType: reviewerUser.userType,
          rating: data.rating,
          comment: data.comment ?? null,
          influencerRevieweeId,
          brandRevieweeId,
        },
      });

      // Lock profile row before aggregating to prevent read-modify-write race conditions
      if (receiver.userType === "INFLUENCER" && receiver.influencerProfile) {
        await tx.$queryRaw`SELECT id FROM "InfluencerProfile" WHERE id = ${receiver.influencerProfile.id} FOR UPDATE`;
      } else if (receiver.userType === "BRAND" && receiver.brandProfile) {
        await tx.$queryRaw`SELECT id FROM "BrandProfile" WHERE id = ${receiver.brandProfile.id} FOR UPDATE`;
      }

      // Improved Average Rating Calculation
      const { _avg, _count } = await tx.review.aggregate({
        where: { receiverId: receiverId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      const newAverage = _avg.rating || data.rating; // fallback if somehow null

      const updateData = {
        averageRating: Math.round(newAverage * 100), // Store on 0-500 scale as defined in schema
        totalReviews: _count.rating,
      };

      if (receiver.userType === "INFLUENCER" && receiver.influencerProfile) {
        await tx.influencerProfile.update({
          where: { id: receiver.influencerProfile.id },
          data: updateData,
        });
      } else if (receiver.userType === "BRAND" && receiver.brandProfile) {
        await tx.brandProfile.update({
          where: { id: receiver.brandProfile.id },
          data: updateData,
        });
      }

      // Track community challenge progress for leaving a review
      await checkChallengeProgress(reviewerId, "COMMUNITY", 1, tx).catch((err) => {
        logger.error("Failed to track challenge progress for community review", { reviewerId, error: err });
      });

      // Gamification & Badges
      await ReviewService.awardReviewBadges(
        tx,
        reviewerId,
        receiverId,
        data.rating,
        data.dealId,
        receiver.userType
      );

// Create in-app notification for the receiver
await NotificationService.createNotification({
userId: receiverId,
type: "review",
title: "New Review Received ",
message: `You received a ${data.rating}-star review for deal #${data.dealId}.`,
data: { dealId: data.dealId, rating: data.rating },
}, tx);

return newReview;
});

// Recalculate Trust Score (async outside transaction to avoid lock contention if slow)
await updateTrustAndLevel(receiverId, "REVIEW_RECEIVED");

// Track weekly challenge progress for receiving 5-star reviews
// Only credit the receiver (not the reviewer) and only for 5-star ratings
if (review.rating === 5) {
await checkChallengeProgress(receiverId, "QUALITY", 1).catch((err) => {
logger.error("Failed to track challenge progress for 5-star review", { receiverId, error: err });
});
}

return review;
    } catch (error: unknown) {
      if ((error as { code?: string }).code === "P2002") {
        throw AppError.badRequest("You have already reviewed this deal (duplicate submission prevented).",
        );
      }
      throw error;
    }
  }

  private static async awardReviewBadges(
    tx: Prisma.TransactionClient,
    reviewerId: string,
    receiverId: string,
    rating: number,
    dealId: string,
    receiverUserType: string,
  ) {
    await checkAndAwardBadges(reviewerId, "FIRST_REVIEW", tx);
    if (rating === 5) {
      await checkAndAwardBadges(receiverId, "FIVE_STAR_RATING", tx);
    }

    // Check for creator_favorite badge if a brand gets a 5-star review from an influencer
    if (rating === 5 && receiverUserType === "BRAND") {
      const count = await tx.review.count({
        where: { receiverId: receiverId, rating: 5 },
      });
      if (count >= 10) {
        await awardBadgeIfNotExists(receiverId, "creator_favorite", tx);
      }
    }

    // Check if this deal had an amicably resolved dispute to award community_helper badge
    const resolvedAmicableDispute = await tx.dispute.findFirst({
      where: {
        dealId: dealId,
        status: "RESOLVED",
        resolvedAmicably: true,
      },
    });
    if (resolvedAmicableDispute) {
      await awardBadgeIfNotExists(reviewerId, "community_helper", tx);
    }
  }
}
