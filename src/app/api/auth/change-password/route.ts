import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { AuthService } from "@/services/auth.service";
import { logger } from "@/lib/logger";
import { passwordSchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";

const changePasswordSchema = z.object({
oldPassword: z.string().min(1, "Current password is required"),
newPassword: passwordSchema,
});

function validatePayload(body: unknown) {
const parsed = changePasswordSchema.safeParse(body);
if (!parsed.success) {
const firstIssue = parsed.error.issues[0];
const fieldName = firstIssue?.path.join(".") || "";
const issueMsg = firstIssue?.message || "Invalid value";
const prefix = fieldName ? `${fieldName} - ` : "";
return {
success: false,
message: `Invalid request payload: ${prefix}${issueMsg}`,
errors: parsed.error.format()
};
}
return { success: true, data: parsed.data };
}

function handleChangePasswordError(error: unknown) {
logger.warn("Password change failed", { error: (error instanceof Error ? error.message : String(error)) });

if (error instanceof AppError) {
return NextResponse.json(
{ success: false, message: error.message === "Incorrect old password" ? "Incorrect current password" : error.message },
{ status: error.statusCode }
);
}

const errorMsg = error instanceof Error ? error.message : String(error);
if (errorMsg === "Incorrect old password" || errorMsg === "User not found") {
return NextResponse.json(
{ success: false, message: "Incorrect current password" },
{ status: 400 }
);
}

return NextResponse.json(
{ success: false, message: "Internal server error" },
{ status: 500 }
);
}

async function _handler_POST(request: NextRequest) {
try {
const session = await auth();
if (!session?.user?.id) {
return NextResponse.json(
{ success: false, message: "Unauthorized. Valid session required." },
{ status: 401 }
);
}

const limit = await checkRateLimit(session.user.id, "AUTH");
if (!limit.success) {
return NextResponse.json(
{ success: false, message: "Too many password change attempts" },
{ status: 429 },
);
}

const body = await request.json();
const validation = validatePayload(body);

if (!validation.success) {
return NextResponse.json(
{
success: false,
message: validation.message,
data: validation.errors
},
{ status: 400 }
);
}

const { oldPassword, newPassword } = validation.data!;

if (oldPassword === newPassword) {
return NextResponse.json(
{ success: false, message: "New password must be different from the old password" },
{ status: 400 }
);
}

await AuthService.changePassword(session.user.id, oldPassword, newPassword);

return NextResponse.json(
{ success: true, message: "Password changed successfully" },
{ status: 200 }
);
} catch (error: unknown) {
return handleChangePasswordError(error);
}
}


// Wrapped handlers via apiWrapper
export const POST = apiWrapper(_handler_POST);
