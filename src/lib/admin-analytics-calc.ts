/**
 * Admin Analytics Domain Logic (Pure Functions)
 *
 * PURE DOMAIN LOGIC:
 * - No Prisma, no fetch, no Date.now() inside; inject clock.
 * - Integer paise for all money; basis points for all rates.
 * - Handles actual resolved-fee revenue, conversion funnel drop-offs,
 *   data-quality distribution, cron health status, and report-config completeness.
 */

export interface AdminFunnelStage {
  stage: string;
  count: number;
  conversionPercent: number; // Conversion from previous stage
  dropOffPercent: number;    // Drop-off from previous stage
  dataQuality: "VERIFIED" | "ESTIMATED";
}

export interface AdminDataQualityBreakdown {
  verifiedCount: number;
  estimatedCount: number;
  selfReportedCount: number;
  totalDataPoints: number;
  verifiedShareBps: number;
  estimatedShareBps: number;
  selfReportedShareBps: number;
  verifiedPercent: number;
  estimatedPercent: number;
  selfReportedPercent: number;
}

export interface AdminCronHealthItem {
  id: string;
  name: string;
  path: string;
  cron: string;
  status: "HEALTHY" | "DEGRADED" | "CRITICAL" | "PENDING";
  lastRunAt: Date | null;
  durationMs: number;
  error?: string | null | undefined;
}

export interface ReportConfigCheckItem {
  key: string;
  label: string;
  isConfigured: boolean;
  valueMasked?: string | undefined;
  critical: boolean;
}

export interface ReportConfigCompletenessSummary {
  isReady: boolean;
  completenessPercent: number;
  configuredCount: number;
  totalRequired: number;
  items: ReportConfigCheckItem[];
  missingKeys: string[];
}

/**
 * Calculates resolved fee revenue vs held/booked platform fees.
 */
export function calculateResolvedRevenue(
  completedDealsFeePaise: number,
  escrowHeldDealsFeePaise: number,
  gatewayFeesPaise: number
): {
  actualResolvedFeePaise: number;
  bookedEscrowFeePaise: number;
  netResolvedPlatformRevenuePaise: number;
  dataQuality: "VERIFIED";
} {
  const actualResolvedFeePaise = Math.max(0, completedDealsFeePaise);
  const bookedEscrowFeePaise = Math.max(0, escrowHeldDealsFeePaise);
  const netResolvedPlatformRevenuePaise = Math.max(0, actualResolvedFeePaise - gatewayFeesPaise);

  return {
    actualResolvedFeePaise,
    bookedEscrowFeePaise,
    netResolvedPlatformRevenuePaise,
    dataQuality: "VERIFIED",
  };
}

/**
 * Calculates platform conversion funnel with drop-off percentages.
 */
export function calculateFunnelDropOffs(counts: {
  briefViews: number;
  applications: number;
  dealsEscrowed: number;
  contentApproved: number;
  dealsCompleted: number;
}): AdminFunnelStage[] {
  const stages = [
    { stage: "Brief Views", count: Math.max(0, counts.briefViews), quality: "VERIFIED" as const },
    { stage: "Applications", count: Math.max(0, counts.applications), quality: "VERIFIED" as const },
    { stage: "Deals Escrowed", count: Math.max(0, counts.dealsEscrowed), quality: "VERIFIED" as const },
    { stage: "Content Approved", count: Math.max(0, counts.contentApproved), quality: "VERIFIED" as const },
    { stage: "Deals Completed", count: Math.max(0, counts.dealsCompleted), quality: "VERIFIED" as const },
  ];

  return stages.map((s, idx) => {
    if (idx === 0) {
      return {
        stage: s.stage,
        count: s.count,
        conversionPercent: 100,
        dropOffPercent: 0,
        dataQuality: s.quality,
      };
    }

    const prevCount = stages[idx - 1]?.count ?? 0;
    const conversionPercent =
      prevCount > 0 ? Math.min(100, Math.round((s.count / prevCount) * 100)) : 0;
    const dropOffPercent = Math.max(0, 100 - conversionPercent);

    return {
      stage: s.stage,
      count: s.count,
      conversionPercent,
      dropOffPercent,
      dataQuality: s.quality,
    };
  });
}

/**
 * Calculates aggregate data quality shares across platform metrics.
 */
export function calculateDataQualityShare(counts: {
  verified: number;
  estimated: number;
  selfReported: number;
}): AdminDataQualityBreakdown {
  const verifiedCount = Math.max(0, counts.verified);
  const estimatedCount = Math.max(0, counts.estimated);
  const selfReportedCount = Math.max(0, counts.selfReported);
  const totalDataPoints = verifiedCount + estimatedCount + selfReportedCount;

  if (totalDataPoints === 0) {
    return {
      verifiedCount: 0,
      estimatedCount: 0,
      selfReportedCount: 0,
      totalDataPoints: 0,
      verifiedShareBps: 10000,
      estimatedShareBps: 0,
      selfReportedShareBps: 0,
      verifiedPercent: 100,
      estimatedPercent: 0,
      selfReportedPercent: 0,
    };
  }

  const verifiedShareBps = Math.round((verifiedCount / totalDataPoints) * 10000);
  const estimatedShareBps = Math.round((estimatedCount / totalDataPoints) * 10000);
  const selfReportedShareBps = Math.max(
    0,
    10000 - (verifiedShareBps + estimatedShareBps)
  );

  return {
    verifiedCount,
    estimatedCount,
    selfReportedCount,
    totalDataPoints,
    verifiedShareBps,
    estimatedShareBps,
    selfReportedShareBps,
    verifiedPercent: Math.round(verifiedShareBps / 100),
    estimatedPercent: Math.round(estimatedShareBps / 100),
    selfReportedPercent: Math.round(selfReportedShareBps / 100),
  };
}

