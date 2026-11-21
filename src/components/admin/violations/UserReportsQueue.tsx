"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Button, Badge } from "@/components/ui";
import { formatDate } from "@/lib/utils-client";
import { formatUserError } from "@/lib/user-messages";
import {
  UserX,
  RefreshCw,
  Search,
  Flag,
  AlertTriangle,
} from "lucide-react";

interface UserReportItem {
  id: string;
  reason: string;
  description?: string | null;
  createdAt: string;
  reporter: {
    id: string;
    email: string;
    userType: string;
    influencerProfile?: { displayName: string | null } | null;
    brandProfile?: { companyName: string | null } | null;
  };
  reported: {
    id: string;
    email: string;
    userType: string;
    status: string;
    trustScore: number;
    influencerProfile?: { displayName: string | null; avatar: string | null } | null;
    brandProfile?: { companyName: string | null; logo: string | null } | null;
  };
}

interface UserReportsResponse {
  success: boolean;
  total: number;
  data: UserReportItem[];
}

export default function UserReportsQueue({
  showToast,
}: {
  showToast: (type: "success" | "error" | "info", msg: string) => void;
}) {
  const { data, isLoading, mutate } = useSWR<UserReportsResponse>(
    "/api/admin/user-reports",
    fetcher,
    { refreshInterval: 15000 }
  );

  const [search, setSearch] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [banConfirmReport, setBanConfirmReport] = useState<UserReportItem | null>(null);
  const [banReason, setBanReason] = useState("");

  const reports = Array.isArray(data?.data) ? data.data : [];

  const filteredReports = reports.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const reporterName = r.reporter.influencerProfile?.displayName || r.reporter.brandProfile?.companyName || r.reporter.email;
    const reportedName = r.reported.influencerProfile?.displayName || r.reported.brandProfile?.companyName || r.reported.email;
    return (
      reporterName.toLowerCase().includes(q) ||
      reportedName.toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q))
    );
  });

  const handleResolve = async (reportId: string, action: "DISMISS" | "BAN_USER", reason?: string) => {
    setActionLoadingId(reportId);
    try {
      const res = await fetch("/api/admin/user-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, action, banReason: reason }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || "Failed to resolve report");
      }

      showToast("success", resData.message || "Report processed successfully.");
      setBanConfirmReport(null);
      setBanReason("");
      mutate();
    } catch (err) {
      showToast("error", formatUserError(err, "Failed to resolve user report."));
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action / Search bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            placeholder="Search report reason, reporter or reported user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-10 pr-3.5 py-2.5 rounded-xl bg-card border border-border text-foreground"
          />
        </div>

        <Button
          variant="secondary"
          onClick={() => mutate()}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs font-bold min-h-[40px] px-3.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh Queue
        </Button>
      </div>

      {/* Reports List */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            {reports.length === 0
              ? "No pending user harassment or fraud reports. Platform community is healthy."
              : "No reports match your search query."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs" aria-label="Community user reports">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-5 py-3.5">Reported Account</th>
                  <th className="px-5 py-3.5">Reported By</th>
                  <th className="px-5 py-3.5">Reason &amp; Description</th>
                  <th className="px-5 py-3.5">Submitted</th>
                  <th className="px-5 py-3.5 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredReports.map((r) => {
                  const isActionLoading = actionLoadingId === r.id;
                  const reportedName =
                    r.reported.influencerProfile?.displayName ||
                    r.reported.brandProfile?.companyName ||
                    r.reported.email;
                  const reporterName =
                    r.reporter.influencerProfile?.displayName ||
                    r.reporter.brandProfile?.companyName ||
                    r.reporter.email;

                  return (
                    <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <span>{reportedName}</span>
                          <Badge variant="primary" className="text-[9px] uppercase px-1 py-0">
                            {r.reported.userType}
                          </Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          Trust: {r.reported.trustScore}/900 &bull; {r.reported.email}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-semibold text-foreground">{reporterName}</div>
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {r.reporter.userType} &bull; {r.reporter.email}
                        </div>
                      </td>

                      <td className="px-5 py-4 max-w-sm">
                        <div className="font-semibold text-danger flex items-center gap-1">
                          <Flag className="w-3 h-3 text-danger shrink-0" />
                          <span>{r.reason}</span>
                        </div>
                        {r.description && (
                          <p className="text-muted-foreground text-[11px] mt-1 leading-relaxed bg-muted/30 p-2 rounded-lg border border-border/50">
                            "{r.description}"
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">
                        {formatDate(r.createdAt)}
                      </td>

                      <td className="px-5 py-4 text-right whitespace-nowrap space-x-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResolve(r.id, "DISMISS")}
                          disabled={isActionLoading}
                          className="text-xs text-muted-foreground hover:text-foreground"
                          title="Dismiss report as invalid / no action required"
                        >
                          Dismiss
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setBanConfirmReport(r)}
                          disabled={isActionLoading || r.reported.status === "BANNED"}
                          className="text-xs font-bold text-danger hover:text-danger-foreground hover:bg-danger"
                          title="Ban reported user"
                        >
                          <UserX className="w-3 h-3 mr-1" />
                          {r.reported.status === "BANNED" ? "Already Banned" : "Ban User"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ban confirmation modal */}
      {banConfirmReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-danger/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-danger/20 text-danger shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Confirm Account Suspension / Ban</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Are you sure you want to ban <strong>{banConfirmReport.reported.email}</strong>?
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-xs">
              <span className="font-bold text-danger block mb-0.5">Report Reason:</span>
              <p className="text-muted-foreground">{banConfirmReport.reason}</p>
            </div>

            <div>
              <label htmlFor="user-ban-reason" className="text-xs font-semibold text-foreground block mb-1">
                Enforcement Note / Reason
              </label>
              <input
                id="user-ban-reason"
                type="text"
                placeholder="e.g. Terms violation - harassment and off-platform payment solicitation"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl bg-card border border-border text-foreground"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                onClick={() => setBanConfirmReport(null)}
                disabled={Boolean(actionLoadingId)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => handleResolve(banConfirmReport.id, "BAN_USER", banReason)}
                disabled={Boolean(actionLoadingId)}
                className="font-bold"
              >
                {actionLoadingId ? "Banning..." : "Confirm & Ban Account"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
