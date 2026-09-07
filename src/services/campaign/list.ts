import { logger } from "@/lib/logger";
import prisma from "@/lib/db";
import { CampaignStatus, Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { isInfluencer, isBrand, isAdmin } from "@/lib/rbac";
import { ListCampaignsParams, CAMPAIGN_INCLUDE } from "./types";

function resolveStatusFilter(
params: ListCampaignsParams,
userId: string | undefined,
userType: string | undefined,
): CampaignStatus | undefined {
const allowedStatuses: CampaignStatus[] = [
"ACTIVE",
"COMPLETED",
"PAUSED",
"DRAFT",
"PENDING_APPROVAL",
"CANCELLED",
];

let statusFilter: CampaignStatus | undefined = "ACTIVE";
if (
params.status === "ALL" &&
(isAdmin(userType) || isBrand(userType))
) {
statusFilter = undefined;
} else if (params.status && allowedStatuses.includes(params.status as CampaignStatus)) {
statusFilter = params.status as CampaignStatus;
}

if (!userId) {
statusFilter = "ACTIVE";
}

if (statusFilter !== "ACTIVE" && !isAdmin(userType) && !isBrand(userType)) {
statusFilter = "ACTIVE";
}

return statusFilter;
}
function buildTextAndCategoryFilters(params: ListCampaignsParams): Prisma.CampaignWhereInput[] {
  const conditions: Prisma.CampaignWhereInput[] = [];

  if (params.category) {
    const category = params.category.trim();
    if (category) {
      conditions.push({ targetCategories: { has: category } });
    }
  }

  if (params.city) {
    const city = params.city.trim();
    if (city) {
      conditions.push({ targetCities: { has: city } });
    }
  }

  if (params.search) {
    const search = params.search.trim();
    if (search) {
      conditions.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      });
    }
  }

  return conditions;
}

function buildBudgetFilter(params: ListCampaignsParams): Prisma.IntNullableFilter | null {
  const budgetFilter: Prisma.IntNullableFilter = {};
  if (params.minBudget) {
    budgetFilter.gte = Number(params.minBudget);
  }
  if (params.maxBudget) {
    budgetFilter.lte = Number(params.maxBudget);
  }
  return Object.keys(budgetFilter).length > 0 ? budgetFilter : null;
}

async function buildOwnershipFilter(
  params: ListCampaignsParams,
  userId: string,
  userType: string | undefined,
  statusFilter: CampaignStatus | undefined,
): Promise<Prisma.CampaignWhereInput[]> {
  const conditions: Prisma.CampaignWhereInput[] = [];

  if ((statusFilter !== "ACTIVE" && isBrand(userType)) || (params.ownerOnly && isBrand(userType))) {
    const profile = await prisma.brandProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (profile) {
      conditions.push({ brandId: profile.id });
    } else {
      conditions.push({ brandId: "no_profile_found" });
    }
  }

  return conditions;
}

function getPlatformCompatibilityCondition(
  hasIg: boolean,
  hasYt: boolean,
): Prisma.CampaignWhereInput {
  const platforms: string[] = [];
  if (hasIg) platforms.push("INSTAGRAM");
  if (hasYt) platforms.push("YOUTUBE");

  if (platforms.length === 0) {
    return { id: "no_connected_platform" };
  }

  const platformConditions = platforms.map((p) => ({
    deliverables: {
      path: [],
      string_contains: p,
    },
  }));

  return {
    OR: platformConditions,
  };
}

function getBudgetCondition(
  minInstagramRate: number | null,
  minYoutubeRate: number | null,
  minRate: number | null,
): Prisma.CampaignWhereInput | null {
  const rates = [
    minInstagramRate,
    minYoutubeRate,
    minRate
  ].filter((r): r is number => r !== null && r !== undefined && r > 0);
  const activeMinRate = rates.length > 0 ? Math.min(...rates) : 0;
  if (activeMinRate > 0) {
    return {
      OR: [
        { perInfluencerBudget: null },
        { perInfluencerBudget: 0 },
        { perInfluencerBudget: { gte: activeMinRate } },
      ],
    };
  }
  return null;
}

