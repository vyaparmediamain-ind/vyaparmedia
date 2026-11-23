"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ReportShell } from "./ReportShell";
import { CampaignGovernanceReportView } from "./CampaignGovernanceReportView";
import type { CampaignGovernanceReportData } from "@/services/campaign-governance-report.service";
import { Button } from "@/components/ui";
import { Download, AlertCircle, Loader2 } from "lucide-react";

interface Props {
  readonly campaignId: string;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function CampaignGovernanceReportModal({ campaignId, isOpen, onClose }: Props) {
  const [data, setData] = useState<CampaignGovernanceReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/reports/governance`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.error?.message || json.message || "Failed to load campaign governance report"
        );
      }
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (isOpen) {
      fetchReport();
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, fetchReport]);

  const handleDownloadCsv = () => {
    window.open(`/api/admin/campaigns/${campaignId}/reports/governance?format=csv`, "_blank");
  };

  if (!isOpen) return null;

  return (
    <ReportShell
      onClose={onClose}
      title="Administrative Campaign Governance Report"
      className="max-w-4xl"
    >
      {/* Top CSV Action Bar in Dialog (Hidden during print) */}
      <div className="flex items-center justify-between border-b border-border pb-4 mb-6 no-print">
        <div>
          <h2 className="text-sm font-bold text-foreground">Campaign Governance Report</h2>
          <p className="text-2xs text-muted-foreground">
            Print-ready administrative audit document with cryptographic integrity verification
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleDownloadCsv}
            disabled={loading || !data}
            className="gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </Button>
        </div>
      </div>

      {loading && (
        <div className="py-24 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-xs text-muted-foreground font-medium">
            Generating audited administrative governance report...
          </p>
        </div>
      )}

      {error && (
        <div className="p-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-center space-y-3 my-12">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-destructive">Report Generation Error</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
          </div>
          <Button onClick={fetchReport} variant="secondary" size="sm" disabled={loading}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && data && <CampaignGovernanceReportView data={data} />}
    </ReportShell>
  );
}
