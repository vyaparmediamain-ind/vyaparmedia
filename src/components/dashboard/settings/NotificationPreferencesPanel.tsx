"use client";

import React, { useState, useEffect } from "react";
import { logger } from "@/lib/logger-client";
import {
  Mail,
  MessageSquare,
  Smartphone,
  Wallet,
  Briefcase,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Send,
} from "lucide-react";

import { Button, ConfirmationBadge } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import {
  GranularNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationCategory,
  NotificationChannel,
} from "@/lib/notification-preferences-types";

export interface NotificationPreferences {
  email: {
    marketing: boolean;
    updates: boolean;
    security: boolean;
  };
  push: {
    marketing: boolean;
    updates: boolean;
    security: boolean;
  };
}

export interface NotificationPreferencesPanelProps {
  onSaved?: () => void;
}

interface CategoryConfig {
  id: NotificationCategory;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isCritical?: boolean;
}

const CATEGORIES: CategoryConfig[] = [
  {
    id: "payments",
    label: "Payments & Escrow",
    description: "Escrow deposits, milestone releases, wallet payouts, and fee receipts",
    icon: Wallet,
    isCritical: true,
  },
  {
    id: "deals",
    label: "Deals & Contracts",
    description: "Campaign invitations, deal acceptance, content approval, and reviews",
    icon: Briefcase,
    isCritical: true,
  },
  {
    id: "messages",
    label: "Direct Messages",
    description: "New client chats, inquiries, and negotiation messages",
    icon: MessageSquare,
  },
  {
    id: "disputes",
    label: "Disputes & Claims",
    description: "Dispute opened, counter-evidence requested, and arbitration resolutions",
    icon: AlertCircle,
    isCritical: true,
  },
  {
    id: "security",
    label: "Account & Security",
    description: "New device logins, KYC verification results, password alerts, and tax compliance",
    icon: ShieldCheck,
    isCritical: true,
  },
];

