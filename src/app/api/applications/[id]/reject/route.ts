import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { routeParamsSchema } from "@/lib/validations";
import { ApplicationService } from "@/services/application.service";
import { handleApplicationError } from "@/lib/application-error-helper";

const paramsSchema = routeParamsSchema;
const bodySchema = z.object({ reason: z.string().min(5).max(500).optional() });

async function _handler_POST(
request: NextRequest,
context: { params: Promise<Record<string, string | string[]>> },
) {
try {
const session = await auth();
const userId = session?.user?.id;
if (!userId) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

const resolvedParams = await context.params;
const parsedParams = paramsSchema.safeParse(resolvedParams);
if (!parsedParams.success) {
return NextResponse.json(
{ success: false, message: "Invalid application ID" },
{ status: 400 },
);
}

const body = await request.json().catch(() => ({}));
const parsedBody = bodySchema.safeParse(body);
if (!parsedBody.success) {
return NextResponse.json(
{ success: false, message: "Invalid payload", data: parsedBody.error.format() },
{ status: 400 },
);
}

const application = await ApplicationService.rejectApplication(
userId,
parsedParams.data.id,
parsedBody.data.reason,
);

return NextResponse.json({
success: true,
message: "Application rejected",
data: { application },
});
} catch (error: unknown) {
return handleApplicationError(error, "Failed to reject application", "POST /api/applications/[id]/reject error");
}
}

// Wrapped handlers via apiWrapper
export const POST = apiWrapper(_handler_POST, {
requireBrand: true,
brandErrorMessage: "Brand authorization required",
userRateLimit: {
bucket: "APPLICATIONS",
errorMessage: "Too many application requests",
},
});
