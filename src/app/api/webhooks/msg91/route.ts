/**
 * MSG91 Delivery Report (DLR) Webhook Endpoint
 * Official Docs: https://docs.msg91.com/p/tf9r10/e/y7f8c5/MSG91/Delivery-Report
 *
 * Receives delivery status updates (Delivered, Failed, Undelivered, Rejected)
 * and records them in Redis cache and structured logs.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { logger } from "@/lib/logger";
import redis from "@/lib/redis";

function safeTimingCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Constant-time dummy comparison to prevent length oracle leaks
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  try {
    // In production, strictly require MSG91_WEBHOOK_SECRET (do not fall back to MSG91_AUTH_KEY)
    const isProd = process.env.NODE_ENV === "production";
    const webhookSecret = process.env.MSG91_WEBHOOK_SECRET || (!isProd ? process.env.MSG91_AUTH_KEY : undefined);

    if (isProd && !webhookSecret) {
      logger.error("MSG91 webhook rejected: MSG91_WEBHOOK_SECRET not configured in production");
      return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 500 });
    }

    if (webhookSecret) {
      // Strictly extract authentication secret from headers only (never from query strings)
      const token =
        req.headers.get("x-msg91-secret") ||
        req.headers.get("authkey") ||
        req.headers.get("authorization");
      const cleanToken = token?.startsWith("Bearer ") ? token.slice(7).trim() : token?.trim();

      if (!cleanToken || !safeTimingCompare(cleanToken, webhookSecret)) {
        logger.warn("MSG91 webhook unauthorized attempt", { ip: req.headers.get("x-forwarded-for") });
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    let body: Record<string, unknown> = {};
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData().catch(() => null);
      if (formData) {
        body = Object.fromEntries(formData.entries());
      }
    }

    const requestId =
      body.requestId ||
      body.request_id ||
      body.req_id ||
      req.nextUrl.searchParams.get("requestId");
    const status = body.status || req.nextUrl.searchParams.get("status") || "UNKNOWN";
    const mobile = body.mobile || body.mobiles || req.nextUrl.searchParams.get("mobile");
    const desc = body.desc || body.description || req.nextUrl.searchParams.get("desc");

    if (requestId && typeof requestId === "string") {
      await redis.setex(`sms:dlr:${requestId}`, 86400, String(status));
      const mobileStr = mobile ? String(mobile) : "";
      const maskedMobile = mobileStr.length >= 4 ? `*`.repeat(mobileStr.length - 4) + mobileStr.slice(-4) : undefined;
      logger.info("MSG91 DLR delivery report processed", {
        requestId,
        status,
        mobile: maskedMobile,
        desc,
      });
    }

    return NextResponse.json({ success: true, status: "recorded" });
  } catch (error) {
    logger.error("Error processing MSG91 DLR webhook", error);
    return NextResponse.json({ success: false, error: "Internal Error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
