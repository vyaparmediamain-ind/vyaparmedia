import { isInfluencer, isBrand } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";
import prisma from "@/lib/db";
import { UserType, Prisma, DealStatus } from "@prisma/client";
import { ACTIVE_DEAL_STATUSES } from "@/lib/utils";

export async function listDeals(
userId: string,
userType: UserType | string,
params: {
status?: string;
page: number;
limit: number;
},
) {
try {
const page = Math.max(1, params.page || 1);
const limit = Math.min(50, Math.max(1, params.limit || 10));

const where: Prisma.DealWhereInput = { deletedAt: null };

if (params.status) where.status = params.status as DealStatus;

// Scope by user type
const statsWhere: Prisma.DealWhereInput = { deletedAt: null };
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

const [deals, total, activeCount, completedCount, earningsAggregation] = await Promise.all([
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
prisma.deal.count({ where }),
prisma.deal.count({
where: {
...statsWhere,
status: {
in: ACTIVE_DEAL_STATUSES as DealStatus[],
},
},
}),
prisma.deal.count({
where: {
...statsWhere,
status: "COMPLETED",
},
}),
prisma.deal.aggregate({
where: {
...statsWhere,
status: "COMPLETED",
},
_sum: {
influencerPayout: true,
},
}),
]);

const stats = {
active: activeCount,
completed: completedCount,
totalEarnings: earningsAggregation._sum.influencerPayout || 0,
};

return { deals, total, totalPages: Math.ceil(total / limit), stats };
} catch (error) {
logger.error("Error listing deals", error, { userId });
throw AppError.badRequest("Failed to list deals");
}
}

