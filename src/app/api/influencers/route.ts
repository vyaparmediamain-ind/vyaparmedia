import { NextResponse } from "next/server";
import { apiWrapper, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { UserService, type ListInfluencersParams } from "@/services/user.service";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { parsePagination } from "@/lib/utils";
import { isAdmin, isBrand } from "@/lib/rbac";

function parseQueryParams(searchParams: URLSearchParams) {
  const category = searchParams.get("category")?.trim() || undefined;
  const city = searchParams.get("city")?.trim() || undefined;
  const minFollowersStr = searchParams.get("minFollowers");
  const minFollowers = minFollowersStr ? Number.parseInt(minFollowersStr, 10) : undefined;
  const minEngagementRateStr = searchParams.get("minEngagementRate");
  const minEngagementRate = minEngagementRateStr ? Math.round(Number.parseFloat(minEngagementRateStr) * 100) : undefined;
  const minRateStr = searchParams.get("minRate");
  const minRate = minRateStr ? Math.round(Number.parseFloat(minRateStr) * 100) : undefined;
  const maxRateStr = searchParams.get("maxRate");
  const maxRate = maxRateStr ? Math.round(Number.parseFloat(maxRateStr) * 100) : undefined;
  const platform = searchParams.get("platform")?.trim() || undefined;
  const searchTerm = searchParams.get("search")?.trim() || undefined;
  const sortBy = searchParams.get("sortBy")?.trim() || undefined;

return {
category,
city,
minFollowers,
minEngagementRate,
minRate,
maxRate,
platform,
searchTerm,
sortBy,
};
}

export const GET = apiWrapper(async (req) => {
const session = (req as AuthenticatedRequest).session;
if (isAdmin(session.user.userType)) {
await requireActiveAdmin(session.user);
}

const { searchParams } = new URL(req.url);
const params = parseQueryParams(searchParams);
const { page, limit } = parsePagination(searchParams);

const filterParams: ListInfluencersParams = { page, limit };
if (params.category) filterParams.category = params.category;
if (params.city) filterParams.city = params.city;
if (typeof params.minFollowers === "number") filterParams.minFollowers = params.minFollowers;
if (typeof params.minEngagementRate === "number") filterParams.minEngagementRate = params.minEngagementRate;
if (typeof params.minRate === "number") filterParams.minRate = params.minRate;
if (typeof params.maxRate === "number") filterParams.maxRate = params.maxRate;
if (params.platform) filterParams.platform = params.platform;
if (params.searchTerm) filterParams.searchTerm = params.searchTerm;
if (params.sortBy) filterParams.sortBy = params.sortBy;
if (isBrand(session.user.userType)) {
filterParams.brandUserId = session.user.id;
}

const result = await UserService.listInfluencers(filterParams);

return NextResponse.json({
influencers: result.influencers,
pagination: {
page,
limit,
total: result.total,
totalPages: Math.ceil(result.total / (limit || 1)),
},
});
}, {
requirePermission: "VIEW_INFLUENCERS",
});