export default function NotificationPreferencesPanel({
  onSaved,
}: Readonly<NotificationPreferencesPanelProps> = {}) {
  const [matrix, setMatrix] = useState<GranularNotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");

  // Check browser push permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  // Fetch current user preferences
  useEffect(() => {
    async function loadPreferences() {
      try {
        const data = await apiClient.settings.getNotificationPrefs() as { preferences?: typeof matrix };
        if (data.preferences) {
          setMatrix(data.preferences);
        }
      } catch {
        // Fallback to default
      }
    }
    loadPreferences();
  }, []);

  const handleCellToggle = (category: NotificationCategory, channel: NotificationChannel) => {
    setMatrix((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [channel]: !prev[category][channel],
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      await apiClient.settings.saveNotificationPrefs({ preferences: matrix });
      setSaveStatus("Preferences saved successfully!");
      if (onSaved) {
        onSaved();
      }
    } catch {
      setSaveStatus("Failed to save preferences.");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  const handleRequestPushPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      logger.warn("[NotificationPreferences] Push notifications not supported in this browser");
      setSaveStatus("Push notifications are not supported in your browser.");
      setTimeout(() => setSaveStatus(null), 5000);
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      setPushPermission(perm);

      if (perm === "granted" && "serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        try {
          const res = await fetch("/api/notifications/push-subscription");
          if (res.ok) {
            const data = await res.json();
            const vapidPublicKey = data?.vapidPublicKey;

            if (vapidPublicKey && registration.pushManager) {
              const padding = "=".repeat((4 - (vapidPublicKey.length % 4)) % 4);
              const base64 = (vapidPublicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
              const rawData = window.atob(base64);
              const outputArray = new Uint8Array(rawData.length);
              for (let i = 0; i < rawData.length; ++i) {
                outputArray[i] = rawData.charCodeAt(i);
              }

              const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: outputArray,
              });

              const p256dhKey = sub.getKey("p256dh");
              const authKey = sub.getKey("auth");

              if (p256dhKey && authKey) {
                const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))));
                const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))));

                await apiClient.settings.savePushSubscription({
                  endpoint: sub.endpoint,
                  keys: { p256dh, auth },
                  userAgent: navigator.userAgent,
                });
              }
            }
          }
        } catch (subErr) {
          logger.warn("[NotificationPreferences] Web Push subscription registration failed", { error: String(subErr) });
        }
      }
    } catch (err) {
      logger.warn("[NotificationPreferences] Push permission request error", { error: String(err) });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Web Push PWA Status Banner */}
      <div className="p-4 rounded-2xl bg-muted/30 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">Web Push Notifications (PWA)</span>
              {pushPermission === "granted" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Active</span>
                </span>
              ) : pushPermission === "denied" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                  <span>Blocked in Browser</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <span>Permission Required</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Enables background notifications for payments, deal confirmations, and disputes even when app is closed.
            </p>
          </div>
        </div>

        {pushPermission !== "granted" && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleRequestPushPermission}
            className="text-xs font-semibold shrink-0"
          >
            Enable Web Push
          </Button>
        )}
      </div>

      {/* Granular Matrix Table */}
      <div className="bg-card border border-border/80 rounded-2xl shadow-sm overflow-hidden">
        {/* Header Row (Desktop/Tablet) */}
        <div className="hidden sm:grid sm:grid-cols-12 bg-muted/40 border-b border-border/80 p-3.5 text-xs font-bold text-muted-foreground">
          <div className="col-span-6 uppercase tracking-wider text-[11px]">
            Event Category
          </div>
          <div className="flex col-span-2 items-center justify-center gap-1">
            <Smartphone className="w-3.5 h-3.5 text-primary" />
            <span>Push</span>
          </div>
          <div className="flex col-span-2 items-center justify-center gap-1">
            <Mail className="w-3.5 h-3.5 text-indigo-500" />
            <span>Email</span>
          </div>
          <div className="flex col-span-2 items-center justify-center gap-1">
            <Send className="w-3.5 h-3.5 text-purple-500" />
            <span>In-App</span>
          </div>
        </div>

        <div className="divide-y divide-border/60">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const values = matrix[cat.id] || DEFAULT_NOTIFICATION_PREFERENCES[cat.id];

            return (
              <div
                key={cat.id}
                className="flex flex-col sm:grid sm:grid-cols-12 items-start sm:items-center p-4 gap-4 hover:bg-muted/20 transition-colors"
              >
                {/* Category Info */}
                <div className="w-full sm:col-span-6 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-muted/60 border border-border/80 flex items-center justify-center shrink-0 text-foreground/80 mt-0.5">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">{cat.label}</span>
                      {cat.isCritical && (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                          Critical
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {cat.description}
                    </p>
                  </div>
                </div>

                {/* Mobile Channel Toggles Row */}
                <div className="w-full sm:hidden flex items-center justify-between pt-3 border-t border-border/40 gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <Smartphone className="w-3.5 h-3.5 text-primary" />
                    <span>Push</span>
                    <ToggleSwitch
                      checked={values.push}
                      ariaLabel={`Push for ${cat.label}`}
                      onChange={() => handleCellToggle(cat.id, "push")}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <Mail className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Email</span>
                    <ToggleSwitch
                      checked={values.email}
                      ariaLabel={`Email for ${cat.label}`}
                      onChange={() => handleCellToggle(cat.id, "email")}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <Send className="w-3.5 h-3.5 text-purple-500" />
                    <span>In-App</span>
                    <ToggleSwitch
                      checked={values.inApp}
                      ariaLabel={`In-App for ${cat.label}`}
                      onChange={() => handleCellToggle(cat.id, "inApp")}
                    />
                  </div>
                </div>

                {/* Desktop Channel Toggles */}
                <div className="hidden sm:flex col-span-2 items-center justify-center">
                  <ToggleSwitch
                    checked={values.push}
                    ariaLabel={`Push for ${cat.label}`}
                    onChange={() => handleCellToggle(cat.id, "push")}
                  />
                </div>
                <div className="hidden sm:flex col-span-2 items-center justify-center">
                  <ToggleSwitch
                    checked={values.email}
                    ariaLabel={`Email for ${cat.label}`}
                    onChange={() => handleCellToggle(cat.id, "email")}
                  />
                </div>
                <div className="hidden sm:flex col-span-2 items-center justify-center">
                  <ToggleSwitch
                    checked={values.inApp}
                    ariaLabel={`In-App for ${cat.label}`}
                    onChange={() => handleCellToggle(cat.id, "inApp")}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Action Footer */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/80 shadow-sm">
        <div className="flex items-center gap-3">
          <ConfirmationBadge
            show={Boolean(saveStatus && (saveStatus.includes("success") || saveStatus.toLowerCase().includes("saved")))}
            message="Preferences saved"
          />
          {saveStatus && !saveStatus.includes("success") && !saveStatus.toLowerCase().includes("saved") && (
            <span className="text-xs font-semibold text-destructive">
              {saveStatus}
            </span>
          )}
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={handleSave}
          disabled={saving}
          className="px-6 font-semibold text-xs shadow-md shadow-primary/20"
        >
          {saving ? "Saving Preferences..." : "Save Preferences"}
        </Button>
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  ariaLabel,
  onChange,
}: Readonly<{
  checked: boolean;
  ariaLabel: string;
  onChange: () => void;
}>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
    >
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
          checked ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-sm ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
