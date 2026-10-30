import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { logger } from "@/lib/logger";
import { processSecureWebhook } from "@/lib/razorpay";
import { publishWebhookJob, WebhookJobPayload } from "@/lib/qstash";
import { processWebhookEventInternal } from "@/lib/razorpay-webhook-processor";

export const dynamic = "force-dynamic";

/**
 * Public Razorpay Webhook Ingress Endpoint
 *
 * 1. Receives raw webhooks directly from Razorpay.
 * 2. Authenticates HMAC-SHA256 signature against RAZORPAY_WEBHOOK_SECRET.
 * 3. Enforces idempotency to drop redundant retries immediately with 200 OK.
 * 4. Dispatches the job to QStash background queue (or direct processing fallback in local/dev).
 */
export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-razorpay-signature");
    if (!signature) {
      logger.warn("Razorpay ingress webhook rejected: Missing x-razorpay-signature header", {
        ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      });
      return NextResponse.json({ success: false, error: "Missing signature" }, { status: 401 });
    }

    const rawBody = await request.text();
    if (!rawBody) {
      return NextResponse.json({ success: false, error: "Empty request body" }, { status: 400 });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      logger.warn("Razorpay ingress webhook rejected: Invalid JSON payload");
      return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
    }

    const eventType = (payload.event as string) || "unknown";
    const explicitEventId =
      (payload.event_id as string) ||
      (payload.id as string) ||
      request.headers.get("x-razorpay-event-id") ||
      "";

    // Stable eventKey calculation (fallback to deterministic hash of event and raw payload)
    const eventId =
      explicitEventId.trim() ||
      crypto.createHash("sha256").update(`${eventType}:${rawBody}`).digest("hex");

    // Cryptographic signature and replay verification
    const { isValid, isDuplicate, eventKey } = await processSecureWebhook(
      rawBody,
      signature,
      eventId,
      eventType,
    );

    if (!isValid) {
      logger.warn("Razorpay ingress webhook rejected: Invalid signature", {
        eventType,
        eventId,
      });
      return NextResponse.json({ success: false, error: "Invalid webhook signature" }, { status: 401 });
    }

    if (isDuplicate) {
      logger.info("Razorpay duplicate webhook event ignored at ingress", {
        eventKey,
        eventType,
      });
      return NextResponse.json({ success: true, message: "Duplicate webhook acknowledged" }, { status: 200 });
    }

    const jobPayload: WebhookJobPayload = {
      eventId: eventKey,
      eventType,
      payload,
    };

    // Offload heavy processing to QStash queue with graceful fallback to in-process execution
    const publishResult = await publishWebhookJob(jobPayload, processWebhookEventInternal);

    logger.info("Razorpay webhook ingested successfully", {
      eventKey,
      eventType,
      enqueued: publishResult.enqueued,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Webhook accepted",
        enqueued: publishResult.enqueued,
        eventId: eventKey,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("Unexpected error in Razorpay webhook ingress endpoint", { error: errorMsg });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

