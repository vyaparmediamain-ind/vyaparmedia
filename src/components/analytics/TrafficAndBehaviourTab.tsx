"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { TrafficReportModal } from "@/components/reports/TrafficReportModal";
import {
  Globe,
  Smartphone,
  Users,
  Filter,
  Download,
  Printer,
  Loader2,
  AlertCircle,
  Calendar,
} from "lucide-react";
import {
  parseTrafficRange,
  type TrafficRangeDays,
  type TrafficReportData,
} from "@/lib/traffic-analytics";

export function TrafficAndBehaviourTab() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentRange = parseTrafficRange(searchParams.get("range"));
  const [range, setRange] = useState<TrafficRangeDays>(currentRange);
  const [data, setData] = useState<TrafficReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchTrafficData = useCallback(async (selectedRange: TrafficRangeDays) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/traffic?range=${selectedRange}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.message || "Failed to load traffic metrics");
      }
      setData(json.data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load traffic metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrafficData(range);
  }, [range, fetchTrafficData]);

  const handleRangeChange = (newRange: TrafficRangeDays) => {
    setRange(newRange);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "traffic");
    params.set("range", String(newRange));
    router.replace(`?${params.toString()}`);
  };

  const handleDownloadCsv = () => {
    window.open(`/api/admin/reports/traffic?range=${range}&format=csv`, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Range Selector + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/60 p-4 rounded-2xl border border-border">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mr-2">
            Time Window:
          </span>
          <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-border">
            {([7, 30, 90] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRangeChange(r)}
                disabled={loading && range === r}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  range === r
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r} Days
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleDownloadCsv}
            disabled={loading || !data}
            className="text-xs font-bold gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            <span>Export CSV</span>
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsModalOpen(true)}
            disabled={loading || !data}
            className="text-xs font-bold gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Platform Traffic Report</span>
          </Button>
        </div>
      </div>

      {loading && (
        <div className="p-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-xs font-bold font-mono">Loading telemetry rollups...</span>
        </div>
      )}

      {error && (
        <div className="p-8 rounded-2xl border border-disputed-border bg-disputed-muted text-disputed text-center space-y-3">
          <AlertCircle className="w-8 h-8 mx-auto" />
          <div className="text-sm font-bold">Failed to load platform traffic metrics</div>
          <p className="text-xs opacity-90 max-w-md mx-auto">{error}</p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fetchTrafficData(range)}
            disabled={loading}
            className="text-xs"
          >
            Retry Loading
          </Button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-card card glass border border-border rounded-2xl p-4">
              <span className="text-2xs font-semibold text-muted-foreground block uppercase mb-1">
                Unique Visitors
              </span>
              <span className="text-2xl font-black text-foreground font-mono tabular-nums block">
                {data.summary.totalUniqueVisitors.toLocaleString("en-IN")}
              </span>
              <span className="text-3xs text-verified font-bold mt-1 block">VERIFIED</span>
            </div>

            <div className="bg-card card glass border border-border rounded-2xl p-4">
              <span className="text-2xs font-semibold text-muted-foreground block uppercase mb-1">
                Total Page Views
              </span>
              <span className="text-2xl font-black text-foreground font-mono tabular-nums block">
                {data.summary.totalPageViews.toLocaleString("en-IN")}
              </span>
              <span className="text-3xs text-verified font-bold mt-1 block">VERIFIED</span>
            </div>

            <div className="bg-card card glass border border-border rounded-2xl p-4">
              <span className="text-2xs font-semibold text-muted-foreground block uppercase mb-1">
                Avg Active Time
              </span>
              <span className="text-2xl font-black text-foreground font-mono tabular-nums block">
                {data.summary.avgActiveSec}s
              </span>
              <span className="text-3xs text-verified font-bold mt-1 block">VERIFIED</span>
            </div>

            <div className="bg-card card glass border border-border rounded-2xl p-4">
              <span className="text-2xs font-semibold text-muted-foreground block uppercase mb-1">
                Avg Scroll Depth
              </span>
              <span className="text-2xl font-black text-foreground font-mono tabular-nums block">
                {data.summary.avgScrollPct}%
              </span>
              <span className="text-3xs text-verified font-bold mt-1 block">VERIFIED</span>
            </div>

            <div className="bg-card card glass border border-border rounded-2xl p-4 col-span-2 sm:col-span-1">
              <span className="text-2xs font-semibold text-muted-foreground block uppercase mb-1">
                Bounce Rate
              </span>
              <span className="text-2xl font-black text-amber font-mono tabular-nums block">
                ~{data.summary.bouncePercent}%
              </span>
              <span className="text-3xs text-amber font-bold mt-1 block">ESTIMATED*</span>
            </div>
          </div>

          {/* Top Routes Table */}
          <div className="bg-card card glass border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                <span>Top Routes by Volume</span>
              </h2>
              <span className="text-xs text-muted-foreground font-mono">
                {data.topRoutes.length} routes recorded
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-muted/40 border-b border-border text-2xs uppercase tracking-wider text-muted-foreground font-bold">
                  <tr>
                    <th className="p-3">Route Path</th>
                    <th className="p-3 text-right">Visitors</th>
                    <th className="p-3 text-right">Page Views</th>
                    <th className="p-3 text-right">Avg Active</th>
                    <th className="p-3 text-right">Scroll</th>
                    <th className="p-3 text-right">Bounce Rate (est.)*</th>
                    <th className="p-3 text-center">Quality</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.topRoutes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-muted-foreground italic">
                        No telemetry rollups found for this range.
                      </td>
                    </tr>
                  ) : (
                    data.topRoutes.map((r) => (
                      <tr key={r.routeKey} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-mono font-medium text-foreground">{r.routeKey}</td>
                        <td className="p-3 text-right font-mono tabular-nums text-foreground">
                          {r.uniqueVisitors.toLocaleString("en-IN")}
                        </td>
                        <td className="p-3 text-right font-mono tabular-nums text-foreground">
                          {r.pageViews.toLocaleString("en-IN")}
                        </td>
                        <td className="p-3 text-right font-mono tabular-nums text-muted-foreground">
                          {Math.round(r.avgActiveMs / 1000)}s
                        </td>
                        <td className="p-3 text-right font-mono tabular-nums text-muted-foreground">
                          {r.avgScrollPct}%
                        </td>
                        <td className="p-3 text-right font-mono tabular-nums text-amber">
                          ~{r.bouncePercent}%
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="success" className="text-3xs py-0 px-1 font-bold">
                            VERIFIED
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-3xs text-muted-foreground italic">
              * Bounce rate is derived from sessions viewing only one route with active dwell time &lt; 10 seconds.
            </p>
          </div>

          {/* Demographics & Traffic Breakdown Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Devices */}
            <div className="bg-card card glass border border-border rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-primary" />
                <span>Device Split</span>
              </h3>
              <div className="space-y-3">
                {data.devices.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No device data available.</p>
                ) : (
                  data.devices.map((d) => (
                    <div key={d.key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-foreground">{d.label}</span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {d.percentShare}% ({d.pageViews.toLocaleString("en-IN")} views)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${Math.min(100, Math.max(3, d.percentShare))}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Roles */}
            <div className="bg-card card glass border border-border rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-accent" />
                <span>User Role Split</span>
              </h3>
              <div className="space-y-3">
                {data.roles.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No role data available.</p>
                ) : (
                  data.roles.map((r) => (
                    <div key={r.key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-foreground">{r.label}</span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {r.percentShare}% ({r.visitors.toLocaleString("en-IN")} visitors)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all"
                          style={{ width: `${Math.min(100, Math.max(3, r.percentShare))}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Referrers */}
          {data.referrers.length > 0 && (
            <div className="bg-card card glass border border-border rounded-2xl p-6 space-y-3">
              <h3 className="text-sm font-bold text-foreground">Top Inbound Referrer Domains</h3>
              <div className="flex flex-wrap gap-2">
                {data.referrers.slice(0, 12).map((ref) => (
                  <div
                    key={ref.key}
                    className="px-3 py-1.5 rounded-xl border border-border bg-muted/40 text-xs font-mono flex items-center gap-2"
                  >
                    <span className="text-foreground font-bold">{ref.key}</span>
                    <span className="text-muted-foreground">({ref.pageViews} views)</span>
                    <span className="text-primary font-bold">{ref.percentShare}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conversion Funnels with Drop-off % */}
          <div className="bg-card card glass border border-border rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary" />
                <span>Conversion Funnels & Step Drop-Off</span>
              </h2>
              <span className="text-xs text-muted-foreground">
                3 Key Conversion Sequences Monitored
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {data.funnels.map((funnel) => (
                <div
                  key={funnel.funnelKey}
                  className="rounded-2xl border border-border bg-muted/20 p-5 space-y-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                      <h3 className="text-xs font-bold text-foreground uppercase tracking-tight">
                        {funnel.funnelTitle}
                      </h3>
                      <Badge variant="primary" className="text-3xs font-mono font-bold">
                        {funnel.completionRatePercent}% Goal Completion
                      </Badge>
                    </div>

                    <div className="space-y-4">
                      {funnel.steps.map((step, idx) => (
                        <div key={step.stepKey} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-foreground text-2xs truncate max-w-[170px]">
                              {step.label}
                            </span>
                            <span className="font-mono tabular-nums text-foreground font-bold text-2xs">
                              {step.sessions.toLocaleString("en-IN")} sessions
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-3xs text-muted-foreground">
                            <span>Step Conv: {step.conversionPercent}%</span>
                            {idx > 0 && (
                              <span
                                className={
                                  step.dropOffPercent > 50
                                    ? "text-danger font-bold"
                                    : "text-amber font-semibold"
                                }
                              >
                                -{step.dropOffPercent}% drop-off
                              </span>
                            )}
                          </div>

                          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-verified rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, Math.max(3, step.conversionPercent))}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/60 text-2xs text-muted-foreground flex justify-between">
                    <span>Funnel Completed:</span>
                    <strong className="font-mono text-foreground font-bold">
                      {funnel.completedSessions} sessions
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Branded Modal */}
      <TrafficReportModal
        range={range}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
