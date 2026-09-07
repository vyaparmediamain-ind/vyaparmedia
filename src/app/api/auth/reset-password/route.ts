import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest, NextResponse } from "next/server";
import { getSecureClientIp } from "@/lib/ip";
import { z } from "zod";
import { AuthService } from "@/services/auth.service";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { emailSchema, passwordSchema } from "@/lib/validations";
import { AppError } from "@/lib/errors";

const requestResetSchema = z.object({
action: z.literal("request"),
email: emailSchema,
});

const completeResetSchema = z.object({
action: z.literal("reset").optional(),
token: z.string().min(32, "Invalid token format").max(256),
newPassword: passwordSchema,
});

async function handleRequestReset(request: NextRequest, body: unknown) {
const parsed = requestResetSchema.safeParse(body);
if (!parsed.success) {
const firstIssue = parsed.error.issues[0];
const fieldName = firstIssue?.path.join(".") || "";
const issueMsg = firstIssue?.message || "Invalid value";
const prefix = fieldName ? `${fieldName} - ` : "";
const errorStr = `Invalid request payload: ${prefix}${issueMsg}`;
return NextResponse.json(
{
success: false,
error: errorStr,
message: errorStr,
data: parsed.error.format(),
},
{ status: 400 },
);
}

const ip = getSecureClientIp(request);

const [ipLimit, emailLimit] = await Promise.all([
checkRateLimit(ip, "PASSWORD_RESET"),
checkRateLimit(parsed.data.email, "PASSWORD_RESET"),
]);

if (!ipLimit.success || !emailLimit.success) {
return NextResponse.json(
{
success: false,
error: "Too many password reset requests. Please try again later.",
message: "Too many password reset requests. Please try again later.",
},
{ status: 429 },
);
}

const result = await AuthService.requestPasswordReset(parsed.data.email);
const response: Record<string, unknown> = {
success: true,
message: "If an account exists, a reset link has been sent.",
};

if (process.env.NODE_ENV !== "production") {
response.emailSent = result.sent;
}

return NextResponse.json(response, { status: 200 });
}

async function handleCompleteReset(body: unknown) {
const parsed = completeResetSchema.safeParse(body);
if (!parsed.success) {
const firstIssue = parsed.error.issues[0];
const fieldName = firstIssue?.path.join(".") || "";
const issueMsg = firstIssue?.message || "Invalid value";
const prefix = fieldName ? `${fieldName} - ` : "";
const errorStr = `Invalid request payload: ${prefix}${issueMsg}`;
return NextResponse.json(
{
success: false,
error: errorStr,
message: errorStr,
data: parsed.error.format(),
},
{ status: 400 },
);
}

const { token, newPassword } = parsed.data;
await AuthService.resetPassword(token, newPassword);

return NextResponse.json(
{ success: true, message: "Password has been successfully reset" },
{ status: 200 },
);
}

async function parseRequestBody(request: NextRequest) {
try {
return await request.json();
} catch {
return {};
}
}

function handleResetError(error: unknown) {
logger.warn("Password reset failed", {
error: error instanceof Error ? error.message : String(error),
});

if (error instanceof AppError) {
const errorMsg = error.message === "Invalid or expired token"
? "The reset link is invalid or has expired."
: error.message;
return NextResponse.json(
{
success: false,
error: errorMsg,
message: errorMsg,
},
{ status: error.statusCode }
);
}

const rawMsg = error instanceof Error ? error.message : String(error);
if (rawMsg === "Invalid or expired token") {
return NextResponse.json(
{
success: false,
error: "The reset link is invalid or has expired.",
message: "The reset link is invalid or has expired.",
},
{ status: 400 },
);
}

return NextResponse.json(
{
success: false,
error: "Internal server error",
message: "Internal server error",
},
{ status: 500 },
);
}

async function _handler_POST(request: NextRequest) {
try {
const body = await parseRequestBody(request);

if (body && typeof body === "object" && !Array.isArray(body) && body.action === "request") {
return await handleRequestReset(request, body);
}

return await handleCompleteReset(body);
} catch (error: unknown) {
return handleResetError(error);
}
}

// Wrapped handlers via apiWrapper
export const POST = apiWrapper(_handler_POST);
