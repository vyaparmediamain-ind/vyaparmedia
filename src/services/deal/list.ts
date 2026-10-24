import { isInfluencer, isBrand } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";
import prisma from "@/lib/db";
import { UserType, Prisma, DealStatus } from "@prisma/client";
import { ACTIVE_DEAL_STATUSES } from "@/lib/utils";

const statsCache = new Map<string, { stats: { active: number; completed: number; totalEarnings: number }; expiresAt: number }>();

export function invalidateDealStatsCache(key?: string): void {
  if (key) statsCache.delete(key);
  else statsCache.clear();
}

export async function listDeals(
userId: string,
userType: UserType | string,
params: {
status?: string;
campaignId?: string;
page: number;
limit: number;
},
) {
try {
const page = Math.max(1, params.page || 1);
const limit = Math.min(50, Math.max(1, params.limit || 10));

const where: Prisma.DealWhereInput = { deletedAt: null };
if (params.campaignId) {
  where.campaignId = params.campaignId;
}

if (params.status) {
  const normalized = params.status.trim().toUpperCase();
  if (normalized === "ACTIVE") {
    where.status = { in: ACTIVE_DEAL_STATUSES as DealStatus[] };
  } else if (Object.values(DealStatus).includes(normalized as DealStatus)) {
    where.status = normalized as DealStatus;
  }
}

// Scope by user type
const statsWhere: Prisma.DealWhereInput = { deletedAt: null };
if (params.campaignId) {
  statsWhere.campaignId = params.campaignId;
}
if (isInfluencer(userType)) {
const profile = await prisma.influencerProfile.findUnique({
where: { userId },
select: { id: true },
});
if (!profile) return { deals: [], total: 0, totalPages: 0, stats: { active: 0, completed: 0, totalEarnings: 0 } };
where.influencerId = profile.id;
statsWhere.influencerId = profile.id;
} else if (isBrand(userType)) {
const profile = await prisma.brandProfile.findUnique({
where: { userId },
select: { id: true },
});
if (!profile) return { deals: [], total: 0, totalPages: 0, stats: { active: 0, completed: 0, totalEarnings: 0 } };
where.brandId = profile.id;
statsWhere.brandId = profile.id;
}

logger.info("Listing deals", { userId, userType, filters: where, page });

const statsKey = `${(where.influencerId as string) || (where.brandId as string) || userId}:${params.campaignId || "all"}`;
const now = Date.now();
const cachedStats = statsCache.get(statsKey);

let statsPromise: Promise<{ active: number; completed: number; totalEarnings: number }>;
if (cachedStats && cachedStats.expiresAt > now) {
  statsPromise = Promise.resolve(cachedStats.stats);
} else {
  statsPromise = Promise.all([
    prisma.deal.count({
      where: {
        ...statsWhere,
        status: { in: ACTIVE_DEAL_STATUSES as DealStatus[] },
      },
    }),
    prisma.deal.aggregate({
      where: {
        ...statsWhere,
        status: "COMPLETED",
      },
      _count: { _all: true },
      _sum: { influencerPayout: true },
    }),
  ]).then(([activeCount, completedAggregation]) => {
    const computedStats = {
      active: activeCount,
      completed: completedAggregation._count._all || 0,
      totalEarnings: completedAggregation._sum.influencerPayout || 0,
    };
    statsCache.set(statsKey, { stats: computedStats, expiresAt: now + 30_000 });
    return computedStats;
  });
}

const [deals, stats] = await Promise.all([
  prisma.deal.findMany({
    where,
    include: {
      campaign: { select: { id: true, title: true, deliverables: true } },
      influencer: {
        select: {
          id: true,
          displayName: true,
          avatar: true,
          instagramHandle: true,
        },
      },
      brand: { select: { id: true, companyName: true, logo: true } },
      contentSubmissions: { orderBy: { version: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  }),
  statsPromise,
]);

let total = deals.length;
if (page > 1 || deals.length === limit) {
  total = await prisma.deal.count({ where });
}

return { deals, total, totalPages: Math.ceil(total / limit), stats };
} catch (error) {
logger.error("Error listing deals", error, { userId });
throw AppError.badRequest("Failed to list deals");
}
}

