import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { WebhookJobPayload } from "@/lib/qstash";
import { verifySignatureAppRouter } from "@/lib/qstash-guard";
import { processWebhookEventInternal } from "@/lib/razorpay-webhook-processor";

/**
 * Heavy Webhook Background Processor Endpoint
 * Core business invariants handled by "@/lib/razorpay-webhook-processor":
 * - event.startsWith("refund.") || event.startsWith("dispute.") || event.startsWith("payment.dispute.")
 * - status: "FAILED"
 * - type: "CHARGEBACK"
 * - tx.debtClaim.create
 */

export const dynamic = "force-dynamic";

async function _handler_POST(request: NextRequest) {
  try {
    const job = (await request.json()) as WebhookJobPayload;
    if (!job?.eventId || !job?.eventType) {
      return NextResponse.json({ success: false, message: "Invalid job payload" }, { status: 400 });
    }

    const result = await processWebhookEventInternal(job);
    if (!result.success && result.message.includes("locked by another worker")) {
      return NextResponse.json(result, { status: 429 });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    logger.error("Error in webhook background processor", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, message: "Internal error processing webhook" }, { status: 500 });
  }
}

// Wrap handler with secure QStash signature verification (rejects unauthenticated requests with 401)
export const POST = verifySignatureAppRouter(_handler_POST);
