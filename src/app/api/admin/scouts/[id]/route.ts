import { NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { ScoutService } from "@/services/scout.service";
import prisma from "@/lib/db";
import { z } from "zod";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("APPROVE"),
  }),
  z.object({
    action: z.literal("REJECT"),
    reason: z.string().min(3, "Rejection reason required").max(500),
  }),
  z.object({
    action: z.literal("TOGGLE_PAUSE"),
    pause: z.boolean(),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("GRANT_EXEMPTION"),
    days: z.number().int().min(1).max(365),
  }),
  z.object({
    action: z.literal("UPDATE_ROYALTY_PERCENT"),
    royaltyPercent: z.number().min(0.1).max(5.0),
  }),
]);

export const GET = apiWrapper(async (req) => {
  const session = req.session;
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.pathname.split("/").pop();
  if (!id) return NextResponse.json({ success: false, message: "Missing ID" }, { status: 400 });

  const scout = await prisma.scoutProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          createdAt: true,
          wallet: { select: { balance: true, totalEarned: true } },
          referredUsers: {
            select: {
              id: true,
              email: true,
              userType: true,
              createdAt: true,
              influencerProfile: { select: { displayName: true, completedDeals: true, totalEarnings: true } },
              brandProfile: { select: { companyName: true, totalCampaigns: true, totalSpent: true } },
            },
          },
        },
      },
    },
  });

  if (!scout) {
    return NextResponse.json({ success: false, message: "Scout not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: scout });
}, { requireAuth: true, requireAdmin: true });

export const PATCH = apiWrapper(async (req) => {
  const session = req.session;
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.pathname.split("/").pop();
  if (!id) return NextResponse.json({ success: false, message: "Missing ID" }, { status: 400 });

  const body = await req.json();
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid payload", errors: parsed.error.format() }, { status: 400 });
  }

  const adminUserId = session.user.id;
  let updated;

  switch (parsed.data.action) {
    case "APPROVE":
      updated = await ScoutService.adminApproveScout(id, adminUserId);
      break;
    case "REJECT":
      updated = await ScoutService.adminRejectScout(id, parsed.data.reason, adminUserId);
      break;
    case "TOGGLE_PAUSE":
      updated = await ScoutService.adminToggleRoyaltyPause(id, parsed.data.pause, parsed.data.reason, adminUserId);
      break;
    case "GRANT_EXEMPTION":
      updated = await ScoutService.adminGrantQuotaExemption(id, parsed.data.days, adminUserId);
      break;
    case "UPDATE_ROYALTY_PERCENT":
      updated = await ScoutService.adminUpdateRoyaltyPercent(id, parsed.data.royaltyPercent, adminUserId);
      break;
  }

  return NextResponse.json({
    success: true,
    message: `Scout action ${parsed.data.action} processed successfully`,
    data: updated,
  });
}, { requireAuth: true, requireAdmin: true });
