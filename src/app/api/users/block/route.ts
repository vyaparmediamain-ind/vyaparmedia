import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { BlockService } from "@/services/block.service";
import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { z } from "zod";

const blockBodySchema = z.object({
blockedUserId: z.string().cuid(),
action: z.enum(["block", "unblock"]),
});

async function _handler_POST(request: NextRequest) {
const session = await auth();
if (!session?.user?.id) {
return ApiResponse.unauthorized();
}

const body = await request.json().catch(() => null);
const parsed = blockBodySchema.safeParse(body);
if (!parsed.success) {
return ApiResponse.error("Invalid payload", 400);
}

const { blockedUserId, action } = parsed.data;

if (action === "block") {
await BlockService.blockUser(session.user.id, blockedUserId);
return ApiResponse.success(null, "User blocked successfully");
} else {
await BlockService.unblockUser(session.user.id, blockedUserId);
return ApiResponse.success(null, "User unblocked successfully");
}
}

async function _handler_GET(request: NextRequest) {
const session = await auth();
if (!session?.user?.id) {
return ApiResponse.unauthorized();
}

const { searchParams } = new URL(request.url);
const checkUserId = searchParams.get("checkUserId")?.trim();

if (checkUserId) {
const isBlocked = await BlockService.isBlocked(session.user.id, checkUserId);
return ApiResponse.success({ isBlocked });
}

const blockedUsers = await BlockService.listBlockedUsers(session.user.id);
return ApiResponse.success(blockedUsers);
}

export const POST = apiWrapper(_handler_POST, { requireAuth: true });
export const GET = apiWrapper(_handler_GET, { requireAuth: true });