/**
 * Assesses cron run heartbeats against expected definitions.
 */
export function evaluateCronHealth(
  cronDefinitions: Array<{ id: string; name: string; path: string; cron: string }>,
  latestRunsMap: Map<string, { status: string; completedAt?: Date | null; durationMs?: number | null; error?: string | null }>,
  clock: Date = new Date()
): {
  overallStatus: "HEALTHY" | "DEGRADED" | "CRITICAL";
  jobs: AdminCronHealthItem[];
  failingJobsCount: number;
} {
  const _nowMs = clock.getTime();
  let failingJobsCount = 0;

  const jobs: AdminCronHealthItem[] = cronDefinitions.map((def) => {
    const run = latestRunsMap.get(def.id) || latestRunsMap.get(def.path);
    if (!run) {
      return {
        id: def.id,
        name: def.name,
        path: def.path,
        cron: def.cron,
        status: "PENDING",
        lastRunAt: null,
        durationMs: 0,
      };
    }

    let status: "HEALTHY" | "DEGRADED" | "CRITICAL" = "HEALTHY";
    if (run.status === "FAILED") {
      status = "CRITICAL";
      failingJobsCount += 1;
    } else if (run.status === "RUNNING") {
      status = "HEALTHY";
    }

    return {
      id: def.id,
      name: def.name,
      path: def.path,
      cron: def.cron,
      status,
      lastRunAt: run.completedAt || null,
      durationMs: run.durationMs || 0,
      error: run.error || null,
    };
  });

  let overallStatus: "HEALTHY" | "DEGRADED" | "CRITICAL" = "HEALTHY";
  if (failingJobsCount >= 2) {
    overallStatus = "CRITICAL";
  } else if (failingJobsCount === 1) {
    overallStatus = "DEGRADED";
  }

  return { overallStatus, jobs, failingJobsCount };
}

/**
 * Evaluates completeness of platform report configuration.
 */
export function evaluateReportConfigCompleteness(config: {
  legalName?: string | undefined;
  brandName?: string | undefined;
  address?: string | undefined;
  gstin?: string | undefined;
  pan?: string | undefined;
  supportEmail?: string | undefined;
  grievanceEmail?: string | undefined;
  authorizedSignatory?: string | undefined;
}): ReportConfigCompletenessSummary {
  const items: ReportConfigCheckItem[] = [
    {
      key: "legalName",
      label: "Registered Corporate Name",
      isConfigured: Boolean(config.legalName && config.legalName.trim().length > 0),
      valueMasked: config.legalName,
      critical: true,
    },
    {
      key: "gstin",
      label: "Platform GSTIN (15-character Tax ID)",
      isConfigured: Boolean(config.gstin && config.gstin.trim().length === 15),
      valueMasked: config.gstin ? `${config.gstin.slice(0, 2)}...${config.gstin.slice(-3)}` : undefined,
      critical: true,
    },
    {
      key: "pan",
      label: "Platform Permanent Account Number (PAN)",
      isConfigured: Boolean(config.pan && config.pan.trim().length === 10),
      valueMasked: config.pan ? `...${config.pan.slice(-4)}` : undefined,
      critical: true,
    },
    {
      key: "address",
      label: "Registered Office Address",
      isConfigured: Boolean(config.address && config.address.trim().length > 5),
      valueMasked: config.address ? `${config.address.slice(0, 20)}...` : undefined,
      critical: true,
    },
    {
      key: "supportEmail",
      label: "Customer Support Email",
      isConfigured: Boolean(config.supportEmail && config.supportEmail.includes("@")),
      valueMasked: config.supportEmail,
      critical: true,
    },
    {
      key: "grievanceEmail",
      label: "IT Act Grievance Officer Email",
      isConfigured: Boolean(config.grievanceEmail && config.grievanceEmail.includes("@")),
      valueMasked: config.grievanceEmail,
      critical: false,
    },
    {
      key: "authorizedSignatory",
      label: "Authorized Legal Signatory Name",
      isConfigured: Boolean(config.authorizedSignatory && config.authorizedSignatory.trim().length > 0),
      valueMasked: config.authorizedSignatory,
      critical: false,
    },
  ];

  const totalRequired = items.length;
  const configuredCount = items.filter((i) => i.isConfigured).length;
  const criticalItems = items.filter((i) => i.critical);
  const criticalConfigured = criticalItems.every((i) => i.isConfigured);
  const completenessPercent = Math.round((configuredCount / totalRequired) * 100);
  const missingKeys = items.filter((i) => !i.isConfigured).map((i) => i.key);

  return {
    isReady: criticalConfigured,
    completenessPercent,
    configuredCount,
    totalRequired,
    items,
    missingKeys,
  };
}
