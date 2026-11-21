"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Button, Input, Badge } from "@/components/ui";
import { formatUserError } from "@/lib/user-messages";
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Plus,
  Trash2,
  Clock,
  RefreshCw,
  AlertTriangle,
  Lock,
} from "lucide-react";

interface BannedIpItem {
  ip: string;
  reason?: string;
  bannedAt?: string;
  ttlSeconds?: number;
  expiresAt?: string;
}

interface IpBlacklistResponse {
  success: boolean;
  total: number;
  bannedIps: BannedIpItem[];
}

export default function IpBlacklistManager({
  showToast,
}: {
  showToast: (type: "success" | "error" | "info", msg: string) => void;
}) {
  const { data, isLoading, mutate } = useSWR<IpBlacklistResponse>(
    "/api/admin/ip-blacklist",
    fetcher,
    { refreshInterval: 15000 }
  );

  const [search, setSearch] = useState("");
  const [showBanModal, setShowBanModal] = useState(false);
  const [newIp, setNewIp] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newDuration, setNewDuration] = useState("86400"); // 24 hours
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unbanningIp, setUnbanningIp] = useState<string | null>(null);

  const bannedIps = Array.isArray(data?.bannedIps) ? data.bannedIps : [];

  const filteredIps = bannedIps.filter((item) => {
    if (!search.trim()) return true;
    return (
      item.ip.toLowerCase().includes(search.toLowerCase()) ||
      (item.reason && item.reason.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const handleBanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIp.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/ip-blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip: newIp.trim(),
          reason: newReason.trim() || "Manual security ban via admin firewall",
          durationSeconds: Number(newDuration) || 86400,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || resData.message || "Failed to ban IP");
      }

      showToast("success", `IP ${newIp.trim()} has been banned immediately.`);
      setShowBanModal(false);
      setNewIp("");
      setNewReason("");
      setNewDuration("86400");
      mutate();
    } catch (err) {
      showToast("error", formatUserError(err, "Failed to ban IP address."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnban = async (ip: string) => {
    if (!confirm(`Are you sure you want to lift the security ban on IP ${ip}?`)) return;

    setUnbanningIp(ip);
    try {
      const res = await fetch("/api/admin/ip-blacklist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || resData.message || "Failed to unban IP");
      }

      showToast("success", `IP ${ip} ban lifted successfully.`);
      mutate();
    } catch (err) {
      showToast("error", formatUserError(err, "Failed to unban IP address."));
    } finally {
      setUnbanningIp(null);
    }
  };

  const formatRemainingTime = (ttlSeconds?: number) => {
    if (!ttlSeconds || ttlSeconds <= 0) return "Permanent / Expired";
    const hours = Math.floor(ttlSeconds / 3600);
    const mins = Math.floor((ttlSeconds % 3600) / 60);
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h remaining`;
    }
    if (hours > 0) return `${hours}h ${mins}m remaining`;
    return `${mins}m remaining`;
  };

  return (
    <div className="space-y-5">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            placeholder="Search banned IP or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 text-xs w-full"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => mutate()}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-bold min-h-[40px] px-3 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            variant="danger"
            onClick={() => setShowBanModal(true)}
            className="flex items-center gap-1.5 text-xs font-bold min-h-[40px] px-4 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Ban IP Address
          </Button>
        </div>
      </div>

      {/* Stats summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Active Banned IPs</div>
            <div className="text-xl font-black text-foreground mt-0.5">{bannedIps.length}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-danger/10 text-danger">
            <Lock className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Firewall WAF Status</div>
            <div className="text-sm font-black text-emerald-400 mt-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Redis Edge WAF Active
            </div>
          </div>
          <Badge variant="success">Enforcing</Badge>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Attacker Fast-Fail</div>
            <div className="text-xs text-muted-foreground mt-1">Zero latency drop on 403 Forbidden</div>
          </div>
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <ShieldAlert className="w-4 h-4" />
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
        ) : filteredIps.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            {bannedIps.length === 0
              ? "No IPs are currently banned. Platform firewall is clean."
              : "No banned IPs match your search filter."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs" aria-label="Banned IP addresses">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-5 py-3.5">IP Address</th>
                  <th className="px-5 py-3.5">Ban Reason</th>
                  <th className="px-5 py-3.5">TTL / Remaining Duration</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredIps.map((item) => (
                  <tr key={item.ip} className="hover:bg-muted/10 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-foreground">
                      {item.ip}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground max-w-xs truncate" title={item.reason}>
                      {item.reason || "Manual ban"}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-warning bg-warning/10 px-2 py-0.5 rounded-md">
                        <Clock className="w-3 h-3" />
                        {formatRemainingTime(item.ttlSeconds)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleUnban(item.ip)}
                        disabled={unbanningIp === item.ip}
                        className="text-xs font-bold text-danger hover:text-danger-foreground hover:bg-danger cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        {unbanningIp === item.ip ? "Unbanning..." : "Lift Ban"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ban IP Modal */}
      {showBanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-danger/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-danger/20 text-danger shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Manually Ban IP Address</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Block an abusive IPv4 or IPv6 address across all platform APIs instantly.
                </p>
              </div>
            </div>

            <form onSubmit={handleBanSubmit} className="space-y-3.5 pt-1">
              <div>
                <label htmlFor="banned-ip" className="text-xs font-semibold text-foreground block mb-1">
                  IP Address (IPv4 or IPv6)
                </label>
                <Input
                  id="banned-ip"
                  placeholder="e.g. 103.21.244.0 or 2405:201:..."
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor="banned-duration" className="text-xs font-semibold text-foreground block mb-1">
                  Ban Duration
                </label>
                <select
                  id="banned-duration"
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-card border border-border text-foreground"
                >
                  <option value="3600">1 Hour (Temporary Cool-off)</option>
                  <option value="86400">24 Hours (Standard Day Ban)</option>
                  <option value="604800">7 Days (Severe Repeated Abuse)</option>
                  <option value="2592000">30 Days (One Month)</option>
                  <option value="31536000">1 Year (Long-term Hard Ban)</option>
                </select>
              </div>

              <div>
                <label htmlFor="banned-reason" className="text-xs font-semibold text-foreground block mb-1">
                  Reason / Threat Category (Audit Trail)
                </label>
                <Input
                  id="banned-reason"
                  placeholder="e.g. Malicious OTP flooding, brute force login attempt"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowBanModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="danger" disabled={isSubmitting} className="font-bold">
                  {isSubmitting ? "Banning..." : "Apply Firewall Ban"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
