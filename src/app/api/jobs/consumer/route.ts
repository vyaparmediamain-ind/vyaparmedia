import { NextRequest, NextResponse } from "next/server";
import { secureQStashEndpoint } from "@/lib/qstash-guard";
import { logger } from "@/lib/logger";
import {
  claimIdempotencyKey,
  saveIdempotencyResponse,
  releaseIdempotencyKey,
} from "@/lib/idempotency";
import { executeJobTopicHandler, getTopicDefinition } from "@/lib/job-topics";

export const dynamic = "force-dynamic";

/**
 * General QStash Background Job Consumer Endpoint
 * 
 * Protected by `secureQStashEndpoint`.
 * Dispatches tasks through the typed JOB_TOPICS_REGISTRY.
 */
async function _handler_POST(request: NextRequest) {
  const body = (await request.json()) as {
    topic: string;
    category?: string;
    deduplicationId?: string;
    payload?: Record<string, unknown>;
    [key: string]: unknown;
  };

  const topic = body.topic;
  if (!topic) {
    logger.error("QStash consumer received job missing topic", { body });
    return NextResponse.json({ error: "Missing topic" }, { status: 400 });
  }

  const def = getTopicDefinition(topic);
  if (!def) {
    logger.critical("QStash consumer received unregistered job topic", { topic });
    return NextResponse.json({ error: `Unknown job topic: ${topic}` }, { status: 400 });
  }

  // Deduplication handling
  const payloadToProcess = body.payload && typeof body.payload === "object" ? body.payload : body;
  const dedupKey = body.deduplicationId
    ? `job:dedup:${body.deduplicationId}`
    : def.idempotencyKeyFn
    ? def.idempotencyKeyFn(payloadToProcess)
    : null;

  if (dedupKey) {
    const claim = await claimIdempotencyKey(dedupKey);
    if (claim.isDuplicate) {
      logger.info("QStash consumer skipping duplicate job execution", {
        dedupKey,
        topic,
      });
      return NextResponse.json({
        success: true,
        message: "Duplicate job skipped",
        savedResponse: claim.savedResponse,
      });
    }
  }

  try {
    const result = await executeJobTopicHandler(topic, payloadToProcess);

    if (dedupKey) {
      await saveIdempotencyResponse(dedupKey, {
        success: true,
        topic,
        completedAt: new Date().toISOString(),
        result: (result.result as any) ?? null,
      });
    }

    return NextResponse.json({
      processed: topic,
      ...result,
    });
  } catch (err) {
    if (dedupKey) {
      await releaseIdempotencyKey(dedupKey);
    }
    logger.error("Failed to execute job in consumer", { topic, error: err });
    throw err;
  }
}

export const POST = secureQStashEndpoint(_handler_POST);
