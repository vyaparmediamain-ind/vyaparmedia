import { apiWrapper, ValidatedNextRequest } from "@/lib/api-wrapper";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { PaymentService } from "@/services/payment.service";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { routeParamsSchema } from "@/lib/validations";
import {
  claimIdempotencyKey,
  releaseIdempotencyKey,
  saveIdempotencyResponse,
} from "@/lib/idempotency";
import { checkDealEscrowFundingEligibility } from "@/lib/action-eligibility";
import { formatUserError } from "@/lib/user-messages";

const paramsSchema = routeParamsSchema;

async function _handler_POST(
  request: ValidatedNextRequest,
  { params }: { params: Promise<Record<string, string | string[]>> },
) {
  const session = request.session;
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const resolvedParams = await params;
  const parsedParams = paramsSchema.safeParse(resolvedParams);
  if (!parsedParams.success) {
    return NextResponse.json({ success: false, message: "Invalid deal ID" }, { status: 400 });
  }
  const dealId = parsedParams.data.id;

  const idempotencyHeader = request.headers.get("Idempotency-Key")?.trim();
  const idempotencyKey = idempotencyHeader && /^[A-Za-z0-9:_-]{16,128}$/.test(idempotencyHeader)
    ? `fund_deal:${session.user.id}:${dealId}:${idempotencyHeader}`
    : `fund_deal:${session.user.id}:${dealId}:default`;

  const claim = await claimIdempotencyKey(idempotencyKey, session.user.id);
  if (claim.isDuplicate) {
    if (claim.savedResponse) {
      const saved = claim.savedResponse as { status?: number | string; body?: unknown };
      if (saved.status === "PROCESSING") {
        return NextResponse.json(
          { success: false, message: "A request with this idempotency key is already processing. Please wait." },
          { status: 409 },
        );
      }
      return NextResponse.json(saved.body ?? saved, {
        status: typeof saved.status === "number" ? saved.status : 200,
      });
    }
    return NextResponse.json({ success: false, message: "Duplicate request detected." }, { status: 409 });
  }

  try {
    const limit = await checkRateLimit(session.user.id, "PAYMENTS");
    if (!limit.success) {
      await releaseIdempotencyKey(idempotencyKey, session.user.id);
      return NextResponse.json(
        { success: false, message: "Too many payment requests" },
        { status: 429 },
      );
    }

    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        brand: true,
        paymentHold: true,
        influencer: {
          include: {
            user: {
              include: {
                bankAccounts: {
                  where: { isVerified: true, deletedAt: null },
                },
              },
            },
          },
        },
      },
    });

    if (!deal) {
      await releaseIdempotencyKey(idempotencyKey, session.user.id);
      return NextResponse.json({ success: false, message: "Deal not found" }, { status: 404 });
    }

    const creatorHasVerifiedBank = Boolean(
      deal.influencer?.user?.bankAccounts && deal.influencer.user.bankAccounts.length > 0
    );

    const eligibility = checkDealEscrowFundingEligibility(
      {
        ...deal,
        creatorHasVerifiedBank,
      },
      session.user.id,
      session.user.status,
    );

    if (!eligibility.allowed) {
      await releaseIdempotencyKey(idempotencyKey, session.user.id);
      return NextResponse.json(
        {
          success: false,
          message: eligibility.reason || "Deal is not eligible for escrow funding",
          reasonCode: eligibility.reasonCode,
        },
        { status: eligibility.reasonCode === "UNAUTHORIZED" ? 403 : 400 },
      );
    }

    const orderData = await PaymentService.createDealRouteEscrowOrder({
      dealId,
      brandUserId: session.user.id,
      idempotencyKey,
    });

    const responseBody = {
      success: true,
      message: "Deal Route Escrow order initialized",
      orderId: orderData.orderId,
      amount: orderData.amount,
      currency: orderData.currency,
      key: orderData.key,
      creatorAccountId: orderData.creatorAccountId,
    };

    await saveIdempotencyResponse(
      idempotencyKey,
      { status: 200, body: responseBody },
      session.user.id,
    );

    return NextResponse.json(responseBody, { status: 200 });
  } catch (error: unknown) {
    await releaseIdempotencyKey(idempotencyKey, session.user.id);
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error("POST /api/deals/[id]/fund error", { error: errMsg, dealId, userId: session.user.id });

    const safeMessage = formatUserError(errMsg, "Failed to initialize escrow payment.");
    return NextResponse.json(
      { success: false, message: safeMessage },
      { status: 400 },
    );
  }
}

export const POST = apiWrapper(_handler_POST, { requireAuth: true });
