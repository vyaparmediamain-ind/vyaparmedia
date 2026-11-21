import { NextResponse } from "next/server";
import { apiWrapper } from "@/lib/api-wrapper";
import { getRegistrationGateConfig } from "@/lib/registration-gate";

export const GET = apiWrapper(
  async () => {
    const config = await getRegistrationGateConfig();
    return NextResponse.json({
      success: true,
      requireReferral: config.requireReferral,
      inviteOnly: config.requireReferral,
    });
  },
  { requireAuth: false }
);
