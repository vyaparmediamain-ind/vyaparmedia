import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { NextRequest } from "next/server";
import { z } from "zod";
import { AdminService } from "@/services/admin.service";
import { logger } from "@/lib/logger";
import { paginationSchema } from "@/lib/validations";
import { AppError } from "@/lib/errors";

const querySchema = paginationSchema.extend({
search: z.string().trim().max(100).optional(),
type: z.enum(["INFLUENCER", "BRAND", "ADMIN", "ALL"]).optional(),
status: z
.enum(["ACTIVE", "PENDING_VERIFICATION", "SUSPENDED", "BANNED", "ALL"])
.optional(),
});

async function _handler_GET(request: NextRequest) {
try {
const { searchParams } = new URL(request.url);
const parsed = querySchema.safeParse({
page: searchParams.get("page") || undefined,
limit: searchParams.get("limit") || undefined,
search: searchParams.get("search")?.trim() || searchParams.get("q") || undefined,
type: searchParams.get("type") || undefined,
status: searchParams.get("status") || undefined,
});

if (!parsed.success) {
return ApiResponse.error("Invalid queries");
}

const { page, limit, type, status, search } = parsed.data;
const users = await AdminService.listUsers({
page,
limit,
...(search ? { search } : {}),
...(type && type !== "ALL" ? { userType: type } : {}),
...(status && status !== "ALL" ? { status } : {}),
});

return ApiResponse.success(users, "Users retrieved");
} catch (error: unknown) {
logger.error("GET /api/admin/users error", { error: (error instanceof Error ? error.message : String(error)) });
if (error instanceof AppError) {
return ApiResponse.error(error.message, error.statusCode);
}
return ApiResponse.error("Internal server error", 500);
}
}


// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET, { requireAuth: true, requireAdmin: true });
