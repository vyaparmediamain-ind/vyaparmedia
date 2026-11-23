/**
 * Telemetry Aggregator (Pure Logic)
 *
 * Computes daily statistical rollups for routes and conversion funnels.
 *
 * DEFINITIONS:
 * 1. Unique Visitor: Distinct `sessionHash` observed within an explicit Asia/Kolkata calendar day.
 * 2. Bounce: A single-page session whose total `activeMs < 10,000` (10 seconds).
 * 3. Conversion Funnels:
 *    - `signup`: landing ("/") -> register ("/auth") -> onboarding ("/dashboard") -> first_login (identified user)
 *    - `brand`: login ("/auth") -> campaign_create ("/dashboard/campaigns/create") -> publish ("/dashboard/campaigns/[id]")
 *    - `creator`: profile_complete ("/creator/[username]" or "/dashboard/settings") -> first_application ("/dashboard/campaigns/[id]")
 *
 * RULES:
 * - Pure logic: zero prisma, fetch, or Date.now calls inside; clock and boundaries injected.
 * - Time: All days bucketed explicitly in Asia/Kolkata (+05:30).
 * - Rates: Expressed in integer basis points (bps) where 100% = 10,000 bps. Round with Math.round.
 */

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 19,800,000 ms (+05:30)
export const BOUNCE_THRESHOLD_MS = 10_000; // Active time < 10s is a bounce

export interface RawTelemetryEvent {
  id?: string;
  sessionHash: string;
  userId?: string | null;
  role?: string | null;
  routeKey: string;
  targetInfluencerId?: string | null;
  targetCampaignId?: string | null;
  deviceType: string;
  referrerHost?: string | null;
  activeMs: number;
  maxScrollPct: number;
  createdAt: Date;
}

export interface RouteAggregationResult {
  date: Date;
  routeKey: string;
  uniqueVisitors: number;
  pageViews: number;
  avgActiveMs: number;
  avgScrollPct: number;
  bounceBps: number;
}

export interface FunnelAggregationResult {
  date: Date;
  funnelKey: string;
  stepKey: string;
  sessions: number;
}

export interface TrafficBreakdownResult {
  date: Date;
  dimension: "device" | "role" | "referrer";
  key: string;
  visitors: number;
  pageViews: number;
}

/**
 * Computes the Asia/Kolkata calendar day start and end bounds in UTC.
 * Ensures zero reliance on implicit server timezones.
 */
export function getKolkataDayBounds(date: Date): {
  dayStart: Date;
  dayEnd: Date;
  dateStr: string; // YYYY-MM-DD
} {
  const istEpoch = date.getTime() + IST_OFFSET_MS;
  const istDate = new Date(istEpoch);

  const year = istDate.getUTCFullYear();
  const month = istDate.getUTCMonth();
  const day = istDate.getUTCDate();

  // Midnight IST represented in UTC
  const dayStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - IST_OFFSET_MS);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const monthStr = String(month + 1).padStart(2, "0");
  const dayStr = String(day).padStart(2, "0");
  const dateStr = `${year}-${monthStr}-${dayStr}`;

  return { dayStart, dayEnd, dateStr };
}

/**
 * Aggregates raw page views into daily route statistics.
 *
 * Mathematical definitions:
 * - uniqueVisitors = count of distinct sessionHash for that route
 * - pageViews = total events for that route
 * - avgActiveMs = Math.round(totalActiveMs / pageViews)
 * - avgScrollPct = Math.round(totalScrollPct / pageViews)
 * - bounce = session having exactly 1 event on the route AND activeMs < 10s
 * - bounceBps = Math.round((bounceSessions / uniqueVisitors) * 10000)
 */
