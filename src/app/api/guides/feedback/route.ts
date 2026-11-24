import { NextRequest } from "next/server";
import { z } from "zod";
import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import redis from "@/lib/redis";
import { logger } from "@/lib/logger";

const GuideFeedbackSchema = z
  .object({
    guideId: z.string().min(1).max(128).regex(/^[a-z0-9-]+$/),
    choice: z.enum(["helpful", "not_helpful"]),
  })
  .strict();

async function _handler(req: NextRequest) {
  const body = await req.json();

  try {
    const redisKey = `guide_feedback:${body.guideId}:${body.choice}`;
    await redis.incr(redisKey);
  } catch (err) {
    logger.warn("Failed to increment guide feedback counter in Redis", {
      guideId: body.guideId,
      choice: body.choice,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return ApiResponse.success({ recorded: true }, "Feedback recorded");
}

export const POST = apiWrapper(_handler, {
  requireAuth: false,
  rateLimit: RATE_LIMIT_CONFIGS.API_DEFAULT,
  maxBodySize: 4096,
  validate: {
    body: GuideFeedbackSchema,
  },
});
