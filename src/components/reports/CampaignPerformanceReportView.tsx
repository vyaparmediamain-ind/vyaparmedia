"use client";

import React from "react";
import { ReportLetterhead } from "./ReportLetterhead";
import { ReportMetaBlock } from "./ReportMetaBlock";
import { ReportFooter } from "./ReportFooter";
import { DataQualityLegend } from "./DataQualityLegend";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatNumber } from "@/lib/utils-client";
import type { CampaignPerformanceReportData } from "@/services/campaign-performance-report.service";
import {
  TrendingUp,
  Building,
  Target,
  CheckCircle2,
  AlertCircle,
  Eye,
  IndianRupee,
} from "lucide-react";

interface Props {
  readonly data: CampaignPerformanceReportData;
  readonly isAdmin?: boolean | undefined;
  readonly className?: string | undefined;
}

export function CampaignPerformanceReportView({
  data,
  isAdmin = false,
  className = "",
}: Props) {
  const { campaign, kpis, funnel, creators, finance, dataQualitySummary, reportMeta, disclaimer } =
    data;

  return (
    <div
      className={`space-y-8 bg-card text-foreground print:bg-card print:text-foreground ${className}`}
    >
      {/* 1. Official Platform Letterhead */}
      <ReportLetterhead
        title="Campaign Performance & Attribution Report"
        subtitle="Audited Performance Metrics, Multi-Stage Funnel Telemetry & Escrow Reconciliation"
        categoryLabel="OFFICIAL CAMPAIGN PERFORMANCE & SETTLEMENT RECORD"
        isAdmin={isAdmin}
      />

      {/* 2. Canonical Report Metadata Block */}
      <ReportMetaBlock meta={reportMeta} />

      {/* 3. Campaign & Brand Legal Dossier */}
      <section
        aria-label="Campaign & Brand Dossier"
        className="rounded-2xl border border-border bg-muted/20 p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>{campaign.title}</span>
                <Badge variant="ghost" className="text-2xs font-bold uppercase tracking-wider">
                  {campaign.status}
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Campaign ID: <span className="font-mono text-foreground font-semibold">{campaign.id}</span>
              </p>
            </div>
          </div>
          <div className="text-right sm:text-right text-xs">
            <span className="text-muted-foreground block text-2xs uppercase tracking-wider font-semibold">
              Total Escrow Budget
            </span>
            <span className="text-base font-extrabold text-foreground">
              {formatCurrency(campaign.totalBudgetPaise)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground block text-2xs uppercase tracking-wider font-semibold">
              Brand Legal Entity
            </span>
            <span className="font-bold text-foreground">
              {campaign.brandLegalDetails.companyName}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-2xs uppercase tracking-wider font-semibold">
              Brand GSTIN
            </span>
            <span className="font-mono text-foreground">
              {campaign.brandLegalDetails.gstin || "Exempt / Unregistered"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-2xs uppercase tracking-wider font-semibold">
              Brand PAN
            </span>
            <span className="font-mono text-foreground">
              {campaign.brandLegalDetails.pan || "Not Configured"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-2xs uppercase tracking-wider font-semibold">
              Target Categories
            </span>
            <span className="font-semibold text-foreground">
              {campaign.targetCategories.join(", ") || "General Marketing"}
            </span>
          </div>
        </div>
      </section>

      {/* 4. Executive Performance & Attribution KPIs */}
      <section aria-label="Executive Performance KPIs" className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-primary" /> Executive Attribution Summary
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl border border-border bg-card">
            <span className="text-2xs text-muted-foreground font-medium block">Total Spend</span>
            <span className="text-base font-extrabold text-foreground block mt-1">
              {formatCurrency(kpis.totalSpendPaise)}
            </span>
            <span className="text-2xs text-muted-foreground">Disbursed</span>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-card">
            <span className="text-2xs text-muted-foreground font-medium block">Estimated Reach</span>
            <span className="text-base font-extrabold text-foreground block mt-1">
              {formatNumber(kpis.totalReach)}
            </span>
            <span className="text-2xs text-muted-foreground">Unique Viewshed</span>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-card">
            <span className="text-2xs text-muted-foreground font-medium block flex items-center gap-1">
              Delivered Views
            </span>
            <span className="text-base font-extrabold text-foreground block mt-1">
              {formatNumber(kpis.totalViews)}
            </span>
            <span className="text-2xs text-verified font-medium">
              {Math.round((kpis.verifiedViews / Math.max(1, kpis.totalViews)) * 100)}% Verified API
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-card">
            <span className="text-2xs text-muted-foreground font-medium block">Delivered ER</span>
            <span className="text-base font-extrabold text-foreground block mt-1">
              {kpis.avgEngagementRate.toFixed(2)}%
            </span>
            <span className="text-2xs text-muted-foreground">
              {formatNumber(kpis.totalEngagements)} actions
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-card">
            <span className="text-2xs text-muted-foreground font-medium block">Effective CPV</span>
            <span className="text-base font-extrabold text-foreground block mt-1">
              ₹{kpis.effectiveCpvRupees}
            </span>
            <span className="text-2xs text-muted-foreground">
              Base: ₹{kpis.categoryBaselineCpvRupees}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-card">
            <span className="text-2xs text-muted-foreground font-medium block">Match Accuracy</span>
            <span className="text-base font-extrabold text-verified block mt-1">
              {kpis.algorithmMatchAccuracy}%
            </span>
            <span className="text-2xs text-muted-foreground">
              {kpis.efficiencyMultiplier ? `${kpis.efficiencyMultiplier}x benchmark` : "Optimized"}
            </span>
          </div>
        </div>
      </section>

      {/* 5. Conversion Funnel Attribution */}
      <section aria-label="Conversion Funnel Attribution" className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-primary" /> Full-Funnel Attribution Pipeline
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-1">
            <span className="text-2xs font-bold text-muted-foreground uppercase">1. Impressions / Reach</span>
            <div className="text-base font-extrabold text-foreground">{formatNumber(funnel.reach)}</div>
            <p className="text-2xs text-muted-foreground">Total unique audience footprint</p>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-1">
            <span className="text-2xs font-bold text-muted-foreground uppercase">2. Delivered Views</span>
            <div className="text-base font-extrabold text-foreground">{formatNumber(funnel.views)}</div>
            <p className="text-2xs text-muted-foreground">
              {funnel.reach > 0 ? `${((funnel.views / funnel.reach) * 100).toFixed(1)}% reach conversion` : "Direct views"}
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-1">
            <span className="text-2xs font-bold text-muted-foreground uppercase">3. Engagements</span>
            <div className="text-base font-extrabold text-foreground">{formatNumber(funnel.engagements)}</div>
            <p className="text-2xs text-muted-foreground">Likes, comments, shares, saves</p>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-1">
            <span className="text-2xs font-bold text-muted-foreground uppercase">4. High-Intent Actions</span>
            <div className="text-base font-extrabold text-foreground">{formatNumber(funnel.conversions)}</div>
            <p className="text-2xs text-muted-foreground">Shares and bookmark saves</p>
          </div>
        </div>
      </section>

      {/* 6. Creator Deliverables & Performance Table */}
      <section aria-label="Creator Performance Breakdown" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-primary" /> Creator Deliverables &amp; ROI Ledger ({creators.length})
          </h3>
          <span className="text-2xs text-muted-foreground">
            Values marked with <strong className="text-warning">~</strong> contain model-estimated metrics
          </span>
        </div>

        <div className="border border-border rounded-xl overflow-hidden bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border font-semibold print:table-header-group">
                <tr>
                  <th className="p-3">Creator Partner</th>
                  <th className="p-3 text-right">Fee (INR)</th>
                  <th className="p-3 text-right">Views</th>
                  <th className="p-3 text-right">Target Variance</th>
                  <th className="p-3 text-right">Actual CPV</th>
                  <th className="p-3 text-right">Engagements</th>
                  <th className="p-3 text-right">ER (%)</th>
                  <th className="p-3 text-right">Data Quality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {creators.map((c) => (
                  <tr key={c.dealId} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-foreground">{c.influencer}</div>
                      {c.handle && <div className="text-2xs text-muted-foreground">@{c.handle}</div>}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-foreground">
                      ₹{c.paidRupees}
                    </td>
                    <td className="p-3 text-right font-mono text-foreground">
                      {c.isEstimated ? `~${formatNumber(c.views)}` : formatNumber(c.views)}
                    </td>
                    <td className="p-3 text-right font-mono">
                      <span className={c.viewsVariancePercent >= 0 ? "text-verified font-bold" : "text-warning"}>
                        {c.viewsVariancePercent > 0 ? "+" : ""}
                        {c.viewsVariancePercent}%
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-foreground">
                      ₹{c.costPerView}
                    </td>
                    <td className="p-3 text-right font-mono text-foreground">
                      {formatNumber(c.totalEngagements)}
                    </td>
                    <td className="p-3 text-right font-mono text-foreground">
                      {c.engagementRate.toFixed(2)}%
                    </td>
                    <td className="p-3 text-right">
                      {c.isEstimated ? (
                        <Badge variant="warning" className="text-[10px] font-semibold">
                          ESTIMATED
                        </Badge>
                      ) : (
                        <Badge variant="success" className="text-[10px] font-semibold">
                          VERIFIED API
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 7. Campaign Finance & Indian Tax Accounting Table (Matches Finance Tab Exactly) */}
      <section aria-label="Finance & Tax Reconciliation" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <IndianRupee className="w-3.5 h-3.5 text-primary" /> Finance &amp; Statutory Tax Reconciliation
          </h3>
          {finance.reconciled ? (
            <Badge variant="success" className="text-[10px] font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> 100% Mathematically Reconciled
            </Badge>
          ) : (
            <Badge variant="danger" className="text-[10px] font-bold flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Discrepancy Detected
            </Badge>
          )}
        </div>

        <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-3 text-xs">
          <p className="text-muted-foreground text-2xs leading-relaxed">
            {finance.reconciliationMessage} All figures reflect statutory deductions under Section 194-O of the Indian Income-tax Act, 1961 and Central Goods and Services Tax Act, 2017.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-lg border border-border bg-card">
              <span className="text-2xs text-muted-foreground block font-medium">Total Escrow Spend</span>
              <span className="text-sm font-extrabold text-foreground block mt-0.5">
                {formatCurrency(finance.totalEscrowPaise)}
              </span>
              <span className="text-2xs text-muted-foreground">Disbursed Total</span>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card">
              <span className="text-2xs text-muted-foreground block font-medium">Creator Gross Payouts</span>
              <span className="text-sm font-extrabold text-foreground block mt-0.5">
                {formatCurrency(finance.grossPayoutPaise)}
              </span>
              <span className="text-2xs text-muted-foreground">Before Tax</span>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card">
              <span className="text-2xs text-muted-foreground block font-medium">Section 194-O TDS</span>
              <span className="text-sm font-extrabold text-warning block mt-0.5">
                {formatCurrency(finance.tdsDeductedPaise)}
              </span>
              <span className="text-2xs text-muted-foreground">Remitted to Govt</span>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card">
              <span className="text-2xs text-muted-foreground block font-medium">Creator Net Payouts</span>
              <span className="text-sm font-extrabold text-verified block mt-0.5">
                {formatCurrency(finance.netPayoutPaise)}
              </span>
              <span className="text-2xs text-muted-foreground">Direct Bank Transfer</span>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card">
              <span className="text-2xs text-muted-foreground block font-medium">Platform Service Fees</span>
              <span className="text-sm font-extrabold text-foreground block mt-0.5">
                {formatCurrency(finance.platformFeePaise)}
              </span>
              <span className="text-2xs text-muted-foreground">VyaparMedia Fee</span>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card">
              <span className="text-2xs text-muted-foreground block font-medium">GST on Platform Fee</span>
              <span className="text-sm font-extrabold text-foreground block mt-0.5">
                {formatCurrency(finance.gstOnPlatformFeePaise)}
              </span>
              <span className="text-2xs text-muted-foreground">18% Standard GST</span>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Data Quality Legend */}
      <DataQualityLegend summary={dataQualitySummary} />

      {/* 9. Canonical Report Footer & Integrity Code */}
      <ReportFooter
        integrityCode={reportMeta.integrityCode}
        reportId={reportMeta.reportId}
        disclaimer={disclaimer}
      />
    </div>
  );
}