export function aggregateRouteStats(
  events: readonly RawTelemetryEvent[],
  dayStart: Date
): RouteAggregationResult[] {
  if (events.length === 0) return [];

  // Group events by routeKey
  const byRoute = new Map<string, RawTelemetryEvent[]>();
  for (const ev of events) {
    const list = byRoute.get(ev.routeKey) ?? [];
    list.push(ev);
    byRoute.set(ev.routeKey, list);
  }

  const results: RouteAggregationResult[] = [];

  for (const [routeKey, routeEvents] of byRoute.entries()) {
    // Tally session frequency and activeMs on this route
    const sessionMap = new Map<string, { count: number; totalActiveMs: number }>();
    let totalActiveMs = 0;
    let totalScrollPct = 0;

    for (const ev of routeEvents) {
      totalActiveMs += ev.activeMs;
      totalScrollPct += ev.maxScrollPct;

      const current = sessionMap.get(ev.sessionHash) ?? { count: 0, totalActiveMs: 0 };
      current.count += 1;
      current.totalActiveMs += ev.activeMs;
      sessionMap.set(ev.sessionHash, current);
    }

    const pageViews = routeEvents.length;
    const uniqueVisitors = sessionMap.size;

    // Single-page session with activeMs < 10s on this route
    let bounceCount = 0;
    for (const data of sessionMap.values()) {
      if (data.count === 1 && data.totalActiveMs < BOUNCE_THRESHOLD_MS) {
        bounceCount += 1;
      }
    }

    const avgActiveMs = pageViews > 0 ? Math.round(totalActiveMs / pageViews) : 0;
    const avgScrollPct = pageViews > 0 ? Math.round(totalScrollPct / pageViews) : 0;
    const bounceBps = uniqueVisitors > 0 ? Math.round((bounceCount / uniqueVisitors) * 10000) : 0;

    results.push({
      date: dayStart,
      routeKey,
      uniqueVisitors,
      pageViews,
      avgActiveMs,
      avgScrollPct,
      bounceBps,
    });
  }

  return results.sort((a, b) => a.routeKey.localeCompare(b.routeKey));
}

/**
 * Aggregates raw page views into daily conversion funnel metrics.
 *
 * Funnel Definitions:
 * 1. signup:
 *    - landing: visited "/"
 *    - register: visited "/auth" or routeKey includes register/auth
 *    - onboarding: visited "/dashboard"
 *    - first_login: had an identified userId attached
 * 2. brand:
 *    - login: visited "/auth"
 *    - campaign_create: visited "/dashboard/campaigns/create"
 *    - publish: visited "/dashboard/campaigns/[id]"
 * 3. creator:
 *    - profile_complete: visited "/creator/[username]" or "/dashboard/settings"
 *    - first_application: visited "/dashboard/campaigns/[id]"
 */
export function aggregateFunnelStats(
  events: readonly RawTelemetryEvent[],
  dayStart: Date
): FunnelAggregationResult[] {
  if (events.length === 0) return [];

  // Group events by sessionHash
  const sessionEvents = new Map<string, RawTelemetryEvent[]>();
  for (const ev of events) {
    const list = sessionEvents.get(ev.sessionHash) ?? [];
    list.push(ev);
    sessionEvents.set(ev.sessionHash, list);
  }

  // Track sessions reaching each funnel step with concrete typing to satisfy noUncheckedIndexedAccess
  interface FunnelStepTracker {
    signup: {
      landing: Set<string>;
      register: Set<string>;
      onboarding: Set<string>;
      first_login: Set<string>;
    };
    brand: {
      login: Set<string>;
      campaign_create: Set<string>;
      publish: Set<string>;
    };
    creator: {
      profile_complete: Set<string>;
      first_application: Set<string>;
    };
  }

  const funnelSteps: FunnelStepTracker = {
    signup: {
      landing: new Set(),
      register: new Set(),
      onboarding: new Set(),
      first_login: new Set(),
    },
    brand: {
      login: new Set(),
      campaign_create: new Set(),
      publish: new Set(),
    },
    creator: {
      profile_complete: new Set(),
      first_application: new Set(),
    },
  };

  for (const [sessionHash, evs] of sessionEvents.entries()) {
    const routesVisited = new Set(evs.map((e) => e.routeKey));
    const hasUserId = evs.some((e) => Boolean(e.userId));

    // Signup funnel evaluation (landing -> register -> onboarding -> first_login)
    if (routesVisited.has("/")) {
      funnelSteps.signup.landing.add(sessionHash);
    }
    if (routesVisited.has("/auth")) {
      funnelSteps.signup.register.add(sessionHash);
    }
    if (routesVisited.has("/dashboard")) {
      funnelSteps.signup.onboarding.add(sessionHash);
    }
    if (hasUserId && routesVisited.has("/dashboard") && routesVisited.has("/auth")) {
      funnelSteps.signup.first_login.add(sessionHash);
    }

    // Brand funnel evaluation: login -> campaign_create -> publish
    if (routesVisited.has("/auth")) {
      funnelSteps.brand.login.add(sessionHash);
    }
    if (routesVisited.has("/dashboard/campaigns/create")) {
      funnelSteps.brand.campaign_create.add(sessionHash);
    }
    if (
      routesVisited.has("/dashboard/campaigns/[id]") &&
      (routesVisited.has("/dashboard/campaigns/create") || evs.some((e) => e.role === "BRAND"))
    ) {
      funnelSteps.brand.publish.add(sessionHash);
    }

    // Creator funnel evaluation: profile_complete -> first_application
    if (routesVisited.has("/creator/[username]") || routesVisited.has("/dashboard/settings")) {
      funnelSteps.creator.profile_complete.add(sessionHash);
    }
    if (
      routesVisited.has("/dashboard/campaigns/[id]") &&
      (routesVisited.has("/creator/[username]") ||
        routesVisited.has("/dashboard/settings") ||
        evs.some((e) => e.role === "INFLUENCER" || e.role === "CREATOR"))
    ) {
      funnelSteps.creator.first_application.add(sessionHash);
    }
  }

  const results: FunnelAggregationResult[] = [];

  for (const [funnelKey, steps] of Object.entries(funnelSteps)) {
    for (const [stepKey, sessionSet] of Object.entries(steps as Record<string, Set<string>>)) {
      results.push({
        date: dayStart,
        funnelKey,
        stepKey,
        sessions: sessionSet.size,
      });
    }
  }

  return results.sort((a, b) =>
    a.funnelKey === b.funnelKey
      ? a.stepKey.localeCompare(b.stepKey)
      : a.funnelKey.localeCompare(b.funnelKey)
  );
}

