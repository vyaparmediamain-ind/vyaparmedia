import { apiWrapper, ApiResponse, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { NextRequest } from "next/server";
import { UserType } from "@prisma/client";
import { z } from "zod";

import { isAdmin } from "@/lib/rbac";
import { createCampaignSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";
import { CampaignService, type ListCampaignsParams } from "@/services/campaign.service";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { parsePagination, toPaise } from "@/lib/utils";
import { AppError } from "@/lib/errors";
import { TierError } from "@/services/campaign/types";

async function _handler_GET(request: NextRequest) {
try {
const session = (request as AuthenticatedRequest).session;

const { searchParams } = new URL(request.url);
const { page, limit, skip: _skip } = parsePagination(searchParams);

const status = searchParams.get("status")?.trim().toUpperCase() || undefined;
const category = searchParams.get("category")?.trim() || undefined;
const city = searchParams.get("city")?.trim() || undefined;
const sortBy = searchParams.get("sortBy")?.trim() || undefined;
const sortOrder =
searchParams.get("sortOrder")?.trim() === "asc" ? "asc" : ("desc" as const);
const search = searchParams.get("search")?.trim() || undefined;
const ownerOnly = searchParams.get("scope") === "mine";

const minBudgetRupees = searchParams.get("minBudget");
const maxBudgetRupees = searchParams.get("maxBudget");

const parsedMinBudget = minBudgetRupees ? Number(minBudgetRupees) : Number.NaN;
const parsedMaxBudget = maxBudgetRupees ? Number(maxBudgetRupees) : Number.NaN;
const minBudget = Number.isFinite(parsedMinBudget)
? toPaise(parsedMinBudget)
: undefined;
const maxBudget = Number.isFinite(parsedMaxBudget)
? toPaise(parsedMaxBudget)
: undefined;

const userId = session?.user?.id;
const userType = session?.user?.userType;

if (isAdmin(userType)) {
await requireActiveAdmin(session.user);
}

const listParams: ListCampaignsParams = {
page,
limit,
sortOrder,
ownerOnly,
};
if (status) listParams.status = status;
if (category) listParams.category = category;
if (city) listParams.city = city;
if (typeof minBudget === "number") listParams.minBudget = minBudget;
if (typeof maxBudget === "number") listParams.maxBudget = maxBudget;
if (sortBy) listParams.sortBy = sortBy;
if (search) listParams.search = search;

const list = await CampaignService.listCampaigns(userId, userType, listParams);

return ApiResponse.success(
{
campaigns: list.campaigns,
total: list.total,
totalPages: list.totalPages,
page,
limit,
},
"Campaigns retrieved",
);
} catch (error: unknown) {
logger.error("GET /api/campaigns error", error);
return ApiResponse.error("Failed to list campaigns", 500);
}
}

function validateCampaignPayload(body: unknown) {
const parsed = createCampaignSchema.safeParse(body);
if (!parsed.success) {
const firstIssue = parsed.error.issues[0];
const fieldName = firstIssue?.path.join(".") || "";
const issueMsg = firstIssue?.message || "Invalid value";
const prefix = fieldName ? `${fieldName} - ` : "";
return {
success: false,
message: `Invalid payload: ${prefix}${issueMsg}`
};
}
return { success: true, data: parsed.data };
}

function prepareCampaignPayload(data: z.infer<typeof createCampaignSchema>) {
return {
...data,
totalBudget: toPaise(data.totalBudget),
perInfluencerBudget:
typeof data.perInfluencerBudget === "number"
? toPaise(data.perInfluencerBudget)
: undefined,
productValue:
typeof data.productValue === "number"
? toPaise(data.productValue)
: undefined,
deliverables: data.deliverables.map((d) => ({
...d,
rate: typeof d.rate === "number" ? toPaise(d.rate) : undefined,
})),
};
}

function handleCampaignPostError(error: unknown) {
logger.error("POST /api/campaigns error", error);

if (error instanceof AppError) {
if (error instanceof TierError) {
return ApiResponse.forbidden(error.message || "Verification required");
}
return ApiResponse.error(error.message, error.statusCode);
}

const errMsg = error instanceof Error ? error.message : String(error);
if (errMsg?.includes("Insufficient wallet balance")) {
return ApiResponse.error(errMsg);
}

if (errMsg?.includes("required") || errMsg?.includes("Invalid")) {
return ApiResponse.error(errMsg);
}

return ApiResponse.error("Internal server error", 500);
}

async function _handler_POST(request: NextRequest) {
try {
const session = (request as AuthenticatedRequest).session;
const userType = session.user.userType;

// After permission check, userType is guaranteed to be BRAND
const safeUserType = userType as UserType;

const limit = await checkRateLimit(session.user.id, "CAMPAIGNS");
if (!limit.success) {
return ApiResponse.tooManyRequests("Too many campaign requests");
}

const body = await request.json();
const validation = validateCampaignPayload(body);
if (!validation.success) {
return ApiResponse.error(validation.message!);
}

const payload = prepareCampaignPayload(validation.data!);

const campaign = await CampaignService.createCampaign(
session.user.id,
safeUserType,
payload,
);

return ApiResponse.success(campaign, "Campaign created", 201);
} catch (error: unknown) {
return handleCampaignPostError(error);
}
}


// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET, { requireAuth: true });
export const POST = apiWrapper(_handler_POST, { requirePermission: "CREATE_CAMPAIGN" });
