"use client";

import React from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Clock, ShieldCheck, AlertTriangle, RefreshCw, Activity } from "lucide-react";
import { Button, Badge } from "@/components/ui";

interface CronHeartbeatItem {
  id: string;
  name: string;
  path: string;
  cron: string;
  status: "SUCCESS" | "FAILED" | "PENDING" | "RUNNING";
  lastRunIst: string | null;
  durationMs: number | null;
  error: string | null;
  isDelayed: boolean;
}

interface CronHealthApiResponse {
  success: boolean;
  data: {
    overallStatus: "HEALTHY" | "DEGRADED" | "CRITICAL";
    jobs: CronHeartbeatItem[];
    failingJobsCount: number;
  };
}

export default function CronHeartbeatsCard() {
  const { data, isLoading, mutate } = useSWR<CronHealthApiResponse>(
    "/api/admin/system/cron-health",
    fetcher,
    { refreshInterval: 20000 },
  );

  const health = data?.data;
  const jobs = health?.jobs ?? [];
  const failingCount = health?.failingJobsCount ?? 0;

  const getStatusBadge = (status: string, isDelayed: boolean) => {
    if (status === "SUCCESS" && !isDelayed) {
      return (
        <Badge variant="success" className="text-[10px] font-bold">
          HEALTHY
        </Badge>
      );
    }
    if (status === "FAILED") {
      return (
        <Badge variant="danger" className="text-[10px] font-bold">
          FAILED
        </Badge>
      );
    }
    if (isDelayed) {
      return (
        <Badge variant="warning" className="text-[10px] font-bold">
          OVERDUE
        </Badge>
      );
    }
    return (
      <Badge variant="ghost" className="text-[10px] font-semibold">
        {status}
      </Badge>
    );
  };

  return (
    <div className="card space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">
                Background Cron Health &amp; Heartbeats
              </h2>
              {health && (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    health.overallStatus === "HEALTHY"
                      ? "bg-verified/15 text-verified"
                      : health.overallStatus === "DEGRADED"
                        ? "bg-amber-500/15 text-amber-600"
                        : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {health.overallStatus === "HEALTHY" ? (
                    <ShieldCheck className="w-3 h-3" />
                  ) : (
                    <AlertTriangle className="w-3 h-3" />
                  )}
                  {health.overallStatus}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Last execution times, duration, and SLA heartbeat verification across all 21 scheduled jobs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {failingCount > 0 && (
            <Badge variant="danger" className="text-xs">
              {failingCount} {failingCount === 1 ? "Job Failing" : "Jobs Failing"}
            </Badge>
          )}
          <Button
            variant="secondary"
            className="text-xs flex items-center gap-1.5"
            onClick={() => mutate()}
            disabled={isLoading}
            aria-label="Refresh cron heartbeats"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {jobs.length > 0 ? (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2.5 px-3 font-semibold">Job Name</th>
                <th className="py-2.5 px-3 font-semibold">Schedule</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold text-right">Duration</th>
                <th className="py-2.5 px-3 font-semibold text-right">Last Execution (IST)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-muted/40 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-foreground">
                    <div>{job.name}</div>
                    <div className="text-[11px] font-mono text-muted-foreground">{job.path}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-muted-foreground">
                    {job.cron}
                  </td>
                  <td className="py-2.5 px-3">
                    {getStatusBadge(job.status, job.isDelayed)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-muted-foreground">
                    {job.durationMs !== null ? `${job.durationMs}ms` : "-"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-muted-foreground">
                    {job.lastRunIst || (
                      <span className="text-muted-foreground/60 flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" /> Awaiting run
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-6 text-xs text-muted-foreground">
          {isLoading ? "Loading cron heartbeats..." : "No cron heartbeat data available."}
        </div>
      )}
    </div>
  );
}
