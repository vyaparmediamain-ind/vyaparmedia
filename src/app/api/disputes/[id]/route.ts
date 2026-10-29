import { NextResponse } from "next/server";
import { apiWrapper, ValidatedNextRequest } from "@/lib/api-wrapper";
import { DisputeService } from "@/services/dispute.service";
import { AdminService } from "@/services/admin.service";
import { analyzeDispute } from "@/lib/dispute-mediator";
import { logger } from "@/lib/logger";

export const GET = apiWrapper(async (_req: ValidatedNextRequest, { params }) => {
const session = _req.session;
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const { id } = await params;
const disputeId = Array.isArray(id) ? id[0]! : id;

let isAdmin = false;

// Check if user is admin to allow unrestricted access
try {
if (session.user.email) {
await AdminService.checkAdminAccess(session.user);
isAdmin = true;
}
} catch {
// Not admin
}

if (!disputeId) {
return NextResponse.json({ error: "Invalid dispute ID" }, { status: 400 });
}

const dispute = await DisputeService.getDisputeDetails(
session.user.id,
disputeId,
isAdmin,
);

let analysis = null;
if (dispute.status === "TIER1_AUTO" || dispute.status === "OPEN") {
try {
analysis = await analyzeDispute(dispute.id);
} catch (err) {
logger.warn("Dispute auto-analysis failed to compute", { disputeId: dispute.id, error: err });
}
}

return NextResponse.json({ dispute, analysis });
}, { requireAuth: true });

export const PATCH = apiWrapper(async (req: ValidatedNextRequest, { params }) => {
  const session = req.session;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const disputeId = Array.isArray(id) ? id[0]! : id;

  if (!disputeId) {
    return NextResponse.json({ error: "Invalid dispute ID" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const reason = body.reason;

  if (!action) {
    return NextResponse.json({ error: "Action is required" }, { status: 400 });
  }

  const ALLOWED_DISPUTE_ACTIONS = ["accept", "reject", "withdraw", "escalate"] as const;
  type AllowedDisputeAction = typeof ALLOWED_DISPUTE_ACTIONS[number];
  if (!ALLOWED_DISPUTE_ACTIONS.includes(action as AllowedDisputeAction)) {
    return NextResponse.json(
      { error: `Invalid action. Allowed values: ${ALLOWED_DISPUTE_ACTIONS.join(", ")}` },
      { status: 400 },
    );
  }

  const actionMap: Record<string, string> = {
    accept: "accept_resolution",
    reject: "reject_resolution",
    withdraw: "withdraw",
    escalate: "escalate",
  };
  const mappedAction = actionMap[action] || action;

  const result = await DisputeService.handleAction(session.user.id, {
    disputeId,
    action: mappedAction as "accept" | "accept_resolution" | "reject" | "reject_resolution" | "withdraw" | "escalate",
    reason,
  });

  return NextResponse.json(result);
}, { requireAuth: true });