/**
 * Aggregates raw page views into daily demographic and traffic breakdowns.
 *
 * Dimensions:
 * 1. device: deviceType ("desktop", "mobile", "tablet")
 * 2. role: authenticated role or "ANONYMOUS"
 * 3. referrer: referrerHost domain or "direct"
 */
export function aggregateTrafficBreakdowns(
  events: readonly RawTelemetryEvent[],
  dayStart: Date
): TrafficBreakdownResult[] {
  if (events.length === 0) return [];

  const deviceMap = new Map<string, { visitors: Set<string>; pageViews: number }>();
  const roleMap = new Map<string, { visitors: Set<string>; pageViews: number }>();
  const referrerMap = new Map<string, { visitors: Set<string>; pageViews: number }>();

  for (const ev of events) {
    // 1. Device breakdown
    const deviceKey = ev.deviceType ? ev.deviceType.toLowerCase().trim() : "desktop";
    const dEntry = deviceMap.get(deviceKey) ?? { visitors: new Set(), pageViews: 0 };
    dEntry.visitors.add(ev.sessionHash);
    dEntry.pageViews += 1;
    deviceMap.set(deviceKey, dEntry);

    // 2. Role breakdown
    const roleKey = ev.role ? ev.role.toUpperCase().trim() : "ANONYMOUS";
    const rEntry = roleMap.get(roleKey) ?? { visitors: new Set(), pageViews: 0 };
    rEntry.visitors.add(ev.sessionHash);
    rEntry.pageViews += 1;
    roleMap.set(roleKey, rEntry);

    // 3. Referrer breakdown
    const referrerKey = ev.referrerHost ? ev.referrerHost.toLowerCase().trim() : "direct";
    const refEntry = referrerMap.get(referrerKey) ?? { visitors: new Set(), pageViews: 0 };
    refEntry.visitors.add(ev.sessionHash);
    refEntry.pageViews += 1;
    referrerMap.set(referrerKey, refEntry);
  }

  const results: TrafficBreakdownResult[] = [];

  for (const [key, val] of deviceMap.entries()) {
    results.push({
      date: dayStart,
      dimension: "device",
      key,
      visitors: val.visitors.size,
      pageViews: val.pageViews,
    });
  }

  for (const [key, val] of roleMap.entries()) {
    results.push({
      date: dayStart,
      dimension: "role",
      key,
      visitors: val.visitors.size,
      pageViews: val.pageViews,
    });
  }

  for (const [key, val] of referrerMap.entries()) {
    results.push({
      date: dayStart,
      dimension: "referrer",
      key,
      visitors: val.visitors.size,
      pageViews: val.pageViews,
    });
  }

  return results.sort((a, b) =>
    a.dimension === b.dimension
      ? a.key.localeCompare(b.key)
      : a.dimension.localeCompare(b.dimension)
  );
}
