import { apiWrapper } from "@/lib/api-wrapper";
/**
* Deal Engagement API
* GET: Fetch engagement metrics for a deal
* POST: Manually trigger engagement capture (admin/cron)
*/
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import {
getEngagementReport,
captureEngagement,
} from "@/lib/engagement-tracker";
import { logger } from "@/lib/logger";
import { getDealParticipantRole } from "@/lib/utils";

/** Shared: authenticate session and load the deal, guard participant access. */
async function resolveAuthorizedDeal(
context: { params: Promise<Record<string, string | string[]>> },
userId: string,
) {
const resolvedParams = await context.params;
const id = String(resolvedParams.id ?? "");

const deal = await prisma.deal.findUnique({
where: { id },
include: {
influencer: { select: { userId: true } },
brand: { select: { userId: true } },
},
});

if (!deal) {
return {
id,
deal: null,
errorResponse: NextResponse.json({ error: "Deal not found" }, { status: 404 }),
};
}

const { isInfluencer, isBrand } = getDealParticipantRole(deal, userId);
if (!isInfluencer && !isBrand) {
return {
id,
deal: null,
errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 403 }),
};
}

return { id, deal, errorResponse: null };
}

async function _handler_GET(
_request: NextRequest,
context: { params: Promise<Record<string, string | string[]>> },
) {
try {
const session = await auth();
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const { id, errorResponse } = await resolveAuthorizedDeal(context, session.user.id);
if (errorResponse) return errorResponse;

const report = await getEngagementReport(id);

return NextResponse.json({
engagement: report,
// Surface a clear disclaimer when metrics are rule-based estimates, not
// real Instagram/YouTube API data. Brands must not make decisions based
// on these numbers without understanding they are modelled approximations.
dataDisclaimer: report?.hasEstimatedData
? " Engagement metrics marked as estimated are modelled approximations based on follower count and historical engagement rates not real-time data from Instagram/YouTube APIs. Treat these figures as indicative only."
: null,
});
} catch (error) {
logger.error("Engagement fetch error", error);
return NextResponse.json(
{ error: "Failed to fetch engagement" },
{ status: 500 },
);
}
}

async function _handler_POST(
request: NextRequest,
context: { params: Promise<Record<string, string | string[]>> },
) {
try {
const session = await auth();
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

let body;
try {
body = await request.json();
} catch {
return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
}

const interval = body.interval;
if (!["24h", "48h", "7d"].includes(interval)) {
return NextResponse.json(
{ error: "Invalid interval. Must be 24h, 48h, or 7d" },
{ status: 400 },
);
}

const { id, deal, errorResponse } = await resolveAuthorizedDeal(context, session.user.id);
if (errorResponse || !deal) return errorResponse || NextResponse.json({ error: "Deal not found" }, { status: 404 });

if (!deal.postUrl) {
return NextResponse.json(
{ error: "No post URL found. Post must be verified first." },
{ status: 400 },
);
}

const metrics = await captureEngagement(id, interval);

if (!metrics) {
return NextResponse.json(
{ error: "Failed to capture engagement metrics" },
{ status: 500 },
);
}

return NextResponse.json({
success: true,
interval,
metrics,
});
} catch (error) {
logger.error("Engagement capture error", error);
return NextResponse.json(
{ error: "Engagement capture failed" },
{ status: 500 },
);
}
}

// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET);
export const POST = apiWrapper(_handler_POST);
