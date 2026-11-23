"use client";

import React from "react";
import { ReportLetterhead } from "./ReportLetterhead";
import { ReportMetaBlock } from "./ReportMetaBlock";
import { ReportFooter } from "./ReportFooter";
import { DataQualityLegend } from "./DataQualityLegend";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatNumber } from "@/lib/utils-client";
import type { CampaignGovernanceReportData } from "@/services/campaign-governance-report.service";
import {
  TrendingUp,
  Building,
  CheckCircle2,
  IndianRupee,
  ShieldAlert,
  Clock,
  AlertTriangle,
  MessageSquareWarning,
  DollarSign,
} from "lucide-react";

interface Props {
  readonly data: CampaignGovernanceReportData;
  readonly className?: string | undefined;
}

export function CampaignGovernanceReportView({ data, className = "" }: Props) {
  const {
    campaign,
    kpis,
    finance,
    governance,
    dataQualitySummary,
    reportMeta,
    disclaimer,
  } = data;

  return (
    <div
      className={`space-y-8 bg-card text-foreground print:bg-card print:text-foreground ${className}`}
    >
      {/* 1. Official Platform Letterhead */}
      <ReportLetterhead
        title="Administrative Campaign Governance & Audit Report"
        subtitle="Full Operational Monitoring, Platform Fee Recognition, Risk Mitigation & Escrow Audit"
        categoryLabel="INTERNAL ADMINISTRATIVE GOVERNANCE & SETTLEMENT RECORD"
        isAdmin={true}
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
              Total Campaign Budget
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
              Corporate Address
            </span>
            <span className="text-foreground truncate block max-w-xs" title={campaign.brandLegalDetails.address || ""}>
              {campaign.brandLegalDetails.address || "Not Specified"}
            </span>
          </div>
        </div>
      </section>

      {/* 4. ADMIN ONLY: Platform Revenue & Processor Reconciliation */}
      <section aria-label="Platform Revenue Ledger" className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5 text-verified" /> Platform Revenue Recognition (Completed Deals Only)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl border border-border bg-card">
            <span className="text-2xs text-muted-foreground font-medium block">Gross Platform Fees</span>
            <span className="text-base font-extrabold text-foreground block mt-1">
              ₹{governance.revenue.grossPlatformFeeRupees}
            </span>
            <span className="text-2xs text-muted-foreground">Invoiced Platform Cut</span>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-card">
            <span className="text-2xs text-muted-foreground font-medium block">Gateway Costs</span>
            <span className="text-base font-extrabold text-warning block mt-1">
              ₹{governance.revenue.gatewayCostRupees}
            </span>
            <span className="text-2xs text-muted-foreground">Processor transaction fee</span>
          </div>

          <div className="p-3.5 rounded-xl border border-verified-border bg-verified/5">
            <span className="text-2xs text-verified font-medium block">Net Platform Revenue</span>
            <span className="text-base font-extrabold text-verified block mt-1">
              ₹{governance.revenue.netPlatformRevenueRupees}
            </span>
            <span className="text-2xs text-muted-foreground">Retained margin</span>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-card">
            <span className="text-2xs text-muted-foreground font-medium block">Completed Deals</span>
            <span className="text-base font-extrabold text-foreground block mt-1">
              {governance.revenue.completedDealsCount} Deals
            </span>
            <span className="text-2xs text-muted-foreground">Revenue recognized</span>
          </div>
        </div>
      </section>

      {/* 5. ADMIN ONLY: Deadline Risks & Disputes */}
      <section aria-label="Deadline Risks and Disputes" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Deadline Risk Matrix */}
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-warning" /> Deals at Deadline Risk
            </h4>
            <Badge variant={governance.deadlineRisks.length > 0 ? "danger" : "success"} className="text-2xs font-bold">
              {governance.deadlineRisks.length} At Risk
            </Badge>
          </div>

          {governance.deadlineRisks.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              All active deals for this campaign are progressing on schedule.
            </p>
          ) : (
            <ul className="space-y-1.5 text-xs max-h-40 overflow-y-auto">
              {governance.deadlineRisks.map((r) => (
                <li key={r.dealId} className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                  <span className="font-semibold text-foreground">
                    Deal {r.dealId} (@{r.influencerHandle || r.influencerName})
                  </span>
                  <Badge variant={r.riskSeverity === "OVERDUE" ? "danger" : "warning"} className="text-[9px]">
                    {r.riskSeverity} ({r.hoursUntilPostingDeadline}h)
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Dispute Case Ledger */}
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-danger" /> Dispute Arbitration Cases
            </h4>
            <Badge variant={governance.disputes.open > 0 ? "danger" : "ghost"} className="text-2xs font-bold">
              {governance.disputes.open} Open / {governance.disputes.total} Total
            </Badge>
          </div>

          {governance.disputes.items.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              Zero escrow disputes or mediation arbitrations filed on this campaign.
            </p>
          ) : (
            <ul className="space-y-1.5 text-xs max-h-40 overflow-y-auto">
              {governance.disputes.items.map((d) => (
                <li key={d.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                  <span className="font-semibold text-foreground">
                    Dispute {d.id} ({d.type})
                  </span>
                  <Badge variant={d.status === "RESOLVED" ? "success" : "danger"} className="text-[9px]">
                    Tier {d.tier} - {d.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 6. ADMIN ONLY: Contact Leaks & Fraud Audit (P06) */}
      <section aria-label="Governance Flags" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contact Leaks (Strict: No Raw Message Text!) */}
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MessageSquareWarning className="w-3.5 h-3.5 text-warning" /> Contact-Leak Audit (Privacy Redacted)
            </h4>
            <Badge variant={governance.contactLeaks.totalCount > 0 ? "warning" : "ghost"} className="text-2xs font-bold">
              {governance.contactLeaks.totalCount} Policy Violations
            </Badge>
          </div>
          <p className="text-2xs text-muted-foreground">
            Strict compliance note: Raw message content is completely suppressed to protect user confidentiality.
          </p>

          {governance.contactLeaks.items.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">
              Zero off-platform contact leaks detected across campaign deals.
            </p>
          ) : (
            <ul className="space-y-1.5 text-xs max-h-36 overflow-y-auto">
              {governance.contactLeaks.items.map((l) => (
                <li key={l.messageId} className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                  <span className="font-mono text-2xs text-foreground truncate max-w-[200px]">
                    {l.senderEmail || l.senderUserType || "USER"}
                  </span>
                  <Badge variant="warning" className="text-[9px]">
                    {l.flagType}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Fraud Flags & Metric Anomalies (P06) */}
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-danger" /> Fraud &amp; Metric Anomalies (P06)
            </h4>
            <Badge
              variant={
                governance.fraudFlags.length > 0 || governance.creatorMetricAnomalies.length > 0
                  ? "danger"
                  : "success"
              }
              className="text-2xs font-bold"
            >
              {governance.fraudFlags.length + governance.creatorMetricAnomalies.length} Flags
            </Badge>
          </div>

          {governance.fraudFlags.length === 0 && governance.creatorMetricAnomalies.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              Normal distribution across creator authenticity, follower velocity, and engagement ratios.
            </p>
          ) : (
            <ul className="space-y-1.5 text-xs max-h-36 overflow-y-auto">
              {governance.fraudFlags.map((f, i) => (
                <li key={`f-${i}`} className="p-1.5 rounded-lg bg-danger/5 border border-danger-border flex items-center justify-between">
                  <span className="font-bold text-danger text-2xs">{f.flag}</span>
                  <span className="text-[10px] text-muted-foreground">{f.details}</span>
                </li>
              ))}
              {governance.creatorMetricAnomalies.map((a, i) => (
                <li key={`a-${i}`} className="p-1.5 rounded-lg bg-warning/5 border border-warning-border flex items-center justify-between">
                  <span className="font-bold text-warning text-2xs">{a.rule}</span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[220px]">
                    @{a.influencerHandle || a.influencerName}: {a.description}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 7. Performance & Attribution Summary */}
      <section aria-label="Executive Performance KPIs" className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-primary" /> Campaign Performance Summary
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="p-3.5 rounded-xl border border-border bg-card">
            <span className="text-2xs text-muted-foreground font-medium block">Total Spend</span>
            <span className="text-base font-extrabold text-foreground block mt-1">
              {formatCurrency(kpis.totalSpendPaise)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-card">
            <span className="text-2xs text-muted-foreground font-medium block">Estimated Reach</span>
            <span className="text-base font-extrabold text-foreground block mt-1">
              {formatNumber(kpis.totalReach)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-card">
            <span className="text-2xs text-muted-foreground font-medium block">Delivered Views</span>
            <span className="text-base font-extrabold text-foreground block mt-1">
              {formatNumber(kpis.totalViews)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-card">
            <span className="text-2xs text-muted-foreground font-medium block">Delivered ER</span>
            <span className="text-base font-extrabold text-foreground block mt-1">
              {kpis.avgEngagementRate.toFixed(2)}%
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-card">
            <span className="text-2xs text-muted-foreground font-medium block">Effective CPV</span>
            <span className="text-base font-extrabold text-foreground block mt-1">
              ₹{kpis.effectiveCpvRupees}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-card">
            <span className="text-2xs text-muted-foreground font-medium block">Match Accuracy</span>
            <span className="text-base font-extrabold text-verified block mt-1">
              {kpis.algorithmMatchAccuracy}%
            </span>
          </div>
        </div>
      </section>

      {/* 8. Finance & Statutory Tax Reconciliation (Matches Finance Tab) */}
      <section aria-label="Finance & Tax Reconciliation" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <IndianRupee className="w-3.5 h-3.5 text-primary" /> Finance &amp; Statutory Tax Reconciliation
          </h3>
          <Badge variant="success" className="text-[10px] font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Reconciled with Escrow Ledger
          </Badge>
        </div>

        <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-3 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-lg border border-border bg-card">
              <span className="text-2xs text-muted-foreground block font-medium">Total Escrow Spend</span>
              <span className="text-sm font-extrabold text-foreground block mt-0.5">
                {formatCurrency(finance.totalEscrowPaise)}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card">
              <span className="text-2xs text-muted-foreground block font-medium">Gross Creator Payouts</span>
              <span className="text-sm font-extrabold text-foreground block mt-0.5">
                {formatCurrency(finance.grossPayoutPaise)}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card">
              <span className="text-2xs text-muted-foreground block font-medium">Section 194-O TDS</span>
              <span className="text-sm font-extrabold text-warning block mt-0.5">
                {formatCurrency(finance.tdsDeductedPaise)}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card">
              <span className="text-2xs text-muted-foreground block font-medium">Net Creator Payouts</span>
              <span className="text-sm font-extrabold text-verified block mt-0.5">
                {formatCurrency(finance.netPayoutPaise)}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card">
              <span className="text-2xs text-muted-foreground block font-medium">Platform Service Fees</span>
              <span className="text-sm font-extrabold text-foreground block mt-0.5">
                {formatCurrency(finance.platformFeePaise)}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card">
              <span className="text-2xs text-muted-foreground block font-medium">GST on Platform Fee</span>
              <span className="text-sm font-extrabold text-foreground block mt-0.5">
                {formatCurrency(finance.gstOnPlatformFeePaise)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Data Quality Legend */}
      <DataQualityLegend summary={dataQualitySummary} />

      {/* 10. Canonical Report Footer & Integrity Code */}
      <ReportFooter
        integrityCode={reportMeta.integrityCode}
        reportId={reportMeta.reportId}
        disclaimer={disclaimer}
      />
    </div>
  );
}
