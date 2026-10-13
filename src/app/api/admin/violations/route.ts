import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { auth } from "@/lib/auth";
import { AdminService } from "@/services/admin.service";
import { requireActiveAdmin } from "@/lib/admin-auth";

async function _handler_GET(request: NextRequest) {
const session = await auth();
await requireActiveAdmin(session?.user);

const { searchParams } = new URL(request.url);
const userId = searchParams.get("userId")?.trim() || undefined;

const violations = await AdminService.listViolations(userId);

return NextResponse.json({
success: true,
data: violations,
});
}

export const GET = apiWrapper(_handler_GET);
