"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Badge, Button, Input } from "@/components/ui";
import { formatUserError } from "@/lib/user-messages";
import { checkFeatureFlagMutationEligibility } from "@/lib/action-eligibility";
import type { FeatureFlagRecord } from "@/lib/feature-flags";
import {
  Flag,
  Percent,
  Users,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Sliders,
  AlertTriangle,
  Info,
} from "lucide-react";

interface FeatureFlagsApiResponse {
  success: boolean;
  message?: string;
  data: FeatureFlagRecord[];
}

interface FeatureFlagManagerProps {
  onShowToast: (type: "success" | "error" | "info", msg: string) => void;
}

const AVAILABLE_ROLES = ["ADMIN", "BRAND", "INFLUENCER", "SCOUT"] as const;

export default function FeatureFlagManager({ onShowToast }: Readonly<FeatureFlagManagerProps>) {
  const { data, isLoading, mutate } = useSWR<FeatureFlagsApiResponse>(
    "/api/admin/system/feature-flags",
    fetcher,
    { refreshInterval: 15000 },
  );

  const [search, setSearch] = useState("");
  const [filterEnabled, setFilterEnabled] = useState<"ALL" | "ENABLED" | "DISABLED">("ALL");

  // Editing modal state
  const [editingFlag, setEditingFlag] = useState<FeatureFlagRecord | null>(null);
  const [editEnabled, setEditEnabled] = useState(false);
  const [editPercent, setEditPercent] = useState(100);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editDescription, setEditDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Quick toggle confirmation state
  const [confirmToggleFlag, setConfirmToggleFlag] = useState<FeatureFlagRecord | null>(null);

  const flags = useMemo(() => {
    return Array.isArray(data?.data) ? data.data : [];
  }, [data]);

  const activeCount = useMemo(() => {
    return flags.filter((f) => f.enabled).length;
  }, [flags]);

  const filteredFlags = useMemo(() => {
    return flags.filter((f) => {
      const matchesFilter =
        filterEnabled === "ALL" ||
        (filterEnabled === "ENABLED" && f.enabled) ||
        (filterEnabled === "DISABLED" && !f.enabled);
      const matchesSearch =
        search.trim() === "" ||
        f.key.toLowerCase().includes(search.toLowerCase()) ||
        f.description.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [flags, filterEnabled, search]);

  const openEditModal = (flag: FeatureFlagRecord) => {
    setEditingFlag(flag);
    setEditEnabled(flag.enabled);
    setEditPercent(flag.rolloutPercent);
    setEditRoles(flag.allowRoles || []);
    setEditDescription(flag.description || "");
  };

  const closeEditModal = () => {
    setEditingFlag(null);
    setIsSaving(false);
  };

  const handleRoleToggle = (role: string) => {
    setEditRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  // Action-Button rule eligibility
  const mutationEligibility = useMemo(() => {
    return checkFeatureFlagMutationEligibility({
      isAdmin: true,
      isSaving,
    });
  }, [isSaving]);

  const handleSaveFlag = async () => {
    if (!editingFlag || !mutationEligibility.allowed) return;
    setIsSaving(true);

    try {
      const res = await fetch("/api/admin/system/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: editingFlag.key,
          enabled: editEnabled,
          rolloutPercent: Number(editPercent),
          allowRoles: editRoles,
          description: editDescription.trim(),
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || "Failed to update feature flag");
      }

      onShowToast(
        "success",
        `Feature flag '${editingFlag.key}' updated successfully.`,
      );
      closeEditModal();
      mutate();
    } catch (err) {
      onShowToast("error", formatUserError(err, "Failed to update feature flag configuration."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickToggle = async (flag: FeatureFlagRecord) => {
    setIsSaving(true);
    try {
      const nextEnabled = !flag.enabled;
      const res = await fetch("/api/admin/system/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: flag.key,
          enabled: nextEnabled,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || "Failed to toggle feature flag");
      }

      onShowToast(
        nextEnabled ? "success" : "info",
        `Feature flag '${flag.key}' is now ${nextEnabled ? "ENABLED" : "DISABLED"}.`,
      );
      setConfirmToggleFlag(null);
      mutate();
    } catch (err) {
      onShowToast("error", formatUserError(err, "Failed to toggle feature flag."));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-center gap-3 text-muted-foreground">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span className="text-sm font-medium">Loading feature flags...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="p-5 rounded-2xl bg-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
            <Flag className="w-6 h-6" />
          </div>
          <div>
            <div className="font-bold text-foreground text-sm flex items-center gap-2">
              Progressive Feature Flags
              <Badge variant="ghost" className="text-[10px] tabular-nums">
                {activeCount} of {flags.length} Active
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Control granular rollouts, canary cohorts, and role-based feature gating independently of releases.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => mutate()}
            disabled={!mutationEligibility.allowed}
            className="text-xs font-semibold gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "ALL", label: `All Flags (${flags.length})` },
            { id: "ENABLED", label: `Enabled (${activeCount})` },
            { id: "DISABLED", label: `Disabled (${flags.length - activeCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterEnabled(tab.id as typeof filterEnabled)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                filterEnabled === tab.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search flags..."
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Flags Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredFlags.map((flag) => (
          <div
            key={flag.key}
            className={`p-4 rounded-2xl border transition-all ${
              flag.enabled
                ? "bg-card border-verified-border/60 shadow-xs"
                : "bg-muted/40 border-border opacity-85"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-foreground break-all">
                    {flag.key}
                  </span>
                  {flag.enabled ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-verified bg-verified-muted px-2 py-0.5 rounded-full border border-verified-border">
                      <CheckCircle2 className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                      <XCircle className="w-3 h-3" />
                      Off
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {flag.description}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => openEditModal(flag)}
                  disabled={!mutationEligibility.allowed}
                  className="text-xs px-2.5 h-8 cursor-pointer"
                  title="Configure rollout parameters"
                >
                  <Sliders className="w-3.5 h-3.5 mr-1" />
                  <span>Configure</span>
                </Button>

                <Button
                  type="button"
                  variant={flag.enabled ? "secondary" : "primary"}
                  size="sm"
                  onClick={() => setConfirmToggleFlag(flag)}
                  disabled={!mutationEligibility.allowed}
                  className="text-xs px-2.5 h-8 cursor-pointer"
                >
                  {flag.enabled ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>

            {/* Metrics Footer */}
            <div className="mt-3.5 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
              <div className="flex items-center gap-1 text-[11px]">
                <Percent className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Rollout:</span>
                <span className="font-bold text-foreground tabular-nums">
                  {flag.rolloutPercent}%
                </span>
              </div>

              <div className="flex items-center gap-1 text-[11px]">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Roles:</span>
                {flag.allowRoles && flag.allowRoles.length > 0 ? (
                  <div className="flex items-center gap-1">
                    {flag.allowRoles.map((r) => (
                      <span
                        key={r}
                        className="px-1.5 py-0.2 rounded-md bg-muted text-[10px] font-bold text-foreground border border-border"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground font-medium">All Roles</span>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredFlags.length === 0 && (
          <div className="col-span-full p-8 rounded-2xl bg-card border border-border text-center space-y-2">
            <Info className="w-6 h-6 text-muted-foreground mx-auto" />
            <p className="text-xs font-semibold text-foreground">No feature flags found</p>
            <p className="text-xs text-muted-foreground">Try adjusting your search query or status filter.</p>
          </div>
        )}
      </div>

      {/* Quick Toggle Confirmation Modal */}
      {confirmToggleFlag && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-card border border-border shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-pending">
              <div className="p-2.5 rounded-xl bg-pending-muted border border-pending-border">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Confirm Flag State Change</h3>
                <p className="text-xs text-muted-foreground">
                  Flag: <span className="font-mono font-bold text-foreground">{confirmToggleFlag.key}</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to {confirmToggleFlag.enabled ? "DISABLE" : "ENABLE"} this feature flag?
              This will update the configuration and purge Redis edge caches immediately.
            </p>

            {!mutationEligibility.allowed && mutationEligibility.reason && (
              <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
                {mutationEligibility.reason}
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setConfirmToggleFlag(null)}
                disabled={isSaving}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={confirmToggleFlag.enabled ? "secondary" : "primary"}
                size="sm"
                onClick={() => handleQuickToggle(confirmToggleFlag)}
                disabled={!mutationEligibility.allowed}
                className="cursor-pointer font-bold"
              >
                {isSaving ? "Updating..." : confirmToggleFlag.enabled ? "Disable Feature" : "Enable Feature"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Configure Rollout Modal */}
      {editingFlag && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-card border border-border shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Configure Feature Rollout</h3>
                <p className="text-xs font-mono text-muted-foreground mt-0.5">{editingFlag.key}</p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Enable Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border">
                <div>
                  <span className="text-xs font-bold text-foreground block">Feature Activation Status</span>
                  <span className="text-[11px] text-muted-foreground">Master toggle for this capability</span>
                </div>
                <Button
                  type="button"
                  variant={editEnabled ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setEditEnabled((prev) => !prev)}
                  className="cursor-pointer text-xs"
                >
                  {editEnabled ? "Enabled" : "Disabled"}
                </Button>
              </div>

              {/* Rollout Percentage Slider & Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="rollout-percent-range" className="text-xs font-bold text-foreground">
                    Rollout Percentage ({editPercent}%)
                  </label>
                  <span className="text-[11px] text-muted-foreground">0% = Disabled, 100% = All Users</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="rollout-percent-range"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={editPercent}
                    onChange={(e) => setEditPercent(Number(e.target.value))}
                    className="flex-1 accent-primary cursor-pointer"
                  />
                  <Input
                    id="rollout-percent-number"
                    type="number"
                    min={0}
                    max={100}
                    value={editPercent}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val >= 0 && val <= 100) setEditPercent(val);
                    }}
                    className="w-20 text-xs text-center tabular-nums"
                  />
                </div>
              </div>

              {/* Role Allow-list Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">Permitted Roles</label>
                  <span className="text-[11px] text-muted-foreground">
                    {editRoles.length === 0 ? "All roles permitted" : "Restricted to selected"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_ROLES.map((role) => {
                    const isSelected = editRoles.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => handleRoleToggle(role)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-primary text-primary-foreground border border-primary shadow-xs"
                            : "bg-card border border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {role}
                      </button>
                    );
                  })}
                  {editRoles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setEditRoles([])}
                      className="px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                    >
                      Clear filters (Allow all)
                    </button>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label htmlFor="flag-description-input" className="text-xs font-bold text-foreground">
                  Description &amp; Rollout Notes
                </label>
                <Input
                  id="flag-description-input"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Explain feature purpose and release timeline"
                  className="text-xs"
                />
              </div>
            </div>

            {!mutationEligibility.allowed && mutationEligibility.reason && (
              <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
                {mutationEligibility.reason}
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={closeEditModal}
                disabled={isSaving}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSaveFlag}
                disabled={!mutationEligibility.allowed}
                className="cursor-pointer font-bold"
              >
                {isSaving ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
