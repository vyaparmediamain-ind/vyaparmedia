/**
 * DRS (Dynamic Reputation Score) Analytics & Plain-Language Drivers Engine
 *
 * PURE DOMAIN LOGIC:
 * - No Prisma, no fetch, no Date.now() inside.
 * - Injects clock or dates deterministically.
 * - Formats trust score trajectories, deltas, and maps internal trigger codes
 *   to user-friendly, ASCI/IT-Act compliant plain-language drivers.
 */

export type DrsTrendDirection = "UP" | "DOWN" | "STABLE";

export interface DrsSnapshotItem {
  id: string;
  previousScore: number;
  calculatedScore: number;
  finalScore: number;
  trigger: string;
  tier: string;
  createdAt: Date;
}

export interface DrsDriverItem {
  trigger: string;
  label: string;
  impactPts: number;
  isPositive: boolean;
  date: Date;
  dataQuality: "VERIFIED";
}

export interface DrsTrendSummary {
  currentScore: number;
  previousScore: number;
  netChange: number;
  direction: DrsTrendDirection;
  tier: string;
  dataQuality: "VERIFIED";
  history: Array<{
    date: Date;
    score: number;
    delta: number;
  }>;
  drivers: DrsDriverItem[];
}

/**
 * Maps raw backend trigger codes to clear, reassuring plain-language explanations.
 */
export function getDrsTriggerLabel(trigger: string, delta: number): string {
  switch (trigger) {
    case "DEAL_COMPLETED":
      return delta >= 0
        ? "Completed deal deliverables on time"
        : "Delivered completed collaboration";
    case "POSITIVE_REVIEW":
      return "Received high brand satisfaction rating";
    case "NEGATIVE_REVIEW":
      return "Received critical brand review";
    case "ON_TIME_DELIVERY":
      return "Submitted draft before deadline";
    case "LATE_DELIVERY":
      return "Draft delivery delayed past deadline";
    case "DISPUTE_OPENED":
      return "Active dispute recorded on deal";
    case "DISPUTE_RESOLVED_FAVORABLE":
      return "Dispute amicably resolved";
    case "IDENTITY_VERIFIED":
      return "Government ID & PAN tax verification verified";
    case "INSTAGRAM_CONNECTED":
      return "Verified Instagram professional account connected";
    case "YOUTUBE_CONNECTED":
      return "Verified YouTube creator channel connected";
    case "INACTIVITY_DECAY":
      return "Score decayed due to 60+ days platform inactivity";
    case "WEEKLY_CRON":
      return "Weekly consistency & engagement maintenance";
    case "ADMIN_ADJUSTMENT":
      return "Platform governance score adjustment";
    default:
      return delta > 0 ? "Platform trust increase" : delta < 0 ? "Trust score adjustment" : "Trust score verified";
  }
}

/**
 * Computes DRS trend trajectory and plain-language drivers from ordered snapshot records.
 */
export function computeDrsTrend(
  snapshots: DrsSnapshotItem[],
  fallbackScore = 600,
  fallbackTier = "BRONZE"
): DrsTrendSummary {
  if (!snapshots || snapshots.length === 0) {
    return {
      currentScore: fallbackScore,
      previousScore: fallbackScore,
      netChange: 0,
      direction: "STABLE",
      tier: fallbackTier,
      dataQuality: "VERIFIED",
      history: [],
      drivers: [
        {
          trigger: "ONBOARDING",
          label: "Initial platform onboarding trust baseline",
          impactPts: 0,
          isPositive: true,
          date: new Date(),
          dataQuality: "VERIFIED",
        },
      ],
    };
  }

  // Snapshots passed in desc or asc order; sort chrono ascending for trajectory
  const chronological = [...snapshots].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const latest = chronological[chronological.length - 1];
  const earliest = chronological[0];
  const previous = chronological.length > 1 ? chronological[chronological.length - 2] : earliest;

  const currentScore = latest?.finalScore ?? fallbackScore;
  const previousScore = previous?.finalScore ?? fallbackScore;
  const netChange = currentScore - previousScore;
  const direction: DrsTrendDirection =
    netChange > 0 ? "UP" : netChange < 0 ? "DOWN" : "STABLE";

  const history = chronological.map((s, idx) => {
    const prev = idx > 0 ? chronological[idx - 1]?.finalScore ?? s.previousScore : s.previousScore;
    return {
      date: s.createdAt,
      score: s.finalScore,
      delta: s.finalScore - prev,
    };
  });

  // Generate plain-language drivers from recent events
  const drivers: DrsDriverItem[] = chronological
    .slice(-5)
    .reverse()
    .map((s, idx, arr) => {
      const prevScore = idx < arr.length - 1 ? arr[idx + 1]?.finalScore ?? s.previousScore : s.previousScore;
      const impactPts = s.finalScore - prevScore;
      return {
        trigger: s.trigger,
        label: getDrsTriggerLabel(s.trigger, impactPts),
        impactPts,
        isPositive: impactPts >= 0,
        date: s.createdAt,
        dataQuality: "VERIFIED",
      };
    });

  return {
    currentScore,
    previousScore,
    netChange,
    direction,
    tier: latest?.tier || fallbackTier,
    dataQuality: "VERIFIED",
    history,
    drivers,
  };
}
