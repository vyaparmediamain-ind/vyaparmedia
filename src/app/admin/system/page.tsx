"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PageContainer, PageHeader, Badge, Button, Input } from "@/components/ui";
import { useToasts, ToastContainer } from "@/components/ui";
import { formatUserError } from "@/lib/user-messages";
import type { KillSwitchItem } from "@/lib/kill-switch";
import {
  ShieldAlert,
  Power,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Wallet,
  Lock,
  Cloud,
  Search,
  Info,
  Shield,
  Layers,
} from "lucide-react";
import IpBlacklistManager from "@/components/admin/system/IpBlacklistManager";
import DeadLetterQueueManager from "@/components/admin/system/DeadLetterQueueManager";
import RegistrationGateManager from "@/components/admin/system/RegistrationGateManager";

interface KillSwitchesApiResponse {
  success: boolean;
  data: KillSwitchItem[];
}

export default function AdminKillSwitchesPage() {
  const { data, isLoading, mutate } = useSWR<KillSwitchesApiResponse>(
    "/api/admin/system/kill-switches",
    fetcher,
    { refreshInterval: 15000 }
  );

  const { toasts, showToast, removeToast } = useToasts();
  const [mainTab, setMainTab] = useState<"SWITCHES" | "BETA_GATE" | "FIREWALL" | "DLQ">("SWITCHES");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [updatingFeature, setUpdatingFeature] = useState<string | null>(null);

  // Confirmation modal state for engaging critical switches
  const [confirmModalItem, setConfirmModalItem] = useState<{
    item: KillSwitchItem;
    targetActive: boolean;
  } | null>(null);
  const [reasonInput, setReasonInput] = useState<string>("");

  const switches: KillSwitchItem[] = useMemo(() => {
    return Array.isArray(data?.data) ? data.data : [];
  }, [data]);

  const activeCount = useMemo(() => {
    return switches.filter((s) => s.active).length;
  }, [switches]);

  const filteredSwitches = useMemo(() => {
    return switches.filter((s) => {
      const matchesCategory =
        activeCategory === "ALL" || s.category === activeCategory;
      const matchesSearch =
        search.trim() === "" ||
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase()) ||
        s.feature.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [switches, activeCategory, search]);

  const handleToggle = async (item: KillSwitchItem, targetActive: boolean, reason?: string) => {
    setUpdatingFeature(item.feature);
    try {
      const res = await fetch("/api/admin/system/kill-switches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature: item.feature,
          active: targetActive,
          reason: reason || "Manual toggle via admin control dashboard",
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || "Failed to toggle circuit breaker");
      }

      showToast(
        targetActive ? "info" : "success",
        targetActive
          ? `⚠️ ${item.title} has been PAUSED. Circuit breaker engaged.`
          : `✅ ${item.title} has been RESUMED. Normal operation restored.`
      );
      mutate();
    } catch (err) {
      showToast("error", formatUserError(err, "Failed to update kill switch state."));
    } finally {
      setUpdatingFeature(null);
      setConfirmModalItem(null);
      setReasonInput("");
    }
  };

  const initiateToggle = (item: KillSwitchItem) => {
    const nextState = !item.active;
    // If activating a critical or high-severity switch, require confirmation
    if (nextState && (item.severity === "CRITICAL" || item.severity === "HIGH")) {
      setConfirmModalItem({ item, targetActive: true });
      return;
    }
    handleToggle(item, nextState);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return (
          <Badge variant="danger" className="text-[10px] font-black uppercase">
            Critical
          </Badge>
        );
      case "HIGH":
        return (
          <Badge variant="warning" className="text-[10px] font-black uppercase">
            High Severity
          </Badge>
        );
      default:
        return (
          <Badge variant="ghost" className="text-[10px] font-semibold uppercase">
            Standard
          </Badge>
        );
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "FINANCIAL":
        return <Wallet className="w-4 h-4 text-emerald-400" />;
      case "SECURITY":
        return <Lock className="w-4 h-4 text-primary" />;
      default:
        return <Cloud className="w-4 h-4 text-sky-400" />;
    }
  };

  return (
    <PageContainer maxWidth="7xl" className="space-y-6 py-2 sm:py-4">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Page Header */}
      <PageHeader
        icon={
          <div className="w-10 h-10 rounded-xl bg-danger/10 border border-danger/30 flex items-center justify-center">
            <Power className="w-5 h-5 text-danger" />
          </div>
        }
        title="Emergency Controls & Kill Switches"
        subtitle="Real-time operational circuit breakers. Instantly pause degraded vendors, payment gateways, or platform traffic."
        actions={
          <Button
            variant="secondary"
            onClick={() => mutate()}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-bold min-h-[44px] px-3.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh Status
          </Button>
        }
      />

      {/* Primary Section Switcher */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setMainTab("SWITCHES")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            mainTab === "SWITCHES"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Power className="w-4 h-4" />
          Circuit Breakers ({switches.length})
        </button>

        <button
          type="button"
          onClick={() => setMainTab("BETA_GATE")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            mainTab === "BETA_GATE"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Lock className="w-4 h-4" />
          Beta &amp; Referral Gate
        </button>

        <button
          type="button"
          onClick={() => setMainTab("FIREWALL")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            mainTab === "FIREWALL"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Shield className="w-4 h-4" />
          IP Firewall &amp; Bans
        </button>

        <button
          type="button"
          onClick={() => setMainTab("DLQ")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            mainTab === "DLQ"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="w-4 h-4" />
          Failed Queue Jobs (DLQ)
        </button>
      </div>

      {mainTab === "BETA_GATE" && <RegistrationGateManager onShowToast={showToast} />}

      {mainTab === "FIREWALL" && <IpBlacklistManager showToast={showToast} />}

      {mainTab === "DLQ" && <DeadLetterQueueManager showToast={showToast} />}

      {mainTab === "SWITCHES" && (
        <>
          {/* System Status Banner */}
          {activeCount > 0 ? (
            <div className="p-4 rounded-2xl bg-danger/10 border border-danger/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2.5 rounded-xl bg-danger/20 text-danger shrink-0 mt-0.5 sm:mt-0">
                  <ShieldAlert className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="font-bold text-foreground text-sm flex items-center gap-2">
                    Emergency Circuit Breakers Active
                    <Badge variant="danger" className="text-[10px]">
                      {activeCount} Subsystems Paused
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Certain platform endpoints are returning maintenance responses to protect funds and user accounts.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-foreground text-sm">
                  All 16 Subsystems Operational
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Escrow funds, withdrawals, registrations, and third-party vendors are running normally with zero circuit breaker halts.
                </p>
              </div>
            </div>
          )}

          {/* Filters and Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: "ALL", label: `All Switches (${switches.length})` },
                { id: "FINANCIAL", label: "Financial Controls" },
                { id: "SECURITY", label: "Security & Access" },
                { id: "VENDOR", label: "Vendor Integrations" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeCategory === tab.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                placeholder="Search circuit breakers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 text-xs w-full"
              />
            </div>
          </div>

          {/* Switches Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="p-5 rounded-2xl bg-card border border-border/50 animate-pulse space-y-4"
                >
                  <div className="h-4 bg-muted/40 rounded w-2/3" />
                  <div className="h-3 bg-muted/20 rounded w-full" />
                  <div className="h-8 bg-muted/30 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : filteredSwitches.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-card border border-border">
              <p className="text-sm font-semibold text-muted-foreground">No kill switches match your filter criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSwitches.map((item) => {
                const isUpdating = updatingFeature === item.feature;
                return (
                  <div
                    key={item.feature}
                    className={`flex flex-col justify-between p-5 rounded-2xl border transition-all ${
                      item.active
                        ? "bg-danger/5 border-danger/40 shadow-sm"
                        : "bg-card border-border hover:border-primary/30"
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Top Bar: Category, Severity, and Status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {getCategoryIcon(item.category)}
                          <span className="font-semibold text-[11px]">{item.categoryLabel}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {getSeverityBadge(item.severity)}
                          {item.active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-danger text-danger-foreground animate-pulse">
                              PAUSED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              LIVE
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title & Key */}
                      <div>
                        <h3 className="font-bold text-foreground text-sm tracking-tight">
                          {item.title}
                        </h3>
                        <code className="text-[10px] text-muted-foreground font-mono block mt-0.5">
                          {item.feature}
                        </code>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {item.description}
                      </p>

                      {/* Impact Note */}
                      {item.impact && (
                        <div className="p-2.5 rounded-xl bg-muted/40 border border-border text-[11px] text-muted-foreground flex items-start gap-2">
                          <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                          <span>{item.impact}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Toggle */}
                    <div className="pt-4 mt-4 border-t border-border flex items-center justify-between gap-3">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        State:{" "}
                        <strong className={item.active ? "text-danger" : "text-emerald-400"}>
                          {item.active ? "Traffic Blocked" : "Active & Accepting"}
                        </strong>
                      </span>

                      <Button
                        variant={item.active ? "success" : "danger"}
                        size="sm"
                        onClick={() => initiateToggle(item)}
                        disabled={isUpdating}
                        className="min-h-[38px] px-3.5 font-bold text-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <Power className="w-3 h-3" />
                        {isUpdating
                          ? "Updating..."
                          : item.active
                          ? "Resume Service"
                          : "Pause (Engage)"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Critical Switch Confirmation Modal */}
      {confirmModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-danger/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-danger/20 text-danger shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Confirm Emergency Circuit Breaker
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Are you sure you want to pause <strong>{confirmModalItem.item.title}</strong>?
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/30 text-xs text-foreground space-y-1.5">
              <p className="font-semibold text-danger">Immediate Operational Consequence:</p>
              <p className="text-muted-foreground leading-relaxed">
                {confirmModalItem.item.description}
              </p>
              <p className="text-muted-foreground text-[11px]">
                Active user requests attempting to trigger this action will immediately receive HTTP 503 Service Paused responses.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="killswitch-reason" className="text-xs font-semibold text-foreground block">
                Reason for engaging circuit breaker (Audit Log)
              </label>
              <Input
                id="killswitch-reason"
                placeholder="e.g. Gateway outage, routine ledger reconciliation, or fraud mitigation"
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                onClick={() => {
                  setConfirmModalItem(null);
                  setReasonInput("");
                }}
                disabled={Boolean(updatingFeature)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() =>
                  handleToggle(
                    confirmModalItem.item,
                    confirmModalItem.targetActive,
                    reasonInput
                  )
                }
                disabled={Boolean(updatingFeature)}
                className="font-bold cursor-pointer"
              >
                {updatingFeature ? "Engaging..." : "Confirm & Engage Switch"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
