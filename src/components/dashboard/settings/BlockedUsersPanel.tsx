"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Button, Badge } from "@/components/ui";
import { formatUserError } from "@/lib/user-messages";
import { apiClient } from "@/lib/api-client";
import { UserX, Unlock, RefreshCw } from "lucide-react";

interface BlockedItem {
  id: string;
  blockedUserId: string;
  createdAt: string;
  blockedUser: {
    id: string;
    userType: string;
    influencerProfile?: { displayName: string | null; avatar: string | null } | null;
    brandProfile?: { companyName: string | null; logo: string | null } | null;
  };
}

interface BlockedUsersResponse {
  success: boolean;
  data: BlockedItem[];
}

export default function BlockedUsersPanel({
  showToast,
}: {
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const { data, isLoading, mutate } = useSWR<BlockedUsersResponse>(
    "/api/users/block",
    fetcher
  );

  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const blockedList = Array.isArray(data?.data) ? data.data : [];

  const handleUnblock = async (blockedUserId: string, name: string) => {
    if (!confirm(`Are you sure you want to unblock ${name}?`)) return;

    setUnblockingId(blockedUserId);
    try {
      await apiClient.users.blockUser({
        blockedUserId,
        action: "unblock",
      });

      showToast(`${name} has been unblocked.`, "success");
      mutate();
    } catch (err) {
      showToast(formatUserError(err, "Failed to unblock user."), "error");
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-foreground">
              Blocked Accounts &amp; Privacy
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Blocked users cannot send you direct messages, view private contact details, or send direct collaboration invites.
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => mutate()}
          disabled={isLoading}
          className="text-xs text-muted-foreground"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="pt-2 border-t border-border">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted/30 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : blockedList.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            You haven't blocked any accounts. Your messaging and collaboration inbox is open.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {blockedList.map((item) => {
              const name =
                item.blockedUser.influencerProfile?.displayName ||
                item.blockedUser.brandProfile?.companyName ||
                "Platform User";
              const isUnblocking = unblockingId === item.blockedUserId;

              return (
                <div
                  key={item.id}
                  className="py-3 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-xs text-muted-foreground shrink-0">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-foreground truncate">
                        {name}
                      </div>
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {item.blockedUser.userType}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleUnblock(item.blockedUserId, name)}
                    disabled={isUnblocking}
                    className="text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    <Unlock className="w-3 h-3 mr-1 text-primary" />
                    {isUnblocking ? "Unblocking..." : "Unblock"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
