"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import EmptyState from "@/components/ui/EmptyState";
import { Button } from "@/components/ui";
import { formatDateTime } from "@/lib/utils-client";
import { useState, useMemo } from "react";
import {
  Laptop,
  Smartphone,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  type LoginActivityItem as LoginActivity,
  type LoginActivityResponse as ActivityResponse,
} from "@/lib/schemas";

interface LoginActivityPanelProps {
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

export default function LoginActivityPanel({
  showToast: _showToast,
}: Readonly<LoginActivityPanelProps>) {
  const [showAllLogins, setShowAllLogins] = useState(false);

  const { data } = useSWR<ActivityResponse>("/api/user/activity", fetcher);

  const loginActivity = useMemo(() => {
    if (!data?.activity) return [];
    const uniqueDevices = new Map<string, LoginActivity>();
    data.activity.forEach((login: LoginActivity) => {
      if (!uniqueDevices.has(login.device)) {
        uniqueDevices.set(login.device, login);
      }
    });
    return Array.from(uniqueDevices.values());
  }, [data]);

  const visibleLogins = showAllLogins
    ? loginActivity
    : loginActivity.slice(0, 3);

  return (
    <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Laptop className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              Active Sessions &amp; Devices
            </h3>
            <p className="text-xs text-muted-foreground">
              Monitor active logins and browser sessions across your devices
            </p>
          </div>
        </div>

        {loginActivity.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-full border border-border">
            {loginActivity.length} Total Sessions
          </span>
        )}
      </div>

      <div className="space-y-2.5">
        {loginActivity.length === 0 ? (
          <EmptyState
            emoji=""
            title="No Login Activity"
            description="No recent login sessions recorded."
            compact
          />
        ) : (
          visibleLogins.map((login) => {
            const isMobile =
              login.device.includes("Android") ||
              login.device.includes("iPhone") ||
              login.device.includes("Mobile");

            return (
              <div
                key={`${login.device}-${login.time || login.lastActive}`}
                className={`p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                  login.active
                    ? "bg-card border-primary/30 shadow-xs"
                    : "bg-muted/30 border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-card border border-border text-primary shrink-0">
                    {isMobile ? (
                      <Smartphone className="w-4 h-4" />
                    ) : (
                      <Laptop className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-foreground flex items-center gap-2">
                      <span>{login.device}</span>
                      {login.location && (
                        <span className="text-[11px] font-normal text-muted-foreground">
                          • {login.location}
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 flex items-center gap-1 ${
                        login.success !== false
                          ? "text-muted-foreground"
                          : "text-disputed font-semibold"
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>
                        {login.time || login.lastActive
                          ? formatDateTime(login.time || login.lastActive)
                          : "Just now"}
                      </span>
                      {login.success === false && " (Failed Attempt)"}
                    </div>
                  </div>
                </div>

                <div>
                  {login.active ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-verified bg-verified-muted px-2.5 py-0.5 rounded-full border border-verified-border">
                      <span className="w-1.5 h-1.5 rounded-full bg-verified animate-pulse" />
                      Active Session
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      Signed Out
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {loginActivity.length > 3 && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowAllLogins(!showAllLogins)}
          className="w-full text-xs font-semibold flex items-center justify-center gap-1.5"
        >
          {showAllLogins ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" /> Show Less
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" /> View All Sessions ({loginActivity.length})
            </>
          )}
        </Button>
      )}
    </div>
  );
}
