"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Clock,
  AlertTriangle,
  ExternalLink,
  MessageSquareWarning,
  Eye,
  CheckCircle2,
  TrendingDown,
  Building,
  ArrowLeft,
  DollarSign,
  Activity,
  Layers,
  FileText,
} from "lucide-react";
import { Badge, Card, PageContainer, PageHeader } from "@/components/ui";
import EmptyState from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils-client";
import type { AdminCampaignDetailResponse } from "@/services/admin-campaign.service";
import { CampaignGovernanceReportModal } from "@/components/reports/CampaignGovernanceReportModal";

interface AdminCampaignClientProps {
  readonly initialData: AdminCampaignDetailResponse;
}

export default function AdminCampaignClient({ initialData }: AdminCampaignClientProps) {
  const [showGovernanceReportModal, setShowGovernanceReportModal] = useState(false);
  const { campaign, audit } = initialData;
  const { revenue, deadlineRisks, disputes, contactLeaks, fraudFlags, creatorMetricAnomalies, dataQualityShare } =
    audit;

  return (
    <PageContainer maxWidth="7xl" className="space-y-8 py-4 sm:py-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Admin Overview
        </Link>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowGovernanceReportModal(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground bg-muted/60 hover:bg-muted border border-border px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-primary" /> Governance Report (Print/CSV)
          </button>
          <Link
            href={`/dashboard/campaigns/${campaign.id}/analytics`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            Brand Analytics View <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Campaign Operations Header */}
      <PageHeader
        icon={
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Building className="w-5 h-5 text-primary" />
          </div>
        }
        title={campaign.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>Brand: <strong className="text-foreground">{campaign.brand?.companyName || "Direct Brand"}</strong></span>
            <span>&bull;</span>
            <span>Created: {formatDate(campaign.createdAt)}</span>
            <span>&bull;</span>
            <span>Deals: {campaign.dealsCount}</span>
            <span>&bull;</span>
            <Badge variant="ghost" className="text-[10px] uppercase font-bold tracking-wider">
              {campaign.status}
            </Badge>
          </span>
        }
      />

      {/* 1. PLATFORM REVENUE SECTION */}
      <section aria-labelledby="revenue-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="revenue-heading" className="text-base font-bold text-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-verified" /> Platform Revenue & Fee Ledger
            </h2>
            <p className="text-xs text-muted-foreground">
              Recognized exclusively from completed deals, net of payment processor costs.
            </p>
          </div>
          <Badge variant="success" className="text-[10px] font-bold">
            {revenue.completedDealsCount} Completed Deals
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-card border-border">
            <p className="text-xs text-muted-foreground font-medium">Gross Platform Fees</p>
            <p className="text-xl font-extrabold text-foreground mt-1">
              {formatCurrency(revenue.grossPlatformFeePaise)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Cumulative fee invoiced
            </p>
          </Card>

          <Card className="p-4 bg-card border-border">
            <p className="text-xs text-muted-foreground font-medium">Gateway Fees (Processor)</p>
            <p className="text-xl font-extrabold text-warning mt-1">
              {formatCurrency(revenue.gatewayCostPaise)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Razorpay/banking processing costs
            </p>
          </Card>

          <Card className="p-4 bg-verified/5 border-verified-border">
            <p className="text-xs text-verified font-medium">Net Platform Revenue</p>
            <p className="text-xl font-extrabold text-verified mt-1">
              {formatCurrency(revenue.netPlatformRevenuePaise)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Retained platform earnings
            </p>
          </Card>

          <Card className="p-4 bg-card border-border">
            <p className="text-xs text-muted-foreground font-medium">Total Campaign Budget</p>
            <p className="text-xl font-extrabold text-foreground mt-1">
              {formatCurrency(campaign.totalBudget)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Funded: {formatCurrency(campaign.fundedAmount)}
            </p>
          </Card>
        </div>
      </section>

      {/* 2. DEALS AT DEADLINE RISK */}
      <section aria-labelledby="risks-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-warning" />
            <h2 id="risks-heading" className="text-base font-bold text-foreground">
              Deals at Deadline Risk
            </h2>
          </div>
          {deadlineRisks.length > 0 ? (
            <Badge variant="danger" className="text-[10px] font-bold">
              {deadlineRisks.length} At Risk
            </Badge>
          ) : (
            <Badge variant="success" className="text-[10px] font-bold">
              All On Schedule
            </Badge>
          )}
        </div>

        {deadlineRisks.length === 0 ? (
          <EmptyState
            emoji="✅"
            title="No Deadline Risks"
            description="All active deals for this campaign are currently adhering to posting and signature timelines."
            compact
          />
        ) : (
          <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border font-semibold">
                  <tr>
                    <th className="p-3">Deal ID</th>
                    <th className="p-3">Creator</th>
                    <th className="p-3">Current Status</th>
                    <th className="p-3">Posting Deadline</th>
                    <th className="p-3">Hours Remaining</th>
                    <th className="p-3">Risk Severity</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deadlineRisks.map((risk) => (
                    <tr key={risk.dealId} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-mono font-medium text-foreground">
                        {risk.dealId}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-foreground">{risk.influencerName}</div>
                        {risk.influencerHandle && (
                          <div className="text-[10px] text-muted-foreground">@{risk.influencerHandle}</div>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="ghost" className="text-[10px] uppercase font-bold">
                          {risk.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {formatDate(risk.postingDeadline)}
                      </td>
                      <td className="p-3 font-mono font-bold">
                        {risk.hoursUntilPostingDeadline < 0 ? (
                          <span className="text-danger">{Math.abs(risk.hoursUntilPostingDeadline)}h overdue</span>
                        ) : (
                          <span className="text-warning">{risk.hoursUntilPostingDeadline}h remaining</span>
                        )}
                      </td>
                      <td className="p-3">
                        {risk.riskSeverity === "OVERDUE" && (
                          <Badge variant="danger" className="text-[10px] font-bold">
                            OVERDUE
                          </Badge>
                        )}
                        {risk.riskSeverity === "SIGN_OVERDUE" && (
                          <Badge variant="warning" className="text-[10px] font-bold">
                            SIGN OVERDUE
                          </Badge>
                        )}
                        {risk.riskSeverity === "IMMINENT_48H" && (
                          <Badge variant="warning" className="text-[10px] font-bold">
                            IMMINENT &lt;48H
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <Link
                          href={`/dashboard/deals/${risk.dealId}`}
                          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline text-[11px]"
                        >
                          View Deal <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* 3. DISPUTE TRACKING */}
      <section aria-labelledby="disputes-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-danger" />
            <h2 id="disputes-heading" className="text-base font-bold text-foreground">
              Dispute Cases ({disputes.total})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={disputes.open > 0 ? "danger" : "ghost"} className="text-[10px] font-bold">
              {disputes.open} Open
            </Badge>
            <Badge variant="success" className="text-[10px] font-bold">
              {disputes.resolved} Resolved
            </Badge>
          </div>
        </div>

        {disputes.items.length === 0 ? (
          <EmptyState
            emoji="🤝"
            title="No Disputes Reported"
            description="Zero disputes or escrow mediation requests recorded on this campaign."
            compact
          />
        ) : (
          <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border font-semibold">
                  <tr>
                    <th className="p-3">Dispute ID</th>
                    <th className="p-3">Deal ID</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Escrow Tier</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Date Raised</th>
                    <th className="p-3 text-right">Arbitration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {disputes.items.map((disp) => (
                    <tr key={disp.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-mono font-medium text-foreground">{disp.id}</td>
                      <td className="p-3 font-mono text-muted-foreground">{disp.dealId}</td>
                      <td className="p-3 font-semibold text-foreground">{disp.type}</td>
                      <td className="p-3 font-mono">Tier {disp.tier}</td>
                      <td className="p-3">
                        <Badge
                          variant={disp.status === "RESOLVED" || disp.status === "CLOSED" ? "success" : "danger"}
                          className="text-[10px] font-bold uppercase"
                        >
                          {disp.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{formatDate(disp.createdAt)}</td>
                      <td className="p-3 text-right">
                        <Link
                          href={`/admin/disputes/${disp.id}`}
                          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline text-[11px]"
                        >
                          Arbitrate <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* 4. CONTACT LEAK FLAGS (STRICT: NO MESSAGE DUMPS) */}
      <section aria-labelledby="leaks-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareWarning className="w-4 h-4 text-warning" />
            <div>
              <h2 id="leaks-heading" className="text-base font-bold text-foreground">
                Contact-Leak Flags ({contactLeaks.totalCount})
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Off-platform contact detection. Note: Message content is strictly redacted for administrative privacy.
              </p>
            </div>
          </div>
          <Badge variant={contactLeaks.totalCount > 0 ? "warning" : "ghost"} className="text-[10px] font-bold">
            {contactLeaks.totalCount} Policy Violations
          </Badge>
        </div>

        {contactLeaks.items.length === 0 ? (
          <EmptyState
            emoji="🔒"
            title="Clean Communications"
            description="No contact policy violations or off-platform leaks detected in campaign messaging."
            compact
          />
        ) : (
          <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border font-semibold">
                  <tr>
                    <th className="p-3">Flagged Event ID</th>
                    <th className="p-3">Sender Type</th>
                    <th className="p-3">Detected Pattern</th>
                    <th className="p-3">Logged Date</th>
                    <th className="p-3 text-right">Deal Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {contactLeaks.items.map((leak) => (
                    <tr key={leak.messageId} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-mono font-medium text-foreground">{leak.messageId}</td>
                      <td className="p-3">
                        <span className="font-semibold text-foreground">{leak.senderUserType || "USER"}</span>
                        {leak.senderEmail && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                            {leak.senderEmail}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="warning" className="text-[10px] font-semibold">
                          {leak.flagType}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{formatDate(leak.createdAt)}</td>
                      <td className="p-3 text-right">
                        {leak.dealLink ? (
                          <Link
                            href={leak.dealLink}
                            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline text-[11px]"
                          >
                            Deal Room <ExternalLink className="w-3 h-3" />
                          </Link>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* 5. FRAUD & METRIC ANOMALIES (P06) */}
      <section aria-labelledby="fraud-heading" className="space-y-4">
        <div>
          <h2 id="fraud-heading" className="text-base font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-danger" /> Fraud & Creator Metric Anomaly Audit
          </h2>
          <p className="text-xs text-muted-foreground">
            Synthetic followers, engagement collapses, authenticity risks, and sample size constraints.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Fraud Flags Card */}
          <Card className="p-4 bg-card border-border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-danger" /> Platform Fraud Flags
              </h3>
              <Badge variant={fraudFlags.length > 0 ? "danger" : "success"} className="text-[10px] font-bold">
                {fraudFlags.length} Flags
              </Badge>
            </div>

            {fraudFlags.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No active fraud markers, synthetic follower warnings, or dispute spikes detected.
              </p>
            ) : (
              <ul className="space-y-2">
                {fraudFlags.map((flag, idx) => (
                  <li
                    key={idx}
                    className="p-2.5 rounded-lg bg-danger/5 border border-danger-border text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-danger flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {flag.flag}
                      </span>
                      <Badge variant="danger" className="text-[9px] font-bold">
                        {flag.severity}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-[11px]">{flag.details}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Creator Metric Anomalies Card (P06) */}
          <Card className="p-4 bg-card border-border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-primary" /> Creator Metric Anomalies (P06)
              </h3>
              <Badge
                variant={creatorMetricAnomalies.length > 0 ? "warning" : "success"}
                className="text-[10px] font-bold"
              >
                {creatorMetricAnomalies.length} Markers
              </Badge>
            </div>

            {creatorMetricAnomalies.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                All participating creators exhibit normal distribution across followers and engagement rate.
              </p>
            ) : (
              <ul className="space-y-2">
                {creatorMetricAnomalies.map((anomaly, idx) => (
                  <li
                    key={idx}
                    className="p-2.5 rounded-lg bg-warning/5 border border-warning-border text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-warning flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" /> {anomaly.rule}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        @{anomaly.influencerHandle || anomaly.influencerName}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-[11px]">{anomaly.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>

      {/* 6. ESTIMATED VS API DATA SHARE */}
      <section aria-labelledby="quality-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="quality-heading" className="text-base font-bold text-foreground flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" /> Data Quality: API-Verified vs. Estimated Views
            </h2>
            <p className="text-xs text-muted-foreground">
              Every displayed metric is partitioned into API-measured and heuristic estimates.
            </p>
          </div>
          <Badge
            variant={dataQualityShare.dataQuality === "VERIFIED" ? "success" : "warning"}
            className="text-[10px] font-bold uppercase"
          >
            {dataQualityShare.dataQuality}
          </Badge>
        </div>

        <Card className="p-5 bg-card border-border space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Views Tracked</p>
              <p className="text-xl font-extrabold text-foreground mt-1">
                {dataQualityShare.totalViews.toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <p className="text-xs text-verified font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> API Verified Views
              </p>
              <p className="text-xl font-extrabold text-verified mt-1">
                {dataQualityShare.verifiedViews.toLocaleString("en-IN")} ({dataQualityShare.apiSharePercent}%)
              </p>
            </div>
            <div>
              <p className="text-xs text-warning font-medium flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Estimated / Heuristic Views
              </p>
              <p className="text-xl font-extrabold text-warning mt-1">
                {dataQualityShare.estimatedViews.toLocaleString("en-IN")} ({dataQualityShare.estimatedSharePercent}%)
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-verified">
                API Share: {dataQualityShare.apiSharePercent}% ({dataQualityShare.apiViewsShareBps} bps)
              </span>
              <span className="text-warning">Estimated Share: {dataQualityShare.estimatedSharePercent}%</span>
            </div>
            <div className="h-2.5 w-full bg-warning/20 rounded-full overflow-hidden flex">
              <div
                className="bg-verified h-full transition-all duration-300"
                style={{ width: `${dataQualityShare.apiSharePercent}%` }}
                role="progressbar"
                aria-valuenow={dataQualityShare.apiSharePercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="API Verified Views Proportion"
              />
            </div>
          </div>
        </Card>
      </section>

      {/* Official Branded Governance Report Modal */}
      <CampaignGovernanceReportModal
        campaignId={campaign.id}
        isOpen={showGovernanceReportModal}
        onClose={() => setShowGovernanceReportModal(false)}
      />
    </PageContainer>
  );
}
