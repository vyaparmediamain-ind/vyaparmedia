/**
 * GET  /api/admin/reports/suspicious-reviews
 *      Returns ReviewFlagRecord rows ordered by risk (highest first).
 *      Query params:
 *        status   PENDING | CONFIRMED | DISMISSED  (default: PENDING)
 *        page     1-indexed page number             (default: 1)
 *        limit    rows per page                     (default: 20, max: 100)
 *
 * PATCH /api/admin/reports/suspicious-reviews
 *      Resolve (CONFIRM or DISMISS) a flag.
 *      Body: { flagId: string, status: "CONFIRMED" | "DISMISSED", note?: string }
 */

import { NextRequest } from "next/server";
import { apiWrapper, ApiResponse, AuthenticatedRequest } from "@/lib/api-wrapper";
import prisma from "@/lib/db";
import { z } from "zod";

// --- Query schema -------------------------------------------------------------

const GetQuerySchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "DISMISSED"]).default("PENDING"),
  page:   z.coerce.number().int().positive().default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
});

const PatchBodySchema = z.object({
  flagId: z.string().min(1),
  status: z.enum(["CONFIRMED", "DISMISSED"]),
  note:   z.string().max(1000).optional(),
});

// --- GET handler -------------------------------------------------------------

async function _GET(req: AuthenticatedRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = GetQuerySchema.safeParse({
    status: searchParams.get("status") ?? undefined,
    page:   searchParams.get("page")   ?? undefined,
    limit:  searchParams.get("limit")  ?? undefined,
  });
  if (!parsed.success) {
    return ApiResponse.error("Invalid query parameters", 400);
  }

  const { status, page, limit } = parsed.data;
  const skip = (page - 1) * limit;

  const [flags, total] = await Promise.all([
    prisma.reviewFlagRecord.findMany({
      where:   { status },
      orderBy: [{ riskScore: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
      select: {
        id: true,
        influencerUserId: true,
        brandUserId: true,
        totalDealsInPair: true,
        suspiciousDealCount: true,
        avgDealAmountPaise: true,
        qualifyingThresholdPaise: true,
        flagReason: true,
        riskScore: true,
        status: true,
        resolvedBy: true,
        resolvedAt: true,
        resolutionNote: true,
        createdAt: true,
        updatedAt: true,
        influencerUser: {
          select: {
            id: true,
            email: true,
            trustScore: true,
            influencerProfile: { select: { completedDeals: true } },
          },
        },
        brandUser: {
          select: {
            id: true,
            email: true,
            trustScore: true,
          },
        },
      },
    }),
    prisma.reviewFlagRecord.count({ where: { status } }),
  ]);

  return ApiResponse.success({
    data: flags,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    meta: {
      status,
      description:
        "Suspicious review pairs detected by the DRS collusion detector. " +
        "Flagged when >=3 mutual 5-star deals exist between the same " +
        "influencer-brand pair with deal amounts <= 2x the qualifying threshold.",
    },
  });
}

// --- PATCH handler ------------------------------------------------------------

async function _PATCH(req: AuthenticatedRequest) {
  const adminUserId = req.session.user.id;
  const body = await req.json().catch(() => null);
  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return ApiResponse.error("Invalid request body", 400);
  }

  const { flagId, status, note } = parsed.data;

  const flag = await prisma.reviewFlagRecord.findUnique({ where: { id: flagId } });
  if (!flag) {
    return ApiResponse.error("Flag not found", 404);
  }

  const updated = await prisma.reviewFlagRecord.update({
    where: { id: flagId },
    data: {
      status,
      resolvedBy:     adminUserId,
      resolvedAt:     new Date(),
      resolutionNote: note ?? null,
    },
  });

  return ApiResponse.success({ data: updated });
}

// --- Exports ------------------------------------------------------------------

export const GET = apiWrapper(
  (req: NextRequest) => _GET(req as AuthenticatedRequest),
  { requireAuth: true, requireAdmin: true },
);

export const PATCH = apiWrapper(
  (req: NextRequest) => _PATCH(req as AuthenticatedRequest),
  { requireAuth: true, requireAdmin: true },
);
