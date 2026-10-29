import { apiWrapper, ValidatedNextRequest } from "@/lib/api-wrapper";
import { NextResponse } from "next/server";
import { z } from "zod";
import { routeParamsSchema } from "@/lib/validations";
import { ApplicationService } from "@/services/application.service";
import { handleApplicationError } from "@/lib/application-error-helper";
import {
  claimIdempotencyKey,
  releaseIdempotencyKey,
  saveIdempotencyResponse,
} from "@/lib/idempotency";

const paramsSchema = routeParamsSchema;

async function _handler_POST(
_request: ValidatedNextRequest,
context: { params: Promise<Record<string, string | string[]>> },
) {
const session = _request.session;
const userId = session?.user?.id;
if (!userId) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

const resolvedParams = await context.params;
const parsedParams = paramsSchema.safeParse(resolvedParams);
if (!parsedParams.success) return NextResponse.json({ success: false, message: "Invalid ID" }, { status: 400 });

const applicationId = parsedParams.data.id;
const idempotencyHeader = _request.headers.get("Idempotency-Key")?.trim();
const idempotencyKey = idempotencyHeader && /^[A-Za-z0-9:_-]{16,128}$/.test(idempotencyHeader)
  ? `accept_app:${userId}:${applicationId}:${idempotencyHeader}`
  : `accept_app:${userId}:${applicationId}:default`;

const claim = await claimIdempotencyKey(idempotencyKey, userId);
if (claim.isDuplicate) {
  if (claim.savedResponse) {
    const saved = claim.savedResponse as { status?: number | string; body?: unknown };
    if (saved.status === "PROCESSING") {
      return NextResponse.json(
        { success: false, message: "A request to accept this application is already processing. Please wait." },
        { status: 409 },
      );
    }
    return NextResponse.json(saved.body ?? saved, {
      status: typeof saved.status === "number" ? saved.status : 200,
    });
  }
  return NextResponse.json({ success: false, message: "Duplicate accept application request detected." }, { status: 409 });
}

try {
let customRate: number | undefined;
try {
const body = await _request.json();
if (body?.customRate !== undefined) {
// Validate customRate: must be a positive integer in paise, max 10 lakh (100_000_000 paise)
const rateSchema = z.number()
.int("customRate must be a whole number in paise")
.positive("customRate must be positive")
.max(100_000_000, "customRate cannot exceed 10,00,000 (100000000 paise)");
const parsed = rateSchema.safeParse(body.customRate);
if (!parsed.success) {
await releaseIdempotencyKey(idempotencyKey, userId);
return NextResponse.json(
{ success: false, message: parsed.error.issues[0]?.message || "Invalid customRate" },
{ status: 400 },
);
}
customRate = parsed.data;
}
} catch {
// Body parsing fails if request has no body, which is expected for default accepts
}

const deal = await ApplicationService.acceptApplication(
userId,
applicationId,
customRate,
);

const responseBody = { success: true, message: "Application accepted, deal initiated.", data: deal };

await saveIdempotencyResponse(
  idempotencyKey,
  { status: 200, body: responseBody },
  userId,
);

return NextResponse.json(responseBody, { status: 200 });
} catch (error: unknown) {
await releaseIdempotencyKey(idempotencyKey, userId);
return handleApplicationError(error, "Failed to accept application", "POST /api/applications/[id]/accept error");
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
