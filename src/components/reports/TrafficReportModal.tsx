"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ReportShell } from "./ReportShell";
import { TrafficReportView } from "./TrafficReportView";
import { Button } from "@/components/ui";
import { Download, AlertCircle, Loader2 } from "lucide-react";
import type { TrafficReportData, TrafficRangeDays } from "@/lib/traffic-analytics";
import type { ReportMeta } from "@/lib/report-meta";

interface TrafficReportModalProps {
  readonly range: TrafficRangeDays;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

interface ApiTrafficResponse {
  meta: ReportMeta;
  report: TrafficReportData;
}

export function TrafficReportModal({ range, isOpen, onClose }: TrafficReportModalProps) {
  const [data, setData] = useState<ApiTrafficResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/traffic?range=${range}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.message || "Failed to load traffic report");
      }
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    if (isOpen) {
      fetchReport();
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, fetchReport]);

  const handleDownloadCsv = () => {
    window.open(`/api/admin/reports/traffic?range=${range}&format=csv`, "_blank");
  };

  if (!isOpen) return null;

  return (
    <ReportShell
      onClose={onClose}
      title="Platform Traffic Report Preview"
      className="max-w-4xl"
    >
      {/* Top CSV Action Bar in Dialog (Hidden during print) */}
      <div className="flex items-center justify-between border-b border-border pb-4 mb-6 no-print">
        <div>
          <h2 className="text-sm font-bold text-foreground">Platform Traffic & User Behaviour</h2>
          <p className="text-2xs text-muted-foreground">
            Print-ready administrative document with cryptographic payload verification
          </p>
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
        </div>
      </div>

      {loading && (
        <div className="p-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-xs font-bold font-mono">Generating certified traffic report...</span>
        </div>
      )}

      {error && (
        <div className="p-8 rounded-2xl border border-disputed-border bg-disputed-muted text-disputed text-center space-y-3">
          <AlertCircle className="w-8 h-8 mx-auto" />
          <div className="text-sm font-bold">Unable to generate Platform Traffic Report</div>
          <p className="text-xs opacity-90 max-w-md mx-auto">{error}</p>
          <Button
            size="sm"
            variant="secondary"
            onClick={fetchReport}
            disabled={loading}
            className="text-xs"
          >
            Retry Report
          </Button>
        </div>
      )}

      {!loading && !error && data && (
        <TrafficReportView meta={data.meta} data={data.report} />
      )}
    </ReportShell>
  );
}
