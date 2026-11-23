/**
 * Pure Telemetry & Consent Logic
 * Conforms to DPDP Act 2023, zero-leak privacy, and pure unit-testability.
 *
 * Rules:
 * - No prisma, fetch, or Date.now inside: clock and salt are injected.
 * - No IP addresses or raw User-Agents are stored or handled.
 * - Strict mathematical hashing for ephemeral sessions.
 */

import { createHmac } from "node:crypto";
import { z } from "zod";

export const TELEMETRY_POLICY_VERSION = "2026.1";

export const ALLOWED_DEVICE_TYPES = ["desktop", "mobile", "tablet"] as const;
export type DeviceType = (typeof ALLOWED_DEVICE_TYPES)[number];

/**
 * Zod schema for validating incoming telemetry page view payloads.
 * Strictly forbids sensitive or unexpected fields (IP, raw UA, tokens).
 */
export const PageViewEventInputSchema = z
  .object({
    sessionHash: z
      .string()
      .min(8)
      .max(64)
      .regex(/^[0-9a-fA-F]+$/, "sessionHash must be a hex string"),
    routeKey: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Z0-9_/:\-\[\]]+$/i, "Invalid routeKey format"),
    targetInfluencerId: z.string().cuid().optional().nullable(),
    targetCampaignId: z.string().cuid().optional().nullable(),
    deviceType: z.enum(ALLOWED_DEVICE_TYPES),
    referrerHost: z
      .string()
      .max(255)
      .optional()
      .nullable()
      .transform((val) => (val ? sanitizeReferrerHost(val) : null)),
    activeMs: z.number().int().min(0).max(86_400_000), // Max 24 hours
    maxScrollPct: z.number().int().min(0).max(100),
  })
  .strict();

export type PageViewEventInput = z.infer<typeof PageViewEventInputSchema>;

/**
 * Strict schema for /api/telemetry/track beacon payloads.
 * Maximum activeMs capped at 30 minutes (1,800,000 ms).
 */
export const TrackEventPayloadSchema = z
  .object({
    sessionHash: z
      .string()
      .min(8)
      .max(64)
      .regex(/^[0-9a-fA-F]+$/, "sessionHash must be a hex string"),
    pathname: z.string().min(1).max(1024).optional(),
    routeKey: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Z0-9_/:\-\[\]]+$/i, "Invalid routeKey format")
      .optional(),
    targetInfluencerId: z.string().cuid().optional().nullable(),
    targetCampaignId: z.string().cuid().optional().nullable(),
    deviceType: z.enum(ALLOWED_DEVICE_TYPES),
    referrerHost: z
      .string()
      .max(255)
      .optional()
      .nullable()
      .transform((val) => (val ? sanitizeReferrerHost(val) : null)),
    activeMs: z.number().int().min(0).max(1_800_000), // Capped at 30 min
    maxScrollPct: z.number().int().min(0).max(100),
  })
  .strict();

export type TrackEventPayload = z.infer<typeof TrackEventPayloadSchema>;

export const TelemetryConsentInputSchema = z
  .object({
    consent: z.boolean(),
    version: z.string().min(1).max(32).default(TELEMETRY_POLICY_VERSION),
  })
  .strict();

export type TelemetryConsentInput = z.infer<typeof TelemetryConsentInputSchema>;

/**
 * Sanitizes a referrer URL or host string to extract only the valid domain name.
 * Drops all paths, query parameters, auth tokens, or fragments.
 */
export function sanitizeReferrerHost(referrer?: string | null): string | null {
  if (!referrer || typeof referrer !== "string") return null;

  try {
    const raw = referrer.trim();
    if (!raw) return null;

    // Handle full URLs or bare hosts
    const parsed = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
    const host = parsed.hostname.toLowerCase();

    // Reject localhost, internal IPs, or excessively long strings
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".local") ||
      host.length > 253
    ) {
      return null;
    }

    return host;
  } catch {
    return null;
  }
}

