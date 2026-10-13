import { NextRequest, NextResponse } from "next/server";
import { DealService } from "@/services/deal.service";
import { verifyWebhookSecret } from "@/lib/shiprocket";
import { AppError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("x-shiprocket-secret") || request.headers.get("authorization");
    if (!verifyWebhookSecret(authHeader)) {
      return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    const result = await DealService.handleShiprocketWebhook(body);
    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Internal webhook processing error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
