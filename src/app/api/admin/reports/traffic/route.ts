import { apiWrapper, ApiResponse, type ValidatedNextRequest } from "@/lib/api-wrapper";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { AdminAnalyticsService } from "@/services/admin-analytics.service";
import { logger } from "@/lib/logger";
import {
  buildBrandedCsv,
  buildReportFilename,
  csvResponse,
} from "@/lib/csv-export";
import { createAuditLog } from "@/lib/audit";
import { parseTrafficRange } from "@/lib/traffic-analytics";

async function _handler(req: ValidatedNextRequest) {
  const session = req.session;
  if (!session?.user) {
    return ApiResponse.unauthorized("Authentication required");
  }

  // Re-verify active admin against database on every request
  await requireActiveAdmin(session.user);

  const url = new URL(req.url);
  const rangeParam = url.searchParams.get("range");
  const fmt = url.searchParams.get("format") === "csv" ? "csv" : "json";
  const range = parseTrafficRange(rangeParam);

  const { meta, data } = await AdminAnalyticsService.getTrafficAndBehaviour(range, {
    id: session.user.id,
    name: session.user.name || "Platform Admin",
    email: session.user.email || "admin@vyaparmedia.in",
    role: "ADMIN",
  });

  // Audit export action for security compliance
  try {
    await createAuditLog({
      actorId: session.user.id,
      actionType: "EXPORT_TRAFFIC_REPORT",
      entityType: "REPORT",
      entityId: meta.reportId,
      afterJSON: {
        range,
        format: fmt,
        reportId: meta.reportId,
        integrityCode: meta.integrityCode,
      },
    });
  } catch (err: unknown) {
    logger.warn("Non-blocking audit log creation failed during traffic report export", {
      reportId: meta.reportId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (fmt === "csv") {
    // Prepare rows for top routes
    const routeRows = data.topRoutes.map((r) => ({
      routeKey: r.routeKey,
      uniqueVisitors: r.uniqueVisitors,
      pageViews: r.pageViews,
      avgActiveSec: Math.round(r.avgActiveMs / 1000),
      avgScrollPct: `${r.avgScrollPct}%`,
      bouncePercent: `${r.bouncePercent}%`,
      dataQuality: r.dataQuality,
    }));

    const filename = buildReportFilename("Traffic", "Platform", new Date());

    const csvContent = buildBrandedCsv({
      meta,
      columns: [
        { key: "routeKey", label: "Route Key" },
        { key: "uniqueVisitors", label: "Unique Visitors" },
        { key: "pageViews", label: "Page Views" },
        { key: "avgActiveSec", label: "Avg Active Time (s)" },
        { key: "avgScrollPct", label: "Avg Scroll Depth" },
        { key: "bouncePercent", label: "Bounce Rate (est.)" },
        { key: "dataQuality", label: "Data Quality" },
      ],
      rows: routeRows,
      summaryRows: [
        {
          routeKey: "TOTAL / AVERAGE",
          uniqueVisitors: data.summary.totalUniqueVisitors,
          pageViews: data.summary.totalPageViews,
          avgActiveSec: data.summary.avgActiveSec,
          avgScrollPct: `${data.summary.avgScrollPct}%`,
          bouncePercent: `${data.summary.bouncePercent}%`,
          dataQuality: "VERIFIED",
        },
      ],
      customSections: [
        {
          title: "DEVICE BREAKDOWN",
          rows: data.devices.map((d) => [
            d.label,
            `${d.percentShare}% (${d.pageViews} views, ${d.visitors} visitors)`,
          ]),
        },
        {
          title: "ROLE BREAKDOWN",
          rows: data.roles.map((r) => [
            r.label,
            `${r.percentShare}% (${r.visitors} visitors, ${r.pageViews} views)`,
          ]),
        },
        {
          title: "CONVERSION FUNNELS & DROP-OFF",
          rows: data.funnels.flatMap((f) =>
            f.steps.map((s) => [
              `${f.funnelTitle} - ${s.label}`,
              `${s.sessions} sessions (Conv: ${s.conversionPercent}%, Drop-off: ${s.dropOffPercent}%)`,
            ] as [string, string | number | null | undefined])
          ),
        },
      ],
    });

    return csvResponse(csvContent, filename);
  }

  return ApiResponse.success({
    meta,
    report: data,
  });
}

export const GET = apiWrapper(_handler, {
  requireAuth: true,
  requireAdmin: true,
  userRateLimit: {
    bucket: "REPORTS",
  },
});
