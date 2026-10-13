import { NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { auth } from "@/lib/auth";
import { AdminService } from "@/services/admin.service";
import { AppError } from "@/lib/errors";

export const GET = apiWrapper(async () => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw AppError.unauthorized("Authentication required");
  }

  const status = await AdminService.getInfluencerAppealStatus(userId);
  if (!status) {
    throw AppError.notFound("Creator profile not found");
  }

  return NextResponse.json({
    success: true,
    data: status,
  });
});

export const POST = apiWrapper(async (req) => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw AppError.unauthorized("Authentication required");
  }

  const body = await req.json().catch(() => ({}));
  const { reason, evidenceUrl } = body;

  if (!reason || typeof reason !== "string" || reason.trim().length < 15) {
    throw AppError.badRequest("Please provide an appeal explanation of at least 15 characters.");
  }

  const result = await AdminService.submitInfluencerFraudAppeal(userId, {
    reason: reason.trim(),
    evidenceUrl: typeof evidenceUrl === "string" ? evidenceUrl.trim() : undefined,
  });

  return NextResponse.json({
    success: true,
    message: result.message,
  });
});
