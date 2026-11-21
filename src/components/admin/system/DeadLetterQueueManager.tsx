"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Button, Input, Badge } from "@/components/ui";
import { formatUserError } from "@/lib/user-messages";
import { formatDate } from "@/lib/utils-client";
import {
  RotateCcw,
  Trash2,
  RefreshCw,
  Search,
  Code2,
  CheckCircle2,
  Layers,
} from "lucide-react";

interface DeadLetterJobItem {
  id: string;
  topic: string;
  category: "TIME_CRITICAL" | "SCHEDULED" | "BEST_EFFORT";
  status: "FAILED" | "RETRYING" | "DISCARDED";
  payload: unknown;
  error?: string | null;
  attempts: number;
  lastAttemptAt?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  createdAt: string;
}

interface DlqApiResponse {
  success: boolean;
  total: number;
  jobs: DeadLetterJobItem[];
}

export default function DeadLetterQueueManager({
  showToast,
}: {
  showToast: (type: "success" | "error" | "info", msg: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [inspectJob, setInspectJob] = useState<DeadLetterJobItem | null>(null);

  const queryParams = new URLSearchParams();
  if (statusFilter !== "ALL") queryParams.set("status", statusFilter);
  queryParams.set("limit", "100");

  const { data, isLoading, mutate } = useSWR<DlqApiResponse>(
    `/api/admin/jobs/dlq?${queryParams.toString()}`,
    fetcher,
    { refreshInterval: 15000 }
  );

  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

  const filteredJobs = jobs.filter((job) => {
    if (!search.trim()) return true;
    return (
      job.topic.toLowerCase().includes(search.toLowerCase()) ||
      job.id.toLowerCase().includes(search.toLowerCase()) ||
      (job.error && job.error.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const handleAction = async (dlqId: string, action: "retry" | "discard") => {
    setActionLoadingId(dlqId);
    try {
      const res = await fetch("/api/admin/jobs/dlq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dlqId, action }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || resData.message || `Failed to ${action} job`);
      }

      showToast(
        "success",
        action === "retry"
          ? "Job re-enqueued to QStash queue successfully."
          : "Job marked as discarded."
      );
      mutate();
    } catch (err) {
      showToast("error", formatUserError(err, `Failed to ${action} job.`));
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "FAILED":
        return <Badge variant="danger">Failed</Badge>;
      case "RETRYING":
        return <Badge variant="warning">Retrying</Badge>;
      case "DISCARDED":
        return <Badge variant="ghost">Discarded</Badge>;
      default:
        return <Badge variant="primary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Top filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            placeholder="Search topic, job ID, or error message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 text-xs w-full"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs p-2.5 rounded-xl bg-card border border-border text-foreground"
          >
            <option value="ALL">All Statuses</option>
            <option value="FAILED">Failed</option>
            <option value="RETRYING">Retrying</option>
            <option value="DISCARDED">Discarded</option>
          </select>

          <Button
            variant="secondary"
            onClick={() => mutate()}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-bold min-h-[40px] px-3 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Failed Jobs in Queue</div>
            <div className="text-xl font-black text-danger mt-0.5">
              {jobs.filter((j) => j.status === "FAILED").length}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-danger/10 text-danger">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Auto-Retry Recovery</div>
            <div className="text-sm font-black text-foreground mt-1">QStash Exponential Backoff</div>
          </div>
          <Badge variant="ghost">QStash v2</Badge>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase">DLQ Retention</div>
            <div className="text-xs text-muted-foreground mt-1">Stored permanently for admin inspection</div>
          </div>
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Table / List */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted/30 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            {jobs.length === 0
              ? "All background jobs have processed cleanly. Dead-Letter Queue is empty."
              : "No failed jobs match your search filter."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs" aria-label="Dead letter queue jobs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-5 py-3.5">Topic / Category</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Error Message</th>
                  <th className="px-5 py-3.5">Attempts</th>
                  <th className="px-5 py-3.5">Failed Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredJobs.map((job) => {
                  const isActionLoading = actionLoadingId === job.id;
                  return (
                    <tr key={job.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-mono font-bold text-foreground">{job.topic}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{job.category}</div>
                      </td>
                      <td className="px-5 py-4">{getStatusBadge(job.status)}</td>
                      <td className="px-5 py-4 max-w-xs truncate text-muted-foreground font-mono" title={job.error || "No error detail"}>
                        {job.error || "Execution timeout or payload error"}
                      </td>
                      <td className="px-5 py-4 font-mono font-bold">{job.attempts}</td>
                      <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">
                        {formatDate(job.createdAt)}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap space-x-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInspectJob(job)}
                          className="text-xs"
                          title="Inspect payload & stack trace"
                        >
                          <Code2 className="w-3.5 h-3.5" />
                        </Button>

                        {job.status === "FAILED" && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleAction(job.id, "retry")}
                              disabled={isActionLoading}
                              className="text-xs font-bold text-emerald-400 hover:text-emerald-300"
                              title="Re-enqueue job"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Retry
                            </Button>

                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleAction(job.id, "discard")}
                              disabled={isActionLoading}
                              className="text-xs font-bold text-danger hover:text-danger-foreground"
                              title="Discard dead job"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Discard
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspect Job Payload Modal */}
      {inspectJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-foreground">DLQ Job Payload & Error Trace</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Job ID: <code className="font-mono text-primary">{inspectJob.id}</code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectJob(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold p-1 rounded-lg hover:bg-muted"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {inspectJob.error && (
              <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-xs">
                <span className="font-bold text-danger block mb-1">Error Trace:</span>
                <pre className="text-muted-foreground font-mono text-[11px] whitespace-pre-wrap overflow-x-auto">
                  {inspectJob.error}
                </pre>
              </div>
            )}

            <div>
              <span className="text-xs font-semibold text-foreground block mb-1">Payload:</span>
              <pre className="p-3 rounded-xl bg-muted/40 border border-border font-mono text-[11px] text-muted-foreground overflow-x-auto max-h-60">
                {JSON.stringify(inspectJob.payload, null, 2)}
              </pre>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" onClick={() => setInspectJob(null)}>
                Close
              </Button>
              {inspectJob.status === "FAILED" && (
                <Button
                  variant="primary"
                  onClick={() => {
                    handleAction(inspectJob.id, "retry");
                    setInspectJob(null);
                  }}
                  className="font-bold"
                >
                  <RotateCcw className="w-3 h-3 mr-1.5" />
                  Re-Dispatch to Queue
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
