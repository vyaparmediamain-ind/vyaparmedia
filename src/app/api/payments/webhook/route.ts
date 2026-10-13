import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import crypto from "node:crypto";
import { apiWrapper } from "@/lib/api-wrapper";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { isWebhookProcessed } from "@/lib/idempotency";
import { publishWebhookJob } from "@/lib/qstash";
import { processWebhookEventInternal } from "@/app/api/webhooks/razorpay/process/route";
import { logger } from "@/lib/logger";
import { recordWebhookAnomaly } from "@/lib/observability";

// Next.js config to allow raw body for Razorpay crypto verification
export const dynamic = "force-dynamic";

/**
 * Fast Webhook Ingestion Route
 * 
 * Target: <500ms response time
 * 1. Verifies HMAC-SHA256 signature with crypto.timingSafeEqual.
 * 2. Checks DB-level idempotency via ProcessedWebhookEvent.
 * 3. Enqueues heavy processing to QStash with deduplicationId (payment ID based).
 * 4. Acknowledges receipt immediately with HTTP 200 to Razorpay.
 */
async function _handler_POST(request: NextRequest) {
  const startTime = Date.now();
  const rawBody = await request.text();
  const headerList = await headers();
  const signature = headerList.get("x-razorpay-signature");

  if (!signature) {
    return NextResponse.json({ success: false, message: "Missing signature" }, { status: 400 });
  }

  // 1. Cryptographic HMAC-SHA256 signature verification with timingSafeEqual
  const isSignatureValid = verifyWebhookSignature(rawBody, signature);
  if (!isSignatureValid) {
    logger.warn("Webhook rejected: invalid HMAC-SHA256 signature");
    recordWebhookAnomaly("SIGNATURE_MISMATCH", {
      headerEventId: headerList.get("x-razorpay-event-id") || undefined,
      bodyLength: rawBody.length,
    });
    return NextResponse.json({ success: false, message: "Invalid signature" }, { status: 400 });
  }

  // 2. Parse JSON payload
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: "Malformed JSON" }, { status: 400 });
  }

  const eventType = typeof payload?.event === "string" ? payload.event : "unknown";
  const payloadData = payload?.payload as Record<string, { entity?: { id?: string } }> | undefined;
  const rawEntityId =
    payloadData?.payment?.entity?.id ||
    payloadData?.order?.entity?.id ||
    payloadData?.payout?.entity?.id ||
    "";

  const headerEventId = headerList.get("x-razorpay-event-id");
  const eventId =
    headerEventId ||
    (rawEntityId
      ? `${eventType}:${rawEntityId}`
      : crypto.createHash("sha256").update(`${eventType}:${rawBody}`).digest("hex"));

  // 3. Idempotency check: incoming event ID in DB unique-constraint table
  const alreadyProcessed = await isWebhookProcessed(eventId);
  if (alreadyProcessed) {
    logger.info("Duplicate webhook event received, returning 200 OK without reprocessing", {
      eventId,
      eventType,
    });
    return NextResponse.json(
      { success: true, message: "Duplicate webhook ignored (already processed)" },
      { status: 200 },
    );
  }

  // 4. Offload heavy processing to QStash queue with deduplicationId
  const { enqueued } = await publishWebhookJob(
    {
      rawBody,
      eventId,
      eventType,
      payload,
    },
    processWebhookEventInternal,
  );

  const durationMs = Date.now() - startTime;
  logger.info("Webhook acknowledged and enqueued", {
    eventId,
    eventType,
    enqueued,
    durationMs,
  });

  // 5. Fast 200 OK return (<500ms)
  return NextResponse.json(
    {
      success: true,
      message: "Webhook acknowledged and queued for processing",
      eventId,
      enqueued,
      durationMs,
    },
    { status: 200 },
  );
}

export const POST = apiWrapper(_handler_POST, { skipCsrf: true });
