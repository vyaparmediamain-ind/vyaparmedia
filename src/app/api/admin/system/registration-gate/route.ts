import { NextResponse } from "next/server";
import { apiWrapper, ValidatedNextRequest } from "@/lib/api-wrapper";
import { getRegistrationGateConfig, setRegistrationGateConfig } from "@/lib/registration-gate";
import { AppError } from "@/lib/errors";
import { z } from "zod";

const updateGateSchema = z.object({
  requireReferral: z.boolean(),
  masterInviteCode: z.string().trim().min(3).max(30).optional(),
  reason: z.string().trim().max(500).optional(),
});

async function _handler_GET() {
  const config = await getRegistrationGateConfig();
  return NextResponse.json({
    success: true,
    data: config,
  });
}

async function _handler_POST(request: ValidatedNextRequest) {
  const session = request.session;
  const adminUserId = session?.user?.id;
  const adminEmail = session?.user?.email;

  if (!adminUserId) {
    throw AppError.unauthorized("Authentication required");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw AppError.badRequest("Invalid JSON body");
  }

  const parsed = updateGateSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    throw AppError.badRequest(errorMsg || "Invalid payload");
  }

  const updated = await setRegistrationGateConfig({
    requireReferral: parsed.data.requireReferral,
    masterInviteCode: parsed.data.masterInviteCode,
    adminUserId,
    adminEmail,
    reason: parsed.data.reason,
  });

  return NextResponse.json({
    success: true,
    data: updated,
    message: updated.requireReferral
      ? "Invite-Only Beta mode enabled. Registration now requires a referral code."
      : "Open Registration mode restored. Referral codes are now optional.",
  });
}

export const GET = apiWrapper(_handler_GET, { requireAuth: true, requireAdmin: true });
export const POST = apiWrapper(_handler_POST, { requireAuth: true, requireAdmin: true });
