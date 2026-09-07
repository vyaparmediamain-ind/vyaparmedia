import { apiWrapper, ApiResponse, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { NextRequest } from "next/server";
import { isAdmin } from "@/lib/rbac";
import { ApplicationService } from "@/services/application.service";
import { logger } from "@/lib/logger";
import { createApplicationSchema } from "@/lib/validations";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { parsePagination } from "@/lib/utils";
import { AppError } from "@/lib/errors";

async function _handler_GET(request: NextRequest) {
try {
const session = (request as AuthenticatedRequest).session;

const { searchParams } = new URL(request.url);
const campaignId = searchParams.get("campaignId")?.trim();
const { page, limit, skip: _skip } = parsePagination(searchParams);

const userType = session.user.userType || "INFLUENCER";
if (isAdmin(userType)) {
await requireActiveAdmin(session.user);
}

const apps = await ApplicationService.listApplications(
session.user.id,
userType,
{
...(campaignId ? { campaignId } : {}),
page,
limit,
},
);

return ApiResponse.success(apps, "Applications loaded");
} catch (error: unknown) {
logger.error("GET /api/applications error", { error: (error instanceof Error ? error.message : String(error)) });
return ApiResponse.error("Internal server error", 500);
}
}

async function _handler_POST(request: NextRequest) {
try {
const session = (request as AuthenticatedRequest).session;

const limit = await checkRateLimit(session.user.id, "APPLICATIONS");
if (!limit.success) {
return ApiResponse.tooManyRequests("Too many application requests");
}

const body = await request.json();
const parsed = createApplicationSchema.safeParse(body);
if (!parsed.success) {
const firstIssue = parsed.error.issues[0];
const fieldName = firstIssue?.path.join(".") || "";
const issueMsg = firstIssue?.message || "Invalid value";
const prefix = fieldName ? `${fieldName} - ` : "";
return ApiResponse.error(`Invalid payload: ${prefix}${issueMsg}`);
}

const application = await ApplicationService.createApplication(session.user.id, {
...parsed.data,
...(parsed.data.estimatedDeliveryDays
? {
estimatedDelivery: new Date(
Date.now() + parsed.data.estimatedDeliveryDays * 24 * 60 * 60 * 1000,
).toISOString(),
}
: {}),
});
return ApiResponse.success(application, "Application submitted", 201);
} catch (error: unknown) {
logger.error("POST /api/applications error", { error: (error instanceof Error ? error.message : String(error)) });

if (error instanceof AppError) {
return ApiResponse.error(error.message, error.statusCode);
}

const message = (error instanceof Error ? error.message : String(error)) || "Submission failed";
const isBusinessValidation =
message.includes("Already applied") ||
message.includes("already applied") ||
message.includes("complete your") ||
message.includes("must") ||
message.includes("required") ||
message.includes("not accepting") ||
message.includes("deadline") ||
message.includes("Verification") ||
message.includes("Trust score") ||
message.includes("Limited by") ||
message.includes("blocked") ||
message.includes("authenticity") ||
message.includes("Authenticity");

if (isBusinessValidation) {
return ApiResponse.error(message);
}

return ApiResponse.error("Submission failed", 500);
}
}


// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET, { requireAuth: true });
export const POST = apiWrapper(_handler_POST, { requirePermission: "APPLY_CAMPAIGN" });
