import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { PaymentService } from "@/services/payment.service";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  claimIdempotencyKey,
  releaseIdempotencyKey,
  saveIdempotencyResponse,
} from "@/lib/idempotency";
import { assertKillSwitchInactive } from "@/lib/kill-switch";

const addFundsSchema = z
  .object({
    amount: z.preprocess(
      Number,
      z
        .number()
        .int()
        .min(10000, "Minimum top-up is INR 100")
        .max(50000000, "Maximum top-up per request is INR 5,00,000"),
    ).optional(),
    amountPaise: z.preprocess(
      Number,
      z
        .number()
        .int()
        .min(10000, "Minimum top-up is INR 100")
        .max(50000000, "Maximum top-up per request is INR 5,00,000"),
    ).optional(),
  })
  .refine((data) => data.amount !== undefined || data.amountPaise !== undefined, {
    message: "Amount in paise must be provided",
  });

async function _handler_POST(request: NextRequest) {
  await assertKillSwitchInactive("killswitch:add_funds");
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const idempotencyHeader = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyHeader || !/^[A-Za-z0-9:_-]{16,128}$/.test(idempotencyHeader)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid or missing Idempotency-Key header. Must be 16-128 alphanumeric characters (including ':' '_' '-').",
      },
      { status: 400 },
    );
  }

  const idempotencyKey = `topup:${session.user.id}:${idempotencyHeader}`;
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

    const body = await request.json();
    const parsed = addFundsSchema.safeParse(body);

    if (!parsed.success) {
      await releaseIdempotencyKey(idempotencyKey, session.user.id);
      return NextResponse.json(
        {
          success: false,
          message: "Invalid payload",
          data: parsed.error.format(),
        },
        { status: 400 },
      );
    }

    const amountInPaise = (parsed.data.amountPaise ?? parsed.data.amount)!;
    const orderData = await PaymentService.createWalletTopUpOrder(
      session.user.id,
      amountInPaise,
      idempotencyHeader,
    );

    const responseBody = {
      success: true,
      message: "Payment intent created",
      orderId: orderData.orderId,
      amount: orderData.amount,
      currency: orderData.currency,
      key: orderData.key,
    };

    await saveIdempotencyResponse(idempotencyKey, { status: 200, body: responseBody }, session.user.id);

    return NextResponse.json(responseBody, { status: 200 });
  } catch (error: unknown) {
    await releaseIdempotencyKey(idempotencyKey, session.user.id);
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error("POST /api/wallet/add-funds error", { error: errMsg, userId: session.user.id });

    if (errMsg.includes("WALLET_FROZEN") || errMsg.includes("frozen")) {
      return NextResponse.json(
        { success: false, message: "Your wallet is currently frozen or locked." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { success: false, message: errMsg.includes("Top-up amount exceeds") ? errMsg : "Failed to initiate payment." },
      { status: 400 },
    );
  }
}

// Wrapped handlers via apiWrapper
export const POST = apiWrapper(_handler_POST);
