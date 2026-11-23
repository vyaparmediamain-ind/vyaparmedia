/**
 * Telemetry Service
 *
 * Implements server-side telemetry event ingestion, consent enforcement,
 * and daily statistical aggregation according to docs/design/telemetry-consent.md.
 */

import prisma from "@/lib/db";
import { redis } from "@/lib/redis";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { createActivityLog } from "@/lib/audit";
import { isFeatureEnabled, FEATURE_FLAGS } from "@/lib/feature-flags";
import {
  type PageViewEventInput,
  PageViewEventInputSchema,
  type TrackEventPayload,
  TrackEventPayloadSchema,
  canRecordIdentifiedTelemetry,
  createConsentUpdate,
  TELEMETRY_POLICY_VERSION,
} from "@/lib/telemetry";
import { normalizeRouteKey, extractRouteIdentifiers } from "@/lib/route-key";
import { telemetryEventsReceivedTotal, telemetryEventsDroppedTotal } from "@/lib/metrics";

let redisDroppedCounter = 0;

export function getRedisDroppedCount(): number {
  return redisDroppedCounter;
}

export function resetRedisDroppedCount(): void {
  redisDroppedCounter = 0;
}

export interface RecordPageViewResult {
  recorded: boolean;
  eventId?: string | undefined;
  identified: boolean;
  reason?: string | undefined;
}

export interface TelemetryUserContext {
  id: string;
  role: string;
}

export class TelemetryService {
  public static readonly TELEMETRY_QUEUE_KEY = "telemetry:events:queue";
  public static readonly REDIS_CACHE_TTL_SECONDS = 600; // 10 minutes

