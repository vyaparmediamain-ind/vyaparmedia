import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { routeParamsSchema, createCampaignSchema } from "@/lib/validations";
import { CampaignService } from "@/services/campaign.service";
import { requireActiveAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/db";
import { isAdmin, isInfluencer } from "@/lib/rbac";
import { AppError } from "@/lib/errors";
import { TierError } from "@/services/campaign/types";
import { toPaise } from "@/lib/utils";

const paramsSchema = routeParamsSchema;
const actionSchema = z.object({ action: z.enum(["ACTIVATE", "CANCEL"]) });

function parseCampaignId(resolvedParams: Record<string, string | string[]>) {
const parsed = paramsSchema.safeParse(resolvedParams);
if (!parsed.success) {
return {
errorResponse: NextResponse.json(
{ success: false, message: "Invalid campaign ID" },
{ status: 400 },
),
};
}
return { id: parsed.data.id };
}

function handleApiError(error: unknown, defaultMessage: string, loggerLabel: string) {
logger.error(loggerLabel, error);

if (error instanceof AppError) {
if (error instanceof TierError) {
return NextResponse.json(
{ success: false, message: error.message || "Verification required" },
{ status: 403 },
);
}
return NextResponse.json(
{ success: false, message: error.message },
{ status: error.statusCode },
);
}

const errorMsg = error instanceof Error ? error.message : String(error);

if (errorMsg.includes("not found") || errorMsg.includes("unauthorized")) {
return NextResponse.json(
{ success: false, message: errorMsg },
{ status: 404 },
);
}

const badRequestStrings = [
"Insufficient wallet balance",
"Cannot cancel",
"DRAFT",
"only be updated in DRAFT",
];

if (badRequestStrings.some((s) => errorMsg.includes(s))) {
return NextResponse.json(
{ success: false, message: errorMsg },
{ status: 400 },
);
}

return NextResponse.json(
{ success: false, message: defaultMessage },
{ status: 500 },
);
}

async function _handler_GET(
_request: NextRequest,
context: { params: Promise<Record<string, string | string[]>> },
) {
try {
const session = await auth();
if (!session?.user?.id) {
return NextResponse.json(
{ success: false, message: "Unauthorized" },
{ status: 401 },
);
}

const resolvedParams = await context.params;
const { id, errorResponse } = parseCampaignId(resolvedParams);
if (errorResponse) return errorResponse;

const userType = session.user.userType;
if (isAdmin(userType)) {
await requireActiveAdmin(session.user);
}

const campaign = await CampaignService.getCampaignById(
id!,
session.user.id,
userType,
);

if (!campaign) {
return NextResponse.json(
{ success: false, message: "Campaign not found" },
{ status: 404 },
);
}

let hasApplied = false;
let applicationStatus: string | null = null;

if (isInfluencer(userType)) {
const influencerProfile = await prisma.influencerProfile.findUnique({
where: { userId: session.user.id },
select: { id: true },
});
if (influencerProfile) {
const application = await prisma.application.findFirst({
where: {
campaignId: id!,
influencerId: influencerProfile.id,
},
select: { status: true },
});
if (application) {
hasApplied = true;
applicationStatus = application.status;
}
}
}

return NextResponse.json(
{
success: true,
message: "Campaign loaded",
data: { campaign, hasApplied, applicationStatus },
campaign: {
...campaign,
hasApplied,
applicationStatus,
},
},
{ status: 200 },
);
} catch (error: unknown) {
return handleApiError(error, "Internal server error", "GET /api/campaigns/[id]");
}
}

async function _handler_PATCH(
request: NextRequest,
context: { params: Promise<Record<string, string | string[]>> },
) {
try {
const session = await auth();
const userId = session?.user?.id;
if (!userId) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

const resolvedParams = await context.params;
const { id, errorResponse } = parseCampaignId(resolvedParams);
if (errorResponse) return errorResponse;

const body = await request.json();
const parsedBody = actionSchema.safeParse(body);
if (!parsedBody.success) {
return NextResponse.json(
{ success: false, message: "Invalid action" },
{ status: 400 },
);
}

const action = parsedBody.data.action;
const campaign =
action === "ACTIVATE"
? await CampaignService.activateDraftCampaign(userId, id)
: await CampaignService.cancelCampaign(userId, id);

return NextResponse.json(
{
success: true,
message:
action === "ACTIVATE"
? "Campaign activated successfully"
: "Campaign cancelled successfully",
data: { campaign },
},
{ status: 200 },
);
} catch (error: unknown) {
return handleApiError(error, "Failed to update campaign", "PATCH /api/campaigns/[id]");
}
}

async function _handler_DELETE(
_request: NextRequest,
context: { params: Promise<Record<string, string | string[]>> },
) {
try {
const session = await auth();
const userId = session?.user?.id;
if (!userId) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

const resolvedParams = await context.params;
const { id, errorResponse } = parseCampaignId(resolvedParams);
if (errorResponse) return errorResponse;

await CampaignService.cancelCampaign(userId, id);

return NextResponse.json(
{ success: true, message: "Campaign cancelled successfully" },
{ status: 200 },
);
} catch (error: unknown) {
return handleApiError(error, "Failed to cancel campaign", "DELETE /api/campaigns/[id]");
}
}

async function _handler_PUT(
request: NextRequest,
context: { params: Promise<Record<string, string | string[]>> },
) {
try {
const session = await auth();
const userId = session?.user?.id;
if (!userId) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

const resolvedParams = await context.params;
const { id, errorResponse } = parseCampaignId(resolvedParams);
if (errorResponse) return errorResponse;

const body = await request.json();
const parsedBody = createCampaignSchema.safeParse(body);
if (!parsedBody.success) {
const firstIssue = parsedBody.error.issues[0];
const fieldName = firstIssue?.path.join(".") || "";
const issueMsg = firstIssue?.message || "Invalid value";
const prefix = fieldName ? `${fieldName} - ` : "";
return NextResponse.json(
{
success: false,
message: `Invalid payload: ${prefix}${issueMsg}`,
data: parsedBody.error.format(),
},
{ status: 400 },
);
}

const payload = {
...parsedBody.data,
totalBudget: toPaise(parsedBody.data.totalBudget),
perInfluencerBudget:
parsedBody.data.perInfluencerBudget === undefined
? undefined
: toPaise(parsedBody.data.perInfluencerBudget),
productValue:
parsedBody.data.productValue === undefined
? undefined
: toPaise(parsedBody.data.productValue),
deliverables: parsedBody.data.deliverables.map((d) => ({
...d,
rate: d.rate === undefined ? undefined : toPaise(d.rate),
})),
};

const campaign = await CampaignService.updateDraftCampaign(
id!,
userId,
payload,
);

return NextResponse.json(
{ success: true, message: "Campaign updated successfully", data: campaign },
{ status: 200 },
);
} catch (error: unknown) {
return handleApiError(error, "Failed to update campaign", "PUT /api/campaigns/[id]");
}
}

// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET);

const brandWriteOptions = {
requireBrand: true,
brandErrorMessage: "Brand account required",
userRateLimit: {
bucket: "CAMPAIGNS",
errorMessage: "Too many campaign requests",
},
} as const;

export const PUT = apiWrapper(_handler_PUT, brandWriteOptions);
export const DELETE = apiWrapper(_handler_DELETE, brandWriteOptions);
export const PATCH = apiWrapper(_handler_PATCH, brandWriteOptions);
