import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getSecureClientIp } from "@/lib/ip";
import { atomicDualRateLimit } from "@/lib/rate-limit";
import { TrackEventPayloadSchema } from "@/lib/telemetry";
import { TelemetryService } from "@/services/telemetry.service";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2048; // 2KB max payload

function isOriginAllowed(req: NextRequest): boolean {
  // 1. Sec-Fetch-Site check: Reject cross-site mutations
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") {
    return false;
  }

  // 2. Origin header check if present
  const origin = req.headers.get("origin");
  if (!origin) {
    // SendBeacon / same-site navigation requests might not always send Origin
    return true;
  }

  try {
    const originHost = new URL(origin).host.toLowerCase();
    const reqHost = (
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      ""
    ).toLowerCase();

    if (reqHost && originHost === reqHost) {
      return true;
    }

    const configuredHosts = [
      process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).host.toLowerCase() : null,
      process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).host.toLowerCase() : null,
      process.env.APP_BASE_URL ? new URL(process.env.APP_BASE_URL).host.toLowerCase() : null,
    ].filter(Boolean);

    return configuredHosts.includes(originHost);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  // Always return 204 No Content for sendBeacon callers
  const noContent = new Response(null, { status: 204 });

  // 1. Same-origin validation
  if (!isOriginAllowed(req)) {
    logger.warn("Telemetry track event rejected: cross-origin or disallowed origin");
    return noContent;
  }

  // 2. Content-Length pre-check
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    logger.warn("Telemetry track event rejected: body exceeds 2KB size limit", { contentLength });
    return noContent;
  }

  // 3. Read raw text (sendBeacon sends text/plain)
  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    return noContent;
  }

  if (!rawText || rawText.length > MAX_BODY_BYTES) {
    return noContent;
  }

  // 4. Parse JSON
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(rawText);
  } catch {
    return noContent;
  }

  // 5. Strict Zod validation
  const parsed = TrackEventPayloadSchema.safeParse(rawJson);
  if (!parsed.success) {
    logger.warn("Telemetry track event rejected: schema validation failure", {
      errors: parsed.error.format(),
    });
    return noContent;
  }

  const payload = parsed.data;

  // 6. Dual-Key Sliding-Window Rate Limiting (per-IP + per-session)
  const clientIp = getSecureClientIp(req);
  try {
    const rateLimit = await atomicDualRateLimit({
      userKey: `ratelimit:telemetry:session:${payload.sessionHash}`,
      ipKey: `ratelimit:telemetry:ip:${clientIp}`,
      userLimit: 60, // Max 60 beacon flushes per minute per session
      ipLimit: 120, // Max 120 beacon flushes per minute per IP
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      logger.warn("Telemetry track event dropped: rate limit exceeded", {
        clientIp,
        sessionHash: payload.sessionHash,
        blockedBy: rateLimit.blockedBy,
      });
      return noContent;
    }
  } catch (err) {
    logger.warn("Rate limiter evaluation failed for telemetry, continuing gracefully", {
      error: String(err),
    });
  }

  // 7. Resolve caller context & drop admin events
  let callerUser: { id: string; role: string } | null = null;
  try {
    const session = await auth();
    if (session?.user?.id) {
      callerUser = {
        id: session.user.id,
        role: session.user.userType ?? "USER",
      };
    }
  } catch (authErr) {
    // Auth failures should never crash telemetry ingest
    logger.debug("Failed to resolve auth session during telemetry track", { error: String(authErr) });
  }

  if (callerUser?.role === "ADMIN") {
    return noContent;
  }

  // 8. Enqueue event via service (uses Redis cache + ioredis list)
  await TelemetryService.enqueueTrackEvent(payload, callerUser);

  return noContent;
}
