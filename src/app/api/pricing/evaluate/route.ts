import { NextResponse } from "next/server";
import { z } from "zod";
import { apiWrapper } from "@/lib/api-wrapper";
import { AppError } from "@/lib/errors";
import { assertFeatureEnabled, FEATURE_FLAGS } from "@/lib/feature-flags";
import { FairPriceService } from "@/services/fair-price.service";

const evaluatePricingSchema = z
  .object({
    influencerId: z.string().min(1, "influencerId is required"),
    platform: z.enum(["INSTAGRAM", "YOUTUBE"]).optional(),
    contentType: z.enum(["REEL", "POST", "STORY", "VIDEO", "SHORT"]).optional(),
    deliverables: z
      .object({
        count: z.number().int().min(1).max(20).default(1),
        stories: z.number().int().min(0).max(50).optional(),
        usageRightsDays: z.number().int().min(0).max(365).optional(),
        exclusivityMonths: z.number().int().min(0).max(24).optional(),
        rawFootage: z.boolean().optional(),
      })
      .strict()
      .optional(),
    quotedRatePaise: z.number().int().min(0).optional(),
    forceRecompute: z.boolean().optional(),
  })
  .strict();

export const POST = apiWrapper(
  async (req) => {
    const session = req.session;
    if (!session?.user?.id) {
      throw AppError.unauthorized();
    }

    // 1. Feature Flag Guard (fair_price)
    await assertFeatureEnabled(
      FEATURE_FLAGS.FAIR_PRICE,
      { userId: session.user.id, role: session.user.userType },
      "Fair price evaluation is currently disabled."
    );

    const body = (req.validBody ?? (await req.json())) as z.infer<typeof evaluatePricingSchema>;

    // 2. Object-Level Relationship & Authorization Guard (IDOR Defense: 404 on violation)
    await FairPriceService.verifyRelationshipOrOwnership(
      { id: session.user.id, userType: session.user.userType },
      body.influencerId
    );

    // 3. Per-Brand Scraping Quota Check
    if (session.user.userType === "BRAND") {
      await FairPriceService.checkBrandDailyEvaluationQuota(session.user.id);
    }

    // 4. Force recompute allowed for Admin only
    const allowForceRecompute = session.user.userType === "ADMIN" ? Boolean(body.forceRecompute) : false;

    // 5. Execute Evaluation
    const result = await FairPriceService.evaluateInfluencer(body.influencerId, {
      ...(body.platform ? { platform: body.platform } : {}),
      ...(body.contentType ? { contentType: body.contentType } : {}),
      ...(body.deliverables ? { deliverables: body.deliverables } : {}),
      ...(body.quotedRatePaise !== undefined ? { quotedRatePaise: body.quotedRatePaise } : {}),
      forceRecompute: allowForceRecompute,
      requestedByUserId: session.user.id,
    });

    // 6. Return response exposing explanation without internal formula constants
    return NextResponse.json({
      success: true,
      data: {
        influencerId: body.influencerId,
        basePaise: result.evaluation.basePaise,
        minPaise: result.evaluation.minPaise,
        maxPaise: result.evaluation.maxPaise,
        expectedViews: result.evaluation.expectedViews,
        viewStatistic: result.evaluation.viewStatistic,
        confidence: result.evaluation.confidence,
        dataQuality: result.evaluation.dataQuality,
        flags: result.evaluation.flags,
        explanation: result.evaluation.explanation,
        engineVersion: result.evaluation.engineVersion,
        inputsHash: result.inputsHash,
        cached: result.cached,
        comparison: result.comparison,
      },
    });
  },
  {
    requireAuth: true,
    userRateLimit: { bucket: "PRICING" },
    maxBodySize: 32 * 1024, // 32KB
    validate: { body: evaluatePricingSchema },
  }
);
