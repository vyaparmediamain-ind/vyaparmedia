import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { BlockService } from "@/services/block.service";
import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { z } from "zod";

import { checkRateLimit } from "@/lib/rate-limit";

const reportBodySchema = z.object({
reportedUserId: z.string().cuid(),
reason: z.string().min(3).max(300, "Reason must be at most 300 characters"),
description: z.string().max(2000, "Description must be at most 2000 characters").optional(),
});

async function _handler_POST(request: NextRequest) {
const session = await auth();
if (!session?.user?.id) {
return ApiResponse.unauthorized();
}

const limit = await checkRateLimit(session.user.id, "USER_REPORTS");
if (!limit.success) {
return ApiResponse.tooManyRequests("You are reporting users too frequently. Please try again later.");
}

const body = await request.json().catch(() => null);
const parsed = reportBodySchema.safeParse(body);
if (!parsed.success) {
return ApiResponse.error("Invalid payload", 400);
}

const { reportedUserId, reason, description } = parsed.data;

await BlockService.reportUser(session.user.id, reportedUserId, reason, description);
return ApiResponse.success(null, "User reported successfully");
}

export const POST = apiWrapper(_handler_POST, { requireAuth: true });
