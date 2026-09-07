import { AppError } from "@/lib/errors";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { WalletService } from "./wallet.service";
import { logger } from "@/lib/logger";

export interface ListInfluencersParams {
category?: string;
minFollowers?: number;
city?: string;
minEngagementRate?: number; // In basis points
minRate?: number; // In paise
maxRate?: number; // In paise
platform?: string;
page: number;
limit: number;
searchTerm?: string;
brandUserId?: string;
sortBy?: string;
}

export class UserService {

private static applyEngagementFilter(
where: Prisma.InfluencerProfileWhereInput,
platform?: string,
minEngagementRate?: number
) {
if (minEngagementRate === undefined) return;
if (platform === "instagram") {
where.instagramEngagementRate = { gte: minEngagementRate };
} else if (platform === "youtube") {
where.youtubeEngagementRate = { gte: minEngagementRate };
} else {
// No specific platform require either platform to meet threshold
const existing = where.AND;
let andConditions: Prisma.InfluencerProfileWhereInput[] = [];
if (existing) {
if (Array.isArray(existing)) {
andConditions = [...existing];
} else {
andConditions = [existing as Prisma.InfluencerProfileWhereInput];
}
}
andConditions.push({
OR: [
{ instagramEngagementRate: { gte: minEngagementRate } },
{ youtubeEngagementRate: { gte: minEngagementRate } },
],
});
where.AND = andConditions;
}
}

private static applyRateFilter(
where: Prisma.InfluencerProfileWhereInput,
minRate?: number,
maxRate?: number
) {
if (minRate !== undefined || maxRate !== undefined) {
const rateFilter: { gte?: number; lte?: number } = {};
if (minRate !== undefined) rateFilter.gte = minRate;
if (maxRate !== undefined) rateFilter.lte = maxRate;
where.minRate = rateFilter;
}
}

private static applyBrandBudgetFilter(
where: Prisma.InfluencerProfileWhereInput,
maxAllowedRate: number
) {
where.OR = where.OR || [];
if (where.OR.length > 0) {
// Existing OR conditions must be merged into AND to combine with rate filter
const existing = where.AND;
let andConditions: Prisma.InfluencerProfileWhereInput[] = [];
if (existing) {
if (Array.isArray(existing)) {
andConditions = [...existing];
} else {
andConditions = [existing as Prisma.InfluencerProfileWhereInput];
}
}
andConditions.push(
{ OR: where.OR },
{
OR: [
{ minRate: { lte: maxAllowedRate } },
{ minRate: null },
{ minRate: 0 },
],
}
);
where.AND = andConditions;
delete where.OR;
} else {
where.OR = [
{ minRate: { lte: maxAllowedRate } },
{ minRate: null },
{ minRate: 0 },
];
}
}

private static applySocialHandlesFilter(where: Prisma.InfluencerProfileWhereInput) {
const hasSocialHandleCondition = {
OR: [
{ AND: [{ instagramHandle: { not: null } }, { instagramHandle: { not: "" } }] },
{ AND: [{ youtubeHandle: { not: null } }, { youtubeHandle: { not: "" } }] },
]
};
const existing = where.AND;
let andConditions: Prisma.InfluencerProfileWhereInput[] = [];
if (existing) {
if (Array.isArray(existing)) {
andConditions = [...existing];
} else {
andConditions = [existing as Prisma.InfluencerProfileWhereInput];
}
}
andConditions.push(hasSocialHandleCondition);
where.AND = andConditions;
}

static async listInfluencers(params: ListInfluencersParams) {
try {
// 0. Automatically clean up expired featured statuses
try {
await prisma.influencerProfile.updateMany({
where: {
isFeatured: true,
featuredUntil: { lt: new Date() },
},
data: {
isFeatured: false,
},
});
} catch (err) {
logger.warn("Failed to clean up expired featured creators in listInfluencers", { err });
}

const where: Prisma.InfluencerProfileWhereInput = {};

if (params.category) {
where.categories = { contains: params.category, mode: "insensitive" };
}

if (params.city) {
where.city = { contains: params.city, mode: "insensitive" };
}

if (params.minFollowers) {
where.instagramFollowers = { gte: params.minFollowers };
}

this.applyEngagementFilter(where, params.platform, params.minEngagementRate);
this.applyRateFilter(where, params.minRate, params.maxRate);

if (params.platform) {
if (params.platform === "instagram") {
where.instagramHandle = { not: null, notIn: [""] };
} else if (params.platform === "youtube") {
where.youtubeHandle = { not: null, notIn: [""] };
}
}

if (params.searchTerm) {
where.OR = [
{ displayName: { contains: params.searchTerm, mode: "insensitive" } },
{ bio: { contains: params.searchTerm, mode: "insensitive" } },
{ instagramHandle: { contains: params.searchTerm, mode: "insensitive" } },
{ youtubeHandle: { contains: params.searchTerm, mode: "insensitive" } },
];
}

if (params.brandUserId) {
const brandWallet = await WalletService.getWalletBasic(params.brandUserId);
if (brandWallet) {
this.applyBrandBudgetFilter(where, brandWallet.balance);
}
}

this.applySocialHandlesFilter(where);

logger.info("Listing influencers", { params });

const queryArgs: Prisma.InfluencerProfileFindManyArgs = {
where,
include: {
user: {
select: {
trustScore: true,
level: true,
xp: true,
badges: {
select: {
badge: true,
},
},
},
},
},
skip: (params.page - 1) * params.limit,
take: params.limit,
};

if (params.sortBy !== "relevance") {
queryArgs.orderBy = [
{ isFeatured: "desc" as const },
{ user: { xp: "desc" as const } },
{ totalDeals: "desc" as const },
];
}

const [influencers, total] = await Promise.all([
prisma.influencerProfile.findMany(queryArgs),
prisma.influencerProfile.count({ where }),
]);

return { influencers, total };
} catch (error) {
logger.error("Error listing influencers", error, { params });
throw AppError.badRequest("Failed to list influencers");
}
}
}