async function buildInfluencerEligibilityFilter(
  userId: string,
  params: ListCampaignsParams,
  _statusFilter: CampaignStatus | undefined,
): Promise<Prisma.CampaignWhereInput[]> {
const conditions: Prisma.CampaignWhereInput[] = [];

const profile = await prisma.influencerProfile.findUnique({
where: { userId },
select: {
instagramHandle: true,
youtubeHandle: true,
instagramFollowers: true,
youtubeSubscribers: true,
categories: true,
minRate: true,
minInstagramRate: true,
minYoutubeRate: true,
},
});

if (profile) {
const hasIg = Boolean(profile.instagramHandle);
const hasYt = Boolean(profile.youtubeHandle);

    if (!hasIg || !hasYt) {
      const platCond = getPlatformCompatibilityCondition(hasIg, hasYt);
      conditions.push(platCond);
    }

const igFollowers = profile.instagramFollowers || 0;
const ytSubs = profile.youtubeSubscribers || 0;
const maxRelevantFollowers = Math.max(igFollowers, ytSubs);

conditions.push(
{ minFollowers: { lte: maxRelevantFollowers } },
{
OR: [
{ maxFollowers: null },
{ maxFollowers: 0 },
{ maxFollowers: { gte: maxRelevantFollowers } },
],
}
);

if (!params.category && profile.categories) {
const infCategories = profile.categories
.split(",")
.map((item: string) => item.trim())
.filter(Boolean);

if (infCategories.length > 0) {
conditions.push({
OR: infCategories.map((category: string) => ({
targetCategories: { has: category },
})),
});
}
}

if (!params.minBudget) {
const budgetCond = getBudgetCondition(
profile.minInstagramRate,
profile.minYoutubeRate,
profile.minRate
);
if (budgetCond) {
conditions.push(budgetCond);
}
}
}

conditions.push({ isDirectInvite: false });
return conditions;
}
export async function listCampaigns(
userId: string | undefined,
userType: string | undefined,
params: ListCampaignsParams,
) {
try {
const page = Math.max(1, params.page || 1);
const limit = Math.min(50, Math.max(1, params.limit || 10));

const validSortFields = [
"createdAt",
"totalBudget",
"perInfluencerBudget",
"applicationDeadline",
] as const;
const sortBy = validSortFields.includes(
(params.sortBy || "") as (typeof validSortFields)[number],
)
? (params.sortBy as (typeof validSortFields)[number])
: "createdAt";
const sortOrder = params.sortOrder === "asc" ? "asc" : "desc";

const statusFilter = resolveStatusFilter(params, userId, userType);

const where: Prisma.CampaignWhereInput = {
deletedAt: null,
...(statusFilter ? { status: statusFilter } : {}),
};

const andConditions: Prisma.CampaignWhereInput[] = [
...buildTextAndCategoryFilters(params),
];

const budgetFilter = buildBudgetFilter(params);
if (budgetFilter) {
where.perInfluencerBudget = budgetFilter;
}

if (userId) {
andConditions.push(...(await buildOwnershipFilter(params, userId, userType, statusFilter)));

if (isInfluencer(userType)) {
andConditions.push(
...(await buildInfluencerEligibilityFilter(userId, params, statusFilter)),
);
}
}

if (andConditions.length > 0) {
where.AND = andConditions;
}

logger.info("Listing campaigns", {
...(userId ? { userId } : {}),
page,
limit,
filters: where,
});

const [campaigns, total] = await Promise.all([
prisma.campaign.findMany({
where,
include: CAMPAIGN_INCLUDE,
orderBy: { [sortBy]: sortOrder },
skip: (page - 1) * limit,
take: limit,
}),
prisma.campaign.count({ where }),
]);

return {
campaigns,
total,
totalPages: Math.ceil(total / limit),
};
} catch (error) {
logger.error("Error listing campaigns", error, {
...(userId ? { userId } : {}),
params,
});
throw AppError.badRequest("Failed to list campaigns");
}
}
function validateTotalBudget(
  requiresProduct: boolean,
  totalBudgetPaise: number,
  productValuePaise: number | null,
  minFollowers: number
) {
  if (!Number.isInteger(totalBudgetPaise)) {
    throw AppError.badRequest("totalBudget must be an integer in paise");
  }

  if (requiresProduct) {
    if (totalBudgetPaise < 0) {
      throw AppError.badRequest("totalBudget cannot be negative");
    }
    if (totalBudgetPaise === 0) {
      // MIN matches Zod schema (validations.ts) and frontend (CampaignCreateHelpers.ts): ₹500
      const MIN_PRODUCT_VALUE_PAISE = 50000; // ₹500 in paise
      if (!productValuePaise || productValuePaise < MIN_PRODUCT_VALUE_PAISE) {
        throw AppError.badRequest("A product-only campaign must specify a product value of at least 500");
      }
      if (minFollowers > 10000) {
        throw AppError.badRequest("A product-only campaign must target influencers with up to 10,000 followers");
      }
    }
  } else if (totalBudgetPaise <= 0) {
    throw AppError.badRequest("totalBudget must be a positive integer in paise");
  }
}

function validatePerInfluencerBudget(
requiresProduct: boolean,
totalBudgetPaise: number,
perInfluencerBudgetPaise: number | null
) {
if (perInfluencerBudgetPaise !== null) {
if (!Number.isInteger(perInfluencerBudgetPaise)) {
throw AppError.badRequest("perInfluencerBudget must be an integer in paise");
}
if (requiresProduct) {
if (perInfluencerBudgetPaise < 0) {
throw AppError.badRequest("perInfluencerBudget cannot be negative");
}
} else if (perInfluencerBudgetPaise <= 0) {
throw AppError.badRequest("perInfluencerBudget must be a positive integer in paise");
}
if (perInfluencerBudgetPaise > totalBudgetPaise) {
throw AppError.badRequest("perInfluencerBudget cannot exceed totalBudget");
}
}
}
export function validateCampaignInputAndBudgets(
data: Record<string, unknown>,
requiresProduct: boolean,
totalBudgetPaise: number,
perInfluencerBudgetPaise: number | null,
productValuePaise: number | null,
minFollowers: number
) {
validateTotalBudget(requiresProduct, totalBudgetPaise, productValuePaise, minFollowers);
validatePerInfluencerBudget(requiresProduct, totalBudgetPaise, perInfluencerBudgetPaise);
}

