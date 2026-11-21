import { NextRequest, NextResponse } from "next/server";
import { apiWrapper, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { requireActiveAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/db";
import { AdminService } from "@/services/admin.service";
import { createActivityLog } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { z } from "zod";

const resolveReportSchema = z.object({
  reportId: z.string().cuid(),
  action: z.enum(["DISMISS", "BAN_USER"]),
  banReason: z.string().trim().max(500).optional(),
});

async function _handler_GET(req: NextRequest) {
  const session = (req as AuthenticatedRequest).session;
  await requireActiveAdmin(session.user);

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 50)));

  const [reports, total] = await Promise.all([
    prisma.userReport.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        reporter: {
          select: {
            id: true,
            email: true,
            userType: true,
            influencerProfile: { select: { displayName: true } },
            brandProfile: { select: { companyName: true } },
          },
        },
        reported: {
          select: {
            id: true,
            email: true,
            userType: true,
            status: true,
            trustScore: true,
            influencerProfile: { select: { displayName: true, avatar: true } },
            brandProfile: { select: { companyName: true, logo: true } },
          },
        },
      },
    }),
    prisma.userReport.count(),
  ]);

  return NextResponse.json({
    success: true,
    total,
    data: reports,
  });
}

async function _handler_POST(req: NextRequest) {
  const session = (req as AuthenticatedRequest).session;
  await requireActiveAdmin(session.user);

  const body = await req.json().catch(() => ({}));
  const parsed = resolveReportSchema.safeParse(body);
  if (!parsed.success) {
    throw AppError.badRequest("Invalid report resolution payload");
  }

  const { reportId, action, banReason } = parsed.data;

  const report = await prisma.userReport.findUnique({
    where: { id: reportId },
    include: { reported: true },
  });

  if (!report) {
    throw AppError.notFound("User report not found");
  }

  if (action === "BAN_USER") {
    await AdminService.updateUserStatus(
      session.user,
      report.reportedId,
      {
        action: "ban",
        reason: banReason || `Account banned following community report: ${report.reason}`,
      },
    );

    await createActivityLog({
      userId: session.user.id,
      action: "USER_REPORT_BANNED_USER",
      entityType: "USER",
      entityId: report.reportedId,
      metadata: {
        reportId,
        reportedUserEmail: report.reported.email,
        reportReason: report.reason,
        adminDecision: "BANNED",
      },
    });
  }

  // Delete/dismiss report from pending queue once resolved
  await prisma.userReport.delete({
    where: { id: reportId },
  });

  return NextResponse.json({
    success: true,
    message: action === "BAN_USER" ? "Report resolved: User banned." : "Report dismissed.",
  });
}

export const GET = apiWrapper(_handler_GET, { requireAdmin: true });
export const POST = apiWrapper(_handler_POST, { requireAdmin: true });
