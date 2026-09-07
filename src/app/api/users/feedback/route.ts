import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { z } from "zod";
import { createActivityLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSecureClientIp } from "@/lib/ip";

const feedbackSchema = z.object({
type: z.enum(["BUG", "FEEDBACK"]),
title: z.string().min(5, "Title must be at least 5 characters long").max(200, "Title must be at most 200 characters"),
description: z.string().min(10, "Description must be at least 10 characters long").max(5000, "Description must be at most 5000 characters"),
screenshotUrl: z
.string()
.trim()
.refine((val) => {
if (!val) return true;
if (val.startsWith("/")) return true;
try {
const u = new URL(val);
return u.protocol === "http:" || u.protocol === "https:";
} catch {
return false;
}
}, "Invalid screenshot URL or local path")
.optional()
.or(z.literal("")),
});

async function _handler_POST(request: NextRequest) {
const session = await auth();
if (!session?.user?.id) {
return ApiResponse.unauthorized();
}

const limit = await checkRateLimit(session.user.id, "USER_REPORTS");
if (!limit.success) {
return ApiResponse.tooManyRequests("You are submitting requests too frequently. Please try again later.");
}

const body = await request.json().catch(() => null);
const parsed = feedbackSchema.safeParse(body);
if (!parsed.success) {
return ApiResponse.error(parsed.error.issues[0]?.message || "Invalid payload", 400);
}

const { type, title, description, screenshotUrl } = parsed.data;
const clientIp = getSecureClientIp(request);

// Log the activity and create audit log record
await createActivityLog({
userId: session.user.id,
action: type === "BUG" ? "BUG_REPORT_SUBMITTED" : "FEEDBACK_SUBMITTED",
entityType: type === "BUG" ? "BUG" : "FEEDBACK",
metadata: { title, description, screenshotUrl: screenshotUrl || undefined },
ipAddress: clientIp,
});

  return ApiResponse.success(
    null,
    type === "BUG"
      ? "Bug report submitted successfully! Admin will review your submission shortly."
      : "Feedback submitted successfully! Admin will review your submission shortly."
  );
}

export const POST = apiWrapper(_handler_POST, { requireAuth: true });
