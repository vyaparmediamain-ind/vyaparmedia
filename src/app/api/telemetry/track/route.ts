import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getSecureClientIp } from "@/lib/ip";
import { atomicDualRateLimit } from "@/lib/rate-limit";
import { TrackEventPayloadSchema } from "@/lib/telemetry";
import { TelemetryService } from "@/services/telemetry.service";
import { logger } from "@/lib/logger";
import { telemetryEventsDroppedTotal } from "@/lib/metrics";

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

/**
 * Reads stream with a strict byte cap (2KB) to defend against chunked oversized bodies
 * before JSON parsing.
 */
async function readBodyWithCap(req: NextRequest, maxBytes: number): Promise<{ text: string | null; overflow: boolean }> {
  if (!req.body) {
    return { text: null, overflow: false };
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          try {
            await reader.cancel("Body exceeds maximum byte cap");
          } catch {
            // ignore cancel error
          }
          return { text: null, overflow: true };
        }
        chunks.push(value);
      }
    }
  } catch {
    return { text: null, overflow: false };
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { text: new TextDecoder().decode(combined), overflow: false };
}

export async function POST(req: NextRequest): Promise<Response> {
  // Always return 204 No Content for sendBeacon callers
  const noContent = new Response(null, { status: 204 });

  // 1. Same-origin validation
  if (!isOriginAllowed(req)) {
    telemetryEventsDroppedTotal.inc({ reason: "ORIGIN_DISALLOWED" });
    logger.debug("Telemetry track event dropped: disallowed origin");
    return noContent;
  }

  // 2. Rate-limit ordering: evaluate per-IP limit BEFORE reading or parsing the body
  const clientIp = getSecureClientIp(req);
  try {
    const ipRateLimit = await atomicDualRateLimit({
      userKey: `ratelimit:telemetry:ip:${clientIp}`,
      ipKey: `ratelimit:telemetry:ip:${clientIp}`,
      userLimit: 120,
      ipLimit: 120, // Max 120 beacon flushes per minute per IP
      windowSeconds: 60,
    });

    if (!ipRateLimit.success) {
      telemetryEventsDroppedTotal.inc({ reason: "RATE_LIMITED" });
      logger.debug("Telemetry track event dropped: IP rate limit exceeded");
      return noContent;
    }
  } catch (limiterErr) {
    // Fail-open for limiter errors (analytics only) but count them
    telemetryEventsDroppedTotal.inc({ reason: "RATE_LIMITER_ERROR" });
    logger.debug("Rate limiter evaluation failed for telemetry, continuing gracefully", {
      error: String(limiterErr),
    });
  }

  // 3. Content-Length pre-check
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    telemetryEventsDroppedTotal.inc({ reason: "PAYLOAD_TOO_LARGE" });
    logger.debug("Telemetry track event dropped: content-length exceeds 2KB");
    return noContent;
  }

  // 4. Stream reader with byte cap: enforce 2KB while reading before JSON parse
  const { text: rawText, overflow } = await readBodyWithCap(req, MAX_BODY_BYTES);
  if (overflow) {
    telemetryEventsDroppedTotal.inc({ reason: "PAYLOAD_TOO_LARGE" });
    logger.debug("Telemetry track event dropped: stream exceeded 2KB byte cap");
    return noContent;
  }

  if (!rawText || rawText.trim().length === 0) {
    telemetryEventsDroppedTotal.inc({ reason: "EMPTY_BODY" });
    return noContent;
  }

  // 5. Parse JSON
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(rawText);
  } catch {
    telemetryEventsDroppedTotal.inc({ reason: "MALFORMED_JSON" });
    return noContent;
  }

  // 6. Strict Zod validation (no zod error trees in logs)
  const parsed = TrackEventPayloadSchema.safeParse(rawJson);
  if (!parsed.success) {
    telemetryEventsDroppedTotal.inc({ reason: "INVALID_SCHEMA" });
    logger.debug("Telemetry track event dropped: schema validation failure");
    return noContent;
  }

  const payload = parsed.data;

  // 7. Secondary per-session rate limit (client-provided tabId/sessionHash)
  const sessionToken = payload.tabId || payload.sessionHash;
  if (sessionToken) {
    try {
      const sessionRateLimit = await atomicDualRateLimit({
        userKey: `ratelimit:telemetry:session:${sessionToken}`,
        ipKey: `ratelimit:telemetry:session:${sessionToken}`,
        userLimit: 60, // Max 60 beacon flushes per minute per session
        ipLimit: 60,
        windowSeconds: 60,
      });

      if (!sessionRateLimit.success) {
        telemetryEventsDroppedTotal.inc({ reason: "RATE_LIMITED" });
        logger.debug("Telemetry track event dropped: session rate limit exceeded");
        return noContent;
      }
    } catch {
      // Fail-open for session limiter
    }
  }

  // 8. Resolve caller context & drop admin events
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
    logger.debug("Failed to resolve auth session during telemetry track", { error: String(authErr) });
  }

  if (callerUser?.role === "ADMIN") {
    telemetryEventsDroppedTotal.inc({ reason: "ADMIN_DROPPED" });
    return noContent;
  }

  // 9. Enqueue event via service (uses Redis cache + HMAC sessionKey + ioredis list)
  await TelemetryService.enqueueTrackEvent(payload, callerUser);

  return noContent;
}
