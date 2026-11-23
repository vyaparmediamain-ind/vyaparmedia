import { NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { AppError } from "@/lib/errors";
import { assertFeatureEnabled, FEATURE_FLAGS } from "@/lib/feature-flags";
import { FairPriceService } from "@/services/fair-price.service";

export const GET = apiWrapper(
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

    // 2. Read creator profile cached values & latest evaluation
    // STRICT PERFORMANCE REQUIREMENT: Read-only, NEVER triggers a recompute on read
    const pricingData = await FairPriceService.getMyPricing(session.user.id);

    return NextResponse.json({
      success: true,
      data: pricingData,
    });
  },
  {
    requireAuth: true,
    requireInfluencer: true,
    userRateLimit: { bucket: "API_DEFAULT" },
  }
);
