"use client";

import React from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { ShieldCheck, AlertTriangle, RefreshCw, BarChart2, Radio } from "lucide-react";
import { Button } from "@/components/ui";

interface SocialInsightsApiResponse {
  success: boolean;
  data: {
    total: number;
    active: number;
    insightsActive: number;
    insightsMissing: number;
    unknownScope?: number;
    personalAccount?: number;
    needsReconnect: number;
  };
}

export default function InstagramInsightsCard() {
  const { data, error, isLoading, mutate } = useSWR<SocialInsightsApiResponse>(
    "/api/admin/system/social-insights",
    fetcher,
    { refreshInterval: 30000 },
  );

  const stats = data?.data;

  return (
    <div className="card space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-verified-muted/60 text-verified">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">
              Instagram Insights Scope Status
            </h2>
            <p className="text-xs text-muted-foreground">
              Live census of creator Instagram connections & Meta Insights permissions
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          className="text-xs flex items-center gap-1.5"
          onClick={() => mutate()}
          disabled={isLoading}
          aria-label="Refresh Instagram insights telemetry"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
          Failed to load Instagram insights telemetry. Please check database connectivity.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-secondary/50 border border-border">
            <div className="text-xs text-muted-foreground font-medium mb-1">
              Total Accounts
            </div>
            <div className="text-2xl font-extrabold text-foreground tabular-nums">
              {isLoading ? "..." : (stats?.total ?? 0)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              All linked Instagram rows
            </div>
          </div>

          <div className="p-4 rounded-xl bg-verified-muted/40 border border-verified-border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-verified font-medium">Insights Active</span>
              <ShieldCheck className="w-4 h-4 text-verified" />
            </div>
            <div className="text-2xl font-extrabold text-verified tabular-nums">
              {isLoading ? "..." : (stats?.insightsActive ?? 0)}
            </div>
            <div className="text-[11px] text-verified/80 mt-0.5">
              Verified views enabled
            </div>
          </div>

          <div className="p-4 rounded-xl bg-escrow-muted/40 border border-escrow-border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-escrow font-medium">Insights Missing</span>
              <BarChart2 className="w-4 h-4 text-escrow" />
            </div>
            <div className="text-2xl font-extrabold text-escrow tabular-nums">
              {isLoading ? "..." : (stats?.insightsMissing ?? 0)}
            </div>
            <div className="text-[11px] text-escrow/80 mt-0.5">
              Basic scope only (estimated)
            </div>
          </div>

          <div className="p-4 rounded-xl bg-pending-muted/40 border border-pending-border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-pending font-medium">Needs Reconnect</span>
              <AlertTriangle className="w-4 h-4 text-pending" />
            </div>
            <div className="text-2xl font-extrabold text-pending tabular-nums">
              {isLoading ? "..." : (stats?.needsReconnect ?? 0)}
            </div>
            <div className="text-[11px] text-pending/80 mt-0.5">
              Expired or revoked tokens
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
