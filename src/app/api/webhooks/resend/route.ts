/**
 * Resend Bounce and Complaint Webhook Handler
 * Docs: https://resend.com/docs/dashboard/webhooks/event-types
 *
 * Verifies Svix signatures (if RESEND_WEBHOOK_SECRET is configured)
 * and records bounced or complained email addresses into the Redis suppression list.
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { createHmac, timingSafeEqual } from "node:crypto";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    // Verify svix signature if secret configured
    if (webhookSecret) {
      const svixId = req.headers.get("svix-id");
      const svixTimestamp = req.headers.get("svix-timestamp");
      const svixSignature = req.headers.get("svix-signature");

      if (!svixId || !svixTimestamp || !svixSignature) {
        logger.warn("Resend webhook rejected: missing svix signature headers");
        return NextResponse.json({ error: "Missing signature headers" }, { status: 401 });
      }

      // Check timestamp freshness (5 minutes)
      const now = Math.floor(Date.now() / 1000);
      const ts = Number.parseInt(svixTimestamp, 10);
      if (Math.abs(now - ts) > 300) {
        logger.warn("Resend webhook rejected: expired timestamp");
        return NextResponse.json({ error: "Timestamp expired" }, { status: 401 });
      }

      // Compute expected signature (svix uses HMAC-SHA256 over `${id}.${timestamp}.${body}`)
      const secretClean = webhookSecret.startsWith("whsec_") ? webhookSecret.slice(6) : webhookSecret;
      const secretBytes = Buffer.from(secretClean, "base64");
      const expectedSig = createHmac("sha256", secretBytes)
        .update(`${svixId}.${svixTimestamp}.${rawBody}`)
        .digest("base64");

      const signatures = svixSignature.split(" ");
      const hasValidSig = signatures.some((sig) => {
        const clean = sig.startsWith("v1,") ? sig.slice(3) : sig;
        if (clean.length !== expectedSig.length) return false;
        return timingSafeEqual(Buffer.from(clean), Buffer.from(expectedSig));
      });

      if (!hasValidSig) {
        logger.warn("Resend webhook rejected: invalid signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody) as { type?: string; data?: { to?: string[] | string; email?: string } };
    const eventType = payload.type; // "email.bounced" | "email.complained" | "email.delivered"
    const data = payload.data || {};
    const recipients: string[] = Array.isArray(data.to)
      ? data.to
      : [data.to || data.email].filter((x): x is string => typeof x === "string");

    if (eventType === "email.bounced" || eventType === "email.complained") {
      for (const email of recipients) {
        if (email && typeof email === "string") {
          const normalized = email.toLowerCase().trim();
          // Suppress for 90 days (7,776,000s)
          await redis.setex(`email:suppressed:${normalized}`, 86400 * 90, eventType);
          logger.info(`Suppressed recipient due to ${eventType}`, { email: normalized });
        }
      }
    }

    return NextResponse.json({ success: true, event: eventType });
  } catch (error) {
    logger.error("Resend webhook processing error", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
