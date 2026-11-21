import { NextResponse } from "next/server";
import { apiWrapper, ValidatedNextRequest } from "@/lib/api-wrapper";
import {
  getAllKillSwitches,
  setKillSwitch,
  KILL_SWITCH_FEATURES,
  type KillSwitchFeature,
} from "@/lib/kill-switch";
import { createActivityLog } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";
import { z } from "zod";

const toggleKillSwitchSchema = z.object({
  feature: z.string().refine(
    (val): val is KillSwitchFeature =>
      Object.values(KILL_SWITCH_FEATURES).includes(val as KillSwitchFeature),
    { message: "Invalid kill switch feature key" },
  ),
  active: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

async function _handler_GET() {
  const switches = await getAllKillSwitches();
  return NextResponse.json({
    success: true,
    data: switches,
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

  const parsed = toggleKillSwitchSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    throw AppError.badRequest(errorMsg || "Invalid payload");
  }

  const { feature, active, reason } = parsed.data;

  await setKillSwitch(feature, active);

  await createActivityLog({
    userId: adminUserId,
    action: "KILL_SWITCH_TOGGLED",
    entityType: "SYSTEM",
    entityId: feature,
    metadata: {
      adminEmail,
      feature,
      active,
      reason: reason || "Manual operational toggle by administrator",
      timestamp: new Date().toISOString(),
    },
  }).catch((err) => {
    logger.warn("[KillSwitchAPI] Failed to record audit log for kill switch toggle", {
      feature,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  logger.warn(
    `[KillSwitchAPI] Operational Kill Switch '${feature}' turned ${active ? "ACTIVE (PAUSED)" : "INACTIVE (RESUMED)"} by admin ${adminEmail}`,
  );

  return NextResponse.json({
    success: true,
    feature,
    active,
    message: `Circuit breaker '${feature}' is now ${active ? "ENGAGED (Traffic paused)" : "DISENGAGED (Operational)"}.`,
  });
}

export const GET = apiWrapper(_handler_GET, { requireAdmin: true });
export const POST = apiWrapper(_handler_POST, { requireAdmin: true });