  /**
   * Resolves targetInfluencerId from username or handle via Redis cache (10 min TTL).
   * Never performs raw per-event DB queries if cached.
   */
  public static async resolveTargetInfluencerId(usernameOrHandle: string): Promise<string | null> {
    const clean = usernameOrHandle.replace(/^@/, "").trim().toLowerCase();
    if (!clean) return null;

    const cacheKey = `telemetry:cache:influencer:${clean}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached !== null) {
        return cached === "NONE" ? null : cached;
      }
    } catch (err) {
      logger.warn("Redis read error while resolving influencer ID", { error: String(err) });
    }

    // Query DB if not cached
    try {
      const profile = await prisma.influencerProfile.findFirst({
        where: {
          deletedAt: null,
          OR: [
            { instagramHandle: { equals: clean, mode: "insensitive" } },
            { id: clean },
            { userId: clean },
            { displayName: { equals: clean, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });

      const resolvedId = profile?.id ?? null;

      try {
        await redis.set(cacheKey, resolvedId ?? "NONE", "EX", TelemetryService.REDIS_CACHE_TTL_SECONDS);
      } catch (err) {
        logger.warn("Redis write error while caching influencer ID", { error: String(err) });
      }

      return resolvedId;
    } catch (dbErr) {
      logger.error("DB error resolving influencer profile for telemetry", { error: String(dbErr) });
      return null;
    }
  }

  /**
   * Resolves targetCampaignId via Redis cache (10 min TTL).
   */
  public static async resolveTargetCampaignId(campaignId: string): Promise<string | null> {
    const clean = campaignId.trim();
    if (!clean) return null;

    const cacheKey = `telemetry:cache:campaign:${clean}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached !== null) {
        return cached === "NONE" ? null : cached;
      }
    } catch (err) {
      logger.warn("Redis read error while resolving campaign ID", { error: String(err) });
    }

    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: clean },
        select: { id: true },
      });

      const resolvedId = campaign?.id ?? null;

      try {
        await redis.set(cacheKey, resolvedId ?? "NONE", "EX", TelemetryService.REDIS_CACHE_TTL_SECONDS);
      } catch (err) {
        logger.warn("Redis write error while caching campaign ID", { error: String(err) });
      }

      return resolvedId;
    } catch (dbErr) {
      logger.error("DB error resolving campaign for telemetry", { error: String(dbErr) });
      return null;
    }
  }

  /**
   * Ingests a sendBeacon event into the ioredis list.
   * If Redis is down, drops event and increments failure counter without throwing.
   */
  public static async enqueueTrackEvent(
    rawInput: unknown,
    callerUser?: TelemetryUserContext | null,
    opts?: { clock?: Date | undefined }
  ): Promise<{ enqueued: boolean; droppedReason?: string }> {
    telemetryEventsReceivedTotal.inc();

    // 1. Drop admin events immediately
    if (callerUser?.role === "ADMIN") {
      telemetryEventsDroppedTotal.inc({ reason: "ADMIN_DROPPED" });
      return { enqueued: false, droppedReason: "ADMIN_DROPPED" };
    }

    // 2. Validate input schema with strict rejection
    const parsed = TrackEventPayloadSchema.safeParse(rawInput);
    if (!parsed.success) {
      telemetryEventsDroppedTotal.inc({ reason: "INVALID_SCHEMA" });
      return { enqueued: false, droppedReason: "INVALID_SCHEMA" };
    }
    const input: TrackEventPayload = parsed.data;

    // Drop admin route keys
    const canonicalKey = input.routeKey || normalizeRouteKey(input.pathname);
    if (canonicalKey === "/admin" || (input.pathname && input.pathname.startsWith("/admin"))) {
      telemetryEventsDroppedTotal.inc({ reason: "ADMIN_DROPPED" });
      return { enqueued: false, droppedReason: "ADMIN_DROPPED" };
    }

    // 3. Check anonymous telemetry flag
    const anonymousEnabled = await isFeatureEnabled(FEATURE_FLAGS.TELEMETRY_ANONYMOUS, {
      userId: callerUser?.id,
      role: callerUser?.role,
    });
    if (!anonymousEnabled) {
      telemetryEventsDroppedTotal.inc({ reason: "ANONYMOUS_DISABLED" });
      return { enqueued: false, droppedReason: "ANONYMOUS_DISABLED" };
    }

    // 4. Resolve identified context (strictly requires affirmative consent AND feature flag)
    let userIdToStore: string | null = null;
    let roleToStore: string | null = null;

    if (callerUser?.id) {
      const identifiedFlagEnabled = await isFeatureEnabled(FEATURE_FLAGS.TELEMETRY_IDENTIFIED, {
        userId: callerUser.id,
        role: callerUser.role,
      });

      if (identifiedFlagEnabled) {
        const userRecord = await prisma.user.findUnique({
          where: { id: callerUser.id },
          select: { telemetryConsent: true },
        });

        if (canRecordIdentifiedTelemetry(userRecord?.telemetryConsent, identifiedFlagEnabled)) {
          userIdToStore = callerUser.id;
          roleToStore = callerUser.role;
        }
      }
    }

    // 5. Resolve target IDs via Redis cache (never per-event direct DB queries)
    let targetInfluencerId = input.targetInfluencerId ?? null;
    let targetCampaignId = input.targetCampaignId ?? null;

    if (input.pathname) {
      const identifiers = extractRouteIdentifiers(input.pathname);
      if (!targetInfluencerId && identifiers.username) {
        targetInfluencerId = await TelemetryService.resolveTargetInfluencerId(identifiers.username);
      }
      if (!targetCampaignId && identifiers.campaignId) {
        targetCampaignId = await TelemetryService.resolveTargetCampaignId(identifiers.campaignId);
      }
    }

    // 6. Build enqueued payload
    const eventItem = {
      sessionHash: input.sessionHash,
      userId: userIdToStore,
      role: roleToStore,
      routeKey: canonicalKey,
      targetInfluencerId,
      targetCampaignId,
      deviceType: input.deviceType,
      referrerHost: input.referrerHost ?? null,
      activeMs: input.activeMs,
      maxScrollPct: input.maxScrollPct,
      createdAt: (opts?.clock ?? new Date()).toISOString(),
    };

    // 7. Push to ioredis list with safe fallback
    try {
      await redis.rpush(TelemetryService.TELEMETRY_QUEUE_KEY, JSON.stringify(eventItem));
      return { enqueued: true };
    } catch (redisErr) {
      redisDroppedCounter++;
      telemetryEventsDroppedTotal.inc({ reason: "REDIS_DOWN" });
      logger.warn("Telemetry event dropped: Redis is unreachable or errored", {
        droppedCount: redisDroppedCounter,
        error: String(redisErr),
      });
      return { enqueued: false, droppedReason: "REDIS_DOWN" };
    }
  }

  /**
   * Ingests a page view event with strict server-side consent and flag evaluation.
   */
  public static async recordPageView(
    rawInput: unknown,
    callerUser?: TelemetryUserContext | null,
    opts?: { clock?: Date | undefined }
  ): Promise<RecordPageViewResult> {
    // 1. Check anonymous telemetry flag (master switch for any telemetry ingestion)
    const anonymousEnabled = await isFeatureEnabled(FEATURE_FLAGS.TELEMETRY_ANONYMOUS, {
      userId: callerUser?.id,
      role: callerUser?.role,
    });

    if (!anonymousEnabled) {
      return { recorded: false, identified: false, reason: "TELEMETRY_ANONYMOUS_DISABLED" };
    }

    // 2. Validate input schema with strict rejection of unapproved fields
    const parsed = PageViewEventInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw AppError.badRequest("Invalid telemetry event payload");
    }
    const input: PageViewEventInput = parsed.data;

    // 3. Determine if identified telemetry is allowed
    let isIdentified = false;
    let userIdToStore: string | null = null;
    let roleToStore: string | null = null;

    if (callerUser?.id) {
      const identifiedFlagEnabled = await isFeatureEnabled(FEATURE_FLAGS.TELEMETRY_IDENTIFIED, {
        userId: callerUser.id,
        role: callerUser.role,
      });

      if (identifiedFlagEnabled) {
        // Query user's current consent preference
        const userRecord = await prisma.user.findUnique({
          where: { id: callerUser.id },
          select: { telemetryConsent: true },
        });

        if (canRecordIdentifiedTelemetry(userRecord?.telemetryConsent, identifiedFlagEnabled)) {
          isIdentified = true;
          userIdToStore = callerUser.id;
          roleToStore = callerUser.role;
        }
      }
    }

    // 4. Insert into database
    try {
      const event = await prisma.pageViewEvent.create({
        data: {
          sessionHash: input.sessionHash,
          userId: userIdToStore,
          role: roleToStore,
          routeKey: input.routeKey,
          targetInfluencerId: input.targetInfluencerId ?? null,
          targetCampaignId: input.targetCampaignId ?? null,
          deviceType: input.deviceType,
          referrerHost: input.referrerHost ?? null,
          activeMs: input.activeMs,
          maxScrollPct: input.maxScrollPct,
          createdAt: opts?.clock ?? new Date(),
        },
        select: { id: true },
      });

      return {
        recorded: true,
        eventId: event.id,
        identified: isIdentified,
      };
    } catch (err) {
      logger.error("[TelemetryService] Failed to record page view event", { error: err });
      throw AppError.internal("Failed to persist telemetry event");
    }
  }

  /**
   * Retrieves a user's current telemetry consent status.
   */
  public static async getUserConsent(userId: string): Promise<{
    consent: boolean;
    consentAt: Date | null;
    version: string | null;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        telemetryConsent: true,
        telemetryConsentAt: true,
        telemetryConsentVersion: true,
      },
    });

    if (!user) {
      throw AppError.notFound("User not found");
    }

    return {
      consent: Boolean(user.telemetryConsent),
      consentAt: user.telemetryConsentAt,
      version: user.telemetryConsentVersion,
    };
  }

  /**
   * Updates user telemetry consent, enforcing DPDP Act audit requirements.
   */
  public static async updateUserConsent(
    userId: string,
    granted: boolean,
    version: string = TELEMETRY_POLICY_VERSION,
    opts?: { clock?: Date | undefined }
  ): Promise<{
    consent: boolean;
    consentAt: Date;
    version: string;
  }> {
    const clock = opts?.clock ?? new Date();
    const updateData = createConsentUpdate(granted, version, clock);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        telemetryConsent: true,
        telemetryConsentAt: true,
        telemetryConsentVersion: true,
      },
    });

    // Record immutable activity log
    await createActivityLog({
      userId,
      action: granted ? "TELEMETRY_CONSENT_GRANTED" : "TELEMETRY_CONSENT_REVOKED",
      entityType: "User",
      entityId: userId,
      metadata: {
        version,
        granted,
        timestamp: clock.toISOString(),
      },
    }).catch(() => {});

    return {
      consent: updatedUser.telemetryConsent,
      consentAt: updatedUser.telemetryConsentAt ?? clock,
      version: updatedUser.telemetryConsentVersion ?? version,
    };
  }

  /**
   * Aggregates raw PageViewEvents into DailyRouteStat rollups for a specific day.
   */
  public static async aggregateDailyRouteStats(
    date: Date
  ): Promise<{ processedRoutes: number }> {
    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);

    const dayEnd = new Date(date);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const events = await prisma.pageViewEvent.findMany({
      where: {
        createdAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      select: {
        routeKey: true,
        sessionHash: true,
        activeMs: true,
        maxScrollPct: true,
      },
    });

    if (events.length === 0) {
      return { processedRoutes: 0 };
    }

    // Group by routeKey
    const routeGroups = new Map<
      string,
      {
        sessions: Set<string>;
        totalViews: number;
        totalActiveMs: number;
        totalScrollPct: number;
        bounces: number;
      }
    >();

    for (const ev of events) {
      let group = routeGroups.get(ev.routeKey);
      if (!group) {
        group = {
          sessions: new Set(),
          totalViews: 0,
          totalActiveMs: 0,
          totalScrollPct: 0,
          bounces: 0,
        };
        routeGroups.set(ev.routeKey, group);
      }

      group.sessions.add(ev.sessionHash);
      group.totalViews += 1;
      group.totalActiveMs += ev.activeMs;
      group.totalScrollPct += ev.maxScrollPct;

      // Bounce definition: active time < 5 seconds and scroll depth < 25%
      if (ev.activeMs < 5000 && ev.maxScrollPct < 25) {
        group.bounces += 1;
      }
    }

    // Upsert into DailyRouteStat
    for (const [routeKey, group] of routeGroups.entries()) {
      const avgActiveMs = Math.round(group.totalActiveMs / group.totalViews);
      const avgScrollPct = Math.round(group.totalScrollPct / group.totalViews);
      const bounceBps = Math.round((group.bounces / group.totalViews) * 10000);

      await prisma.dailyRouteStat.upsert({
        where: {
          date_routeKey: {
            date: dayStart,
            routeKey,
          },
        },
        create: {
          date: dayStart,
          routeKey,
          uniqueVisitors: group.sessions.size,
          pageViews: group.totalViews,
          avgActiveMs,
          avgScrollPct,
          bounceBps,
        },
        update: {
          uniqueVisitors: group.sessions.size,
          pageViews: group.totalViews,
          avgActiveMs,
          avgScrollPct,
          bounceBps,
        },
      });
    }

    return { processedRoutes: routeGroups.size };
  }
}
