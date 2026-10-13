import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

const brandProfileInclude = {
  user: {
    select: {
      id: true,
      trustScore: true,
      createdAt: true,
    },
  },
  campaigns: {
    where: {
      status: "ACTIVE" as const,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" as const },
    take: 12,
    select: {
      id: true,
      title: true,
      description: true,
      perInfluencerBudget: true,
      requiresProduct: true,
      productName: true,
      productValue: true,
      targetCategories: true,
      minFollowers: true,
      postingDeadline: true,
      deliverables: true,
    },
  },
  reviews: {
    where: {
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" as const },
    take: 10,
    include: {
      reviewer: {
        select: {
          id: true,
          influencerProfile: {
            select: {
              displayName: true,
              avatar: true,
              instagramHandle: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.BrandProfileInclude;

export interface PublicBrandCampaign {
  id: string;
  title: string;
  description: string;
  perInfluencerBudget: number; // In paise
  requiresProduct: boolean;
  productName: string | null;
  productValue: number | null;
  targetCategories: string[];
  minFollowers: number;
  postingDeadline: string;
  deliverables: Array<{ type: string; count: number }>;
}

export interface PublicBrandReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer: {
    displayName: string;
    avatar: string | null;
    instagramHandle: string | null;
  };
}

export interface BrandPublicProfileData {
  id: string;
  userId: string;
  companyName: string;
  logo: string | null;
  website: string | null;
  description: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  isGstVerified: boolean;
  isPanVerified: boolean;
  isCinVerified: boolean;
  trustScore: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalSpentPaise: number;
  averageRating: number; // 0-5.0
  totalReviews: number;
  memberSince: string;
  activeCampaignsList: PublicBrandCampaign[];
  reviews: PublicBrandReview[];
}

/**
 * Fetch a sanitized, PII-free public brand profile by:
 * 1. BrandProfile ID (cuid)
 * 2. User ID (cuid)
 * 3. Company Name (case-insensitive)
 *
 * Strictly omits: GST numbers, PAN numbers, bank accounts, emails, phone numbers, or private ledger states.
 */
export async function getPublicBrandProfile(
  identifier: string
): Promise<BrandPublicProfileData | null> {
  const cleanId = decodeURIComponent(identifier || "").trim();
  if (!cleanId || cleanId === "undefined" || cleanId === "null") return null;

  let brand = await prisma.brandProfile.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { id: cleanId },
        { userId: cleanId },
        { companyName: { equals: cleanId, mode: "insensitive" } },
        { companyName: { equals: cleanId.replaceAll("-", " "), mode: "insensitive" } },
      ],
    },
    include: brandProfileInclude,
  });

  if (!brand) {
    const brandUser = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        userType: "BRAND",
        OR: [
          { id: cleanId },
          { email: cleanId },
        ],
      },
      select: {
        id: true,
        email: true,
        trustScore: true,
        createdAt: true,
      },
    });

    if (brandUser) {
      brand = await prisma.brandProfile.upsert({
        where: { userId: brandUser.id },
        create: {
          userId: brandUser.id,
          companyName: cleanId.includes("@")
            ? (cleanId.split("@")[0] || "Verified Brand")
            : (cleanId.replaceAll("-", " ") || "Verified Brand"),
        },
        update: {},
        include: brandProfileInclude,
      });
    }
  }

  if (!brand) {
    return null;
  }

  // Parse active campaigns
  const activeCampaignsList: PublicBrandCampaign[] = brand.campaigns.map((camp) => {
    let parsedDeliverables: Array<{ type: string; count: number }> = [];
    if (Array.isArray(camp.deliverables)) {
      parsedDeliverables = (camp.deliverables as Array<{ type?: string; count?: number }>).map(
        (d) => ({
          type: String(d.type || "Deliverable"),
          count: Number(d.count || 1),
        })
      );
    }

    return {
      id: camp.id,
      title: camp.title,
      description: camp.description,
      perInfluencerBudget: camp.perInfluencerBudget || 0,
      requiresProduct: Boolean(camp.requiresProduct),
      productName: camp.productName || null,
      productValue: camp.productValue || null,
      targetCategories: camp.targetCategories || [],
      minFollowers: camp.minFollowers || 0,
      postingDeadline: camp.postingDeadline.toISOString(),
      deliverables: parsedDeliverables,
    };
  });

  // Parse reviews
  const parsedReviews: PublicBrandReview[] = brand.reviews.map((rev) => ({
    id: rev.id,
    rating: rev.rating,
    comment: rev.comment || null,
    createdAt: rev.createdAt.toISOString(),
    reviewer: {
      displayName: rev.reviewer.influencerProfile?.displayName || "Verified Creator",
      avatar: rev.reviewer.influencerProfile?.avatar || null,
      instagramHandle: rev.reviewer.influencerProfile?.instagramHandle || null,
    },
  }));

  // Average rating on 0-500 scale normalized to 0.0-5.0
  const normalizedRating =
    brand.averageRating > 0
      ? Math.min(5, Math.max(0, brand.averageRating / 100))
      : 5.0;

  return {
    id: brand.id,
    userId: brand.userId,
    companyName: brand.companyName,
    logo: brand.logo || null,
    website: brand.website || null,
    description: brand.description || null,
    industry: brand.industry || null,
    city: brand.city || null,
    state: brand.state || null,
    isGstVerified: brand.isGstVerified,
    isPanVerified: brand.isPanVerified,
    isCinVerified: brand.isCinVerified,
    trustScore: brand.user.trustScore,
    totalCampaigns: brand.totalCampaigns,
    activeCampaigns: brand.activeCampaigns,
    totalSpentPaise: brand.totalSpent,
    averageRating: Number(normalizedRating.toFixed(1)),
    totalReviews: brand.totalReviews,
    memberSince: brand.user.createdAt.toISOString(),
    activeCampaignsList,
    reviews: parsedReviews,
  };
}
