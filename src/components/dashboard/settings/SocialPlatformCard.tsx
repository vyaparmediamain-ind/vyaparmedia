"use client";

import { Button, Input } from "@/components/ui";

interface SocialPlatformCardProps {
  platform: "instagram" | "youtube";
  title: string;
  handle: string;
  onHandleChange: (value: string) => void;
  connected: boolean;
  followersOrSubscribers: number;
  engagementRate: number;
  isSaving: boolean;
  onConnect: () => void;
  onSync: () => void;
  onDisconnect: () => void;
}

export default function SocialPlatformCard({
  platform,
  title,
  handle,
  onHandleChange,
  connected,
  followersOrSubscribers,
  engagementRate,
  isSaving,
  onConnect,
  onSync,
  onDisconnect,
}: Readonly<SocialPlatformCardProps>) {
  const isInstagram = platform === "instagram";

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-5">
        <div
          className={`flex items-center justify-center text-2xl rounded-md w-48 h-48 flex-shrink-0 ${
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
              className="w-6 h-6 text-white"
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
              className="w-6 h-6 text-white"
            >
              <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
              <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
            </svg>
          )}
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold mb-1">{title}</h2>
          <div className={`text-xs ${connected ? "text-emerald" : "text-muted"}`}>
            {connected ? (
              <span className="flex items-center gap-1">
                <svg
                  width={12}
                  height={12}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3 h-3 text-emerald-500"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <svg
                  width={12}
                  height={12}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3 h-3 text-secondary-muted"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Not Connected
              </span>
            )}
          </div>
        </div>
      </div>

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

      {!connected ? (
        <Button
          variant="primary"
          className="w-full"
          aria-label={`Connect ${title} account`}
          onClick={onConnect}
          disabled={isSaving}
        >
          Connect {title}
        </Button>
      ) : (
        <div className="p-4 bg-tertiary rounded-md">
          <div className="grid-2 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-extrabold">
                {followersOrSubscribers === -1
                  ? "Hidden"
                  : `${((followersOrSubscribers || 0) / 1000).toFixed(0)}K`}
              </div>
              <div className="text-xs text-muted">
                {isInstagram ? "Followers" : "Subscribers"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-extrabold">{engagementRate || 0}%</div>
              <div className="text-xs text-muted">Engagement</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1 text-xs p-2"
              aria-label={`Sync ${title} statistics`}
              onClick={onSync}
              disabled={isSaving}
            >
              Sync Stats
            </Button>
            <Button
              variant="secondary"
              className="text-xs p-2"
              aria-label={`Disconnect ${title} account`}
              onClick={onDisconnect}
              disabled={isSaving}
            >
              Disconnect
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
