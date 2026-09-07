import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest, NextResponse } from "next/server";
import { getSecureClientIp } from "@/lib/ip";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import prisma from "@/lib/db";
import { NotificationService } from "@/services/notification.service";
import { signAndSaveDealContract } from "@/lib/contract-engine";
import { logger } from "@/lib/logger";
import { routeParamsSchema } from "@/lib/validations";
import { invalidate } from "@/lib/cache";
import { checkRateLimit } from "@/lib/rate-limit";
import { getDealParticipantRole } from "@/lib/utils";
import { Prisma } from "@prisma/client";

interface SignResult {
signed: {
isFullySigned: boolean;
};
}

type DealToSign = Prisma.DealGetPayload<{
include: {
influencer: { select: { userId: true; displayName: true } };
brand: { select: { userId: true; companyName: true } };
campaign: { select: { title: true } };
};
}>;


const paramsSchema = routeParamsSchema;

async function validateAndGetDealToSign(dealId: string, userId: string) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, deletedAt: null },
    include: {
      influencer: { select: { userId: true, displayName: true } },
      brand: { select: { userId: true, companyName: true } },
      campaign: { select: { title: true } },
    },
  });

  if (!deal) {
    throw AppError.notFound("Deal not found");
  }

  if (deal.status !== "PENDING_SIGNATURE") {
    throw AppError.badRequest("Deal is not pending signature");
  }

  if (deal.signDeadline && new Date() > new Date(deal.signDeadline)) {
    throw AppError.badRequest("Contract signature deadline has expired");
  }

  const { isInfluencer, isBrand } = getDealParticipantRole(deal, userId);

  if (!isInfluencer && !isBrand) {
    throw AppError.forbidden("You are not a party to this deal");
  }

  return { deal, isInfluencer };
}

function handleSignContractError(error: unknown) {
if (error instanceof AppError) {
return NextResponse.json(
{ error: error.message },
{ status: error.statusCode }
);
}

const msg = error instanceof Error ? error.message : "";

if (msg.includes("already signed")) {
return NextResponse.json(
{ error: "This contract has already been signed" },
{ status: 409 },
);
}

if (msg.includes("pending signature")) {
return NextResponse.json(
{ error: "Deal is not pending signature" },
{ status: 400 },
);
}

if (msg.includes("not the")) {
return NextResponse.json(
{ error: "You are not authorized to sign this contract" },
{ status: 403 },
);
}

logger.error("Contract signing error", error);
return NextResponse.json(
{ error: "Failed to sign contract. Please try again." },
{ status: 500 },
);
}

async function sendSignNotifications(
dealId: string,
deal: DealToSign,
isInfluencer: boolean,
result: SignResult
) {
const counterpartyUserId = isInfluencer ? deal.brand?.userId : deal.influencer.userId;

if (counterpartyUserId) {
const signerName = isInfluencer ? deal.influencer.displayName : deal.brand?.companyName;

let message = `${signerName || "The other party"} has signed the contract for "${deal.campaign.title}". Please sign to proceed.`;
if (result.signed.isFullySigned) {
if (deal.reservedFromWallet) {
message = `Both parties have signed the contract for "${deal.campaign.title}". Payment is secured and work can begin.`;
} else {
message = `Both parties have signed the contract for "${deal.campaign.title}". Please secure payment to activate the deal.`;
}
}

await NotificationService.createNotification({
userId: counterpartyUserId,
type: "deal_update",
title: result.signed.isFullySigned ? "Contract Fully Signed" : "Contract Signed",
message,
data: { link: `/dashboard/deals/${dealId}` },
});
}
}

async function _handler_POST(
request: NextRequest,
{ params }: { params: Promise<Record<string, string | string[]>> },
) {
try {
const resolvedParams = await params;
const parsedParams = paramsSchema.safeParse(resolvedParams);
if (!parsedParams.success) {
return NextResponse.json({ error: "Invalid deal ID" }, { status: 400 });
}

const dealId = parsedParams.data.id;
const session = await auth();

if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const limit = await checkRateLimit(session.user.id, "DEAL_UPDATES");
if (!limit.success) {
return NextResponse.json(
{ error: "Too many deal update requests" },
{ status: 429 },
);
}

const { deal, isInfluencer } = await validateAndGetDealToSign(dealId, session.user.id);
const role: "INFLUENCER" | "BRAND" = isInfluencer ? "INFLUENCER" : "BRAND";

const ipAddress = getSecureClientIp(request);
const userAgent = request.headers.get("user-agent") || "unknown";

let result;
try {
result = await signAndSaveDealContract(
dealId,
session.user.id,
role,
ipAddress,
userAgent,
);
} catch (error: unknown) {
return handleSignContractError(error);
}

await invalidate(`deal:${dealId}`);
await sendSignNotifications(dealId, deal, isInfluencer, result);

logger.info("Contract signed via dedicated route", {
dealId,
userId: session.user.id,
role,
isFullySigned: result.signed.isFullySigned,
});

return NextResponse.json({
success: true,
message: result.message,
isFullySigned: result.signed.isFullySigned,
signedAt: result.signed.signedAt,
});
} catch (error) {
if (error instanceof AppError) {
return NextResponse.json({ error: error.message }, { status: error.statusCode });
}
logger.error("Sign POST route error", error);
return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
}
}

// Wrapped handlers via apiWrapper
export const POST = apiWrapper(_handler_POST);
