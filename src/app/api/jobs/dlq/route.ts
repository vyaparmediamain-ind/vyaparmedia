import { NextRequest, NextResponse } from "next/server";
import { secureQStashEndpoint } from "@/lib/qstash-guard";
import { recordDeadLetterJob } from "@/lib/qstash";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * QStash Dead-Letter Queue (DLQ) Callback Endpoint
 * 
 * Called automatically by QStash when a background job has exhausted all configured retries.
 * Protected by `secureQStashEndpoint` so only QStash (with a valid signature) can trigger it.
 */
async function _handler_POST(request: NextRequest) {
  try {
    const rawBody = await request.json();

    const jobId = request.headers.get("upstash-message-id") || rawBody.jobId;
    const failureReason =
      request.headers.get("upstash-failure-reason") ||
      rawBody.errorMessage ||
      "Job exhausted all QStash retries";

    logger.critical("QSTASH_DLQ_ENDPOINT_TRIGGERED: Capturing permanently failed job", {
      jobId,
      failureReason,
      body: rawBody,
    });

    const category = rawBody.category || "time-critical";
    const topic = rawBody.topic || "unknown_failure";
    const endpoint = rawBody.endpoint || "/api/jobs/consumer";
    const deduplicationId = rawBody.deduplicationId;

    const record = await recordDeadLetterJob({
      jobId,
      endpoint,
      category,
      topic,
      deduplicationId,
      payload: rawBody,
      errorMessage: failureReason,
      attempts: rawBody.attempts || 3,
      maxRetries: rawBody.maxRetries || 5,
    });

    return NextResponse.json({
      success: true,
      message: "Dead letter job recorded successfully",
      dlqId: record?.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Error processing DLQ callback", { error: message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export const POST = secureQStashEndpoint(_handler_POST);
