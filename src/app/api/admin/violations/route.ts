import { NextRequest, NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { AdminService } from "@/services/admin.service";

async function _handler_GET(request: NextRequest) {

const { searchParams } = new URL(request.url);
const userId = searchParams.get("userId")?.trim() || undefined;

const violations = await AdminService.listViolations(userId);

return NextResponse.json({
success: true,
data: violations,
});
}

export const GET = apiWrapper(_handler_GET, { requireAdmin: true });
