"use client";

import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import { Skeleton, Button, PageHeader } from "@/components/ui";
import { CampaignRoiReport, type RoiReportData } from "@/components/dashboard/campaigns/CampaignRoiReport";

interface RoiClientProps {
  campaignId: string;
}

export function RoiClient({ campaignId }: RoiClientProps) {
  const [data, setData] = useState<RoiReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoi = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.campaigns.getRoiReport(campaignId);
      if (res && res.data) {
        setData(res.data);
      } else {
        throw new Error("Unable to retrieve campaign ROI analytics");
      }
    } catch (err: unknown) {
      setError(formatUserError(err, "Failed to load campaign ROI metrics. Please verify campaign ownership."));
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchRoi();
  }, [fetchRoi]);

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      {/* Navigation Breadcrumb & Page Header */}
      <PageHeader
        title="Campaign ROI & Telemetry"
        subtitle="Audited financial returns, real-time attribution, and creator performance analytics."
        backHref={`/dashboard/campaigns/${campaignId}`}
        backLabel="Back to Campaign Workspace"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchRoi}
            disabled={loading}
            className="text-xs font-semibold gap-1.5"
            title="Refresh real-time analytics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Sync Realtime</span>
          </Button>
        }
      />

      {loading && (
        <div className="space-y-6 animate-pulse">
          <div className="space-y-2">
            <Skeleton className="h-8 w-72 rounded-lg" />
            <Skeleton className="h-4 w-96 rounded-md" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
          </div>
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      )}

      {error && !loading && (
        <div className="p-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-destructive">Analytics Load Error</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
          </div>
          <Button onClick={fetchRoi} variant="secondary" size="sm">
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && data && (
        <CampaignRoiReport data={data} campaignId={campaignId} onRefresh={fetchRoi} />
      )}
    </div>
  );
}