/**
 * Categorizes a user agent string into coarse deviceType without saving the raw UA.
 */
export function resolveDeviceType(userAgent?: string | null): DeviceType {
  if (!userAgent || typeof userAgent !== "string") return "desktop";

  const lower = userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/i.test(lower)) {
    return "tablet";
  }
  if (/mobile|iphone|ipod|android.*mobile|blackberry|iemobile|opera mini/i.test(lower)) {
    return "mobile";
  }
  return "desktop";
}

/**
 * Normalizes an application URL path into a canonical route key for analytics aggregation.
 * e.g. "/creator/priyacreates" -> "CREATOR_PROFILE"
 * e.g. "/dashboard/campaigns/cm123" -> "CAMPAIGN_DETAIL"
 */
export function normalizeRouteKey(pathname: string): string {
  if (!pathname || typeof pathname !== "string") return "UNKNOWN";

  const firstPart = pathname.split("?")[0] ?? "";
  const clean = firstPart.replace(/\/+$/, "") || "/";

  if (clean === "/") return "HOME";
  if (clean === "/privacy") return "LEGAL_PRIVACY";
  if (clean === "/cookie-policy") return "LEGAL_COOKIES";
  if (clean === "/pricing") return "MARKETPLACE_PRICING";
  if (clean === "/dashboard") return "DASHBOARD_HOME";
  if (clean.startsWith("/dashboard/settings")) return "DASHBOARD_SETTINGS";
  if (clean.startsWith("/dashboard/wallet")) return "DASHBOARD_WALLET";
  if (clean.startsWith("/dashboard/deals")) return "DASHBOARD_DEALS";
  if (clean.startsWith("/dashboard/campaigns/create")) return "CAMPAIGN_CREATE";
  if (/^\/dashboard\/campaigns\/[^/]+$/.test(clean)) return "CAMPAIGN_DETAIL";
  if (clean.startsWith("/dashboard/campaigns")) return "CAMPAIGN_LIST";
  if (/^\/creator\/[^/]+$/.test(clean)) return "CREATOR_PROFILE";
  if (clean.startsWith("/admin")) return "ADMIN_PORTAL";

  // General fallback: convert path to upper snake_case key
  const sanitized = clean
    .replace(/^\//, "")
    .replaceAll("/", "_")
    .replaceAll(/[^a-zA-Z0-9_]/g, "")
    .toUpperCase();

  return sanitized.slice(0, 64) || "UNKNOWN";
}

/**
 * Computes an ephemeral session hash using HMAC-SHA256 with a daily rotating salt.
 * Ensures cross-day user correlation is mathematically impossible.
 */
export function computeDailySessionHash(
  clientTabId: string,
  serverSecret: string,
  dateStr: string // YYYY-MM-DD in Asia/Kolkata
): string {
  if (!clientTabId || !serverSecret || !dateStr) {
    throw new Error("clientTabId, serverSecret, and dateStr are required to compute session hash");
  }

  return createHmac("sha256", `${serverSecret}:${dateStr}`)
    .update(clientTabId)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Determines whether identified telemetry may be recorded for a user.
 * Both the feature flag and user affirmative consent must be active.
 */
export function canRecordIdentifiedTelemetry(
  userConsent: boolean | null | undefined,
  flagIdentified: boolean
): boolean {
  if (!flagIdentified) return false;
  return Boolean(userConsent);
}

/**
 * Pure helper to build consent record updates.
 */
export function createConsentUpdate(
  granted: boolean,
  version: string = TELEMETRY_POLICY_VERSION,
  clock: Date = new Date()
): {
  telemetryConsent: boolean;
  telemetryConsentAt: Date;
  telemetryConsentVersion: string;
} {
  return {
    telemetryConsent: granted,
    telemetryConsentAt: clock,
    telemetryConsentVersion: version,
  };
}
