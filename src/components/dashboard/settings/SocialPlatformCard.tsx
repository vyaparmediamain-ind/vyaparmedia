"use client";

import { CheckCircle2, AlertTriangle, Clock, XCircle } from "lucide-react";
import { Button, Input } from "@/components/ui";

interface SocialPlatformCardProps {
  platform: "instagram" | "youtube";
  title: string;
  handle: string;
  onHandleChange: (value: string) => void;
  connected: boolean;
  needsReconnect?: boolean | undefined;
  pendingApproval?: boolean | undefined;
  lastSynced?: string | null | undefined;
  followersOrSubscribers: number;
  engagementRate: number;
  isSaving: boolean;
  isRedirecting?: boolean | undefined;
  onConnect: () => void;
  onSync: () => void;
  onDisconnect: () => void;
}

function formatLastSynced(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export default function SocialPlatformCard({
  platform,
  title,
  handle,
  onHandleChange,
  connected,
  needsReconnect = false,
  pendingApproval = false,
  lastSynced = null,
  followersOrSubscribers,
  engagementRate,
  isSaving,
  isRedirecting = false,
  onConnect,
  onSync,
  onDisconnect,
}: Readonly<SocialPlatformCardProps>) {
  const isInstagram = platform === "instagram";
  const formattedSync = formatLastSynced(lastSynced);

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-5">
        <div
          className={`flex items-center justify-center text-2xl rounded-md w-12 h-12 flex-shrink-0 ${
            isInstagram ? "bg-instagram" : "bg-youtube"
          }`}
        >
          {isInstagram ? (
            <svg
              width={24}
              height={24}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6 text-primary-foreground"
            >
              <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
          ) : (
            <svg
              width={24}
              height={24}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6 text-primary-foreground"
            >
              <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
              <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
            </svg>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold mb-1 text-foreground">{title}</h2>
            {/* Status indicator badges */}
            {needsReconnect ? (
              <span className="inline-flex items-center gap-1 text-xs text-pending font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                Needs reconnect
              </span>
            ) : pendingApproval ? (
              <span className="inline-flex items-center gap-1 text-xs text-escrow font-medium">
                <Clock className="w-3.5 h-3.5" />
                Pending approval
              </span>
            ) : connected ? (
              <span className="inline-flex items-center gap-1 text-xs text-verified font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                <XCircle className="w-3.5 h-3.5" />
                Not connected
              </span>
            )}
          </div>
          {connected && formattedSync ? (
            <p className="text-xs text-muted-foreground">
              Last synced: {formattedSync}
            </p>
          ) : null}
        </div>
      </div>

      {needsReconnect && (
        <div className="p-3 mb-4 rounded-md bg-pending-muted border border-pending-border text-xs text-pending">
          Your session or authorization expired. Please reconnect your {title} account to refresh access.
        </div>
      )}

      {pendingApproval && (
        <div className="p-3 mb-4 rounded-md bg-escrow-muted border border-escrow-border text-xs text-escrow">
          Account connection is pending platform verification.
        </div>
      )}

      <div className="mb-4">
        <Input
          id={`${platform}-handle-input`}
          label={isInstagram ? "Instagram Handle" : "YouTube Channel ID or Handle"}
          type="text"
          placeholder={isInstagram ? "@yourusername" : "@yourchannel"}
          value={handle}
          onChange={(e) => onHandleChange(e.target.value)}
          fullWidth
        />
      </div>

      {needsReconnect ? (
        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            className="w-full"
            aria-label={`Reconnect ${title} account`}
            onClick={onConnect}
            disabled={isSaving || isRedirecting}
          >
            {isRedirecting ? "Connecting..." : `Reconnect ${title}`}
          </Button>
          <Button
            variant="secondary"
            className="w-full text-xs p-2"
            aria-label={`Disconnect ${title} account`}
            onClick={onDisconnect}
            disabled={isSaving || isRedirecting}
          >
            Disconnect
          </Button>
        </div>
      ) : !connected ? (
        <Button
          variant="primary"
          className="w-full"
          aria-label={`Connect ${title} account`}
          onClick={onConnect}
          disabled={isSaving || isRedirecting}
        >
          {isRedirecting ? "Connecting..." : `Connect ${title}`}
        </Button>
      ) : (
        <div className="p-4 bg-secondary rounded-md">
          <div className="grid-2 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-extrabold text-foreground">
                {followersOrSubscribers === -1
                  ? "Hidden"
                  : `${((followersOrSubscribers || 0) / 1000).toFixed(0)}K`}
              </div>
              <div className="text-xs text-muted-foreground">
                {isInstagram ? "Followers" : "Subscribers"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-extrabold text-foreground">{engagementRate || 0}%</div>
              <div className="text-xs text-muted-foreground">Engagement</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1 text-xs p-2"
              aria-label={`Sync ${title} statistics`}
              onClick={onSync}
              disabled={isSaving || isRedirecting}
            >
              Sync Stats
            </Button>
            <Button
              variant="secondary"
              className="text-xs p-2"
              aria-label={`Disconnect ${title} account`}
              onClick={onDisconnect}
              disabled={isSaving || isRedirecting}
            >
              Disconnect
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
