import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiWrapper } from "@/lib/api-wrapper";
import { DisputeService } from "@/services/dispute.service";
import { disputeSchema, disputeEvidenceSchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import { parsePagination } from "@/lib/utils";

export const GET = apiWrapper(async (req) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dealId = searchParams.get("dealId")?.trim();
  const status = searchParams.get("status")?.trim();
  const { page, limit } = parsePagination(searchParams);

  const result = await DisputeService.listDisputes(session.user.id, {
    ...(dealId ? { dealId } : {}),
    ...(status ? { status } : {}),
    page,
    limit,
  });

  return NextResponse.json({
    disputes: result.disputes,
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / (limit || 1)),
    },
  });
});

export const POST = apiWrapper(async (req) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const action = body.action || "create";

  if (action === "create") {
    // Rate limit: 5 dispute submissions per hour (prevents spam disputes)
    const disputeLimit = await checkRateLimit(session.user.id, "DISPUTES");
    if (!disputeLimit.success) {
      return NextResponse.json(
        {
          error:
            "Too many dispute submissions. Please wait before submitting another dispute.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(
              disputeLimit.reset - Date.now() / 1000,
            ).toString(),
          },
        },
      );
    }
    const parsed = disputeSchema.parse(body);
    const result = await DisputeService.createDispute(session.user.id, parsed);
    return NextResponse.json({ success: true, ...result });
  }

  if (action === "add_evidence") {
    const parsed = disputeEvidenceSchema.parse(body);
    if (!parsed.disputeId) {
      return NextResponse.json(
        { error: "disputeId is required" },
        { status: 400 },
      );
    }
    const result = await DisputeService.addEvidence(session.user.id, {
      disputeId: parsed.disputeId,
      type: parsed.type,
      url: parsed.url,
      ...(parsed.description ? { description: parsed.description } : {}),
    });
    return NextResponse.json({ success: true, ...result });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
});

export const PATCH = apiWrapper(async (req) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { disputeId, action, reason } = body;

  if (!disputeId || !action) {
    return NextResponse.json(
      { error: "disputeId and action are required" },
      { status: 400 },
    );
  }

  // L8 FIX: Validate action against allowed enum values before passing to service layer.
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
});
