import { auth } from "@/lib/auth";
import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { DealService } from "@/services/deal.service";
import {
contentSubmissionSchema,
contentApprovalSchema,
postVerificationSchema,
} from "@/lib/validations";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { parsePagination } from "@/lib/utils";
import { hasPermission, isAdmin, isInfluencer } from "@/lib/rbac";

export const GET = apiWrapper(async (req) => {
const session = await auth();
if (!session?.user?.id) {
return ApiResponse.unauthorized();
}

const { searchParams } = new URL(req.url);
const { page, limit } = parsePagination(searchParams);
const status = searchParams.get("status")?.trim();

if (isAdmin(session.user.userType)) {
await requireActiveAdmin(session.user);
}

const result = await DealService.listDeals(
session.user.id,
session.user.userType,
{
...(status ? { status } : {}),
page,
limit,
},
);

return ApiResponse.success(
{
deals: result.deals,
pagination: {
page,
limit,
total: result.total,
totalPages: Math.ceil(result.total / (limit || 1)),
},
stats: result.stats,
},
"Deals retrieved successfully",
);
});

async function handleSubmitContent(userId: string, userType: string, body: unknown) {
  if (!hasPermission(userType, "SUBMIT_CONTENT")) {
    return ApiResponse.forbidden("Influencer access required");
  }
  const parsed = contentSubmissionSchema.parse(body);
  const result = await DealService.submitContent(
    userId,
    parsed.dealId,
    parsed.contentUrl || "",
    parsed.notes,
    parsed.contentUrls,
  );
  return ApiResponse.success(result, "Content submitted");
}

async function handleReviewContent(userId: string, userType: string, body: unknown) {
  if (!hasPermission(userType, "REVIEW_CONTENT")) {
    return ApiResponse.forbidden("Brand access required");
  }
  const parsed = contentApprovalSchema.parse(body);
  if (parsed.approved && !parsed.reviews) {
    await DealService.approveContent(userId, parsed.dealId);
    return ApiResponse.success(null, "Content approved");
  } else {
    // M18 FIX: When rejecting (approved=false), reviews are required.
    // Without this guard, an empty reviews array would silently call reviewContent
    // with no feedback — the influencer would never know why their content was rejected.
    if (!parsed.approved && (!parsed.reviews || parsed.reviews.length === 0)) {
      return ApiResponse.error("At least one review comment is required when rejecting content", 400);
    }
    const result = await DealService.reviewContent(
      userId,
      parsed.dealId,
      parsed.reviews || []
    );
    return ApiResponse.success(result, "Content reviewed");
  }
}

async function handleVerifyPost(userId: string, userType: string, body: unknown) {
  if (!isInfluencer(userType)) {
    return ApiResponse.forbidden("Influencer access required");
  }
  const parsed = postVerificationSchema.parse(body);
  await DealService.verifyPost(
    userId,
    parsed.dealId,
    parsed.postUrl,
  );
  return ApiResponse.success(null, "Post verified");
}

export const POST = apiWrapper(async (req) => {
  const session = await auth();
  if (!session?.user?.id) {
    return ApiResponse.unauthorized();
  }

  const limit = await checkRateLimit(session.user.id, "DEAL_UPDATES");
  if (!limit.success) {
    return ApiResponse.tooManyRequests("Too many deal update requests");
  }

  const body = await req.json();
  const action = body.action;

  if (action === "submit_content") {
    return handleSubmitContent(session.user.id, session.user.userType, body);
  }

  if (action === "review_content") {
    return handleReviewContent(session.user.id, session.user.userType, body);
  }

  if (action === "verify_post") {
    return handleVerifyPost(session.user.id, session.user.userType, body);
  }

  return ApiResponse.error("Invalid action");
});
