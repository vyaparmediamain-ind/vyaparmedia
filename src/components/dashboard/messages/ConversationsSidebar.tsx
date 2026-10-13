"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import EmptyState from "@/components/ui/EmptyState";
import { PullToRefresh, ListItem } from "@/components/ui";
import { useMessages } from "./useMessages";
import { Conversation } from "./MessagesHelpers";
import { formatDate, formatTime } from "@/lib/utils-client";
import { Search, X } from "lucide-react";

interface ConversationsSidebarProps {
  readonly state: ReturnType<typeof useMessages>;
}

function formatConversationTime(timestamp?: string): string {
  if (!timestamp) return "";
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return formatTime(date);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return formatDate(date, "", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

/** Instagram-style animated 3-dot typing indicator for sidebar preview */
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label="Typing">
      <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
      <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
      <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
    </span>
  );
}

/** Loading skeleton — Instagram DM style rows */
function SidebarSkeleton() {
  return (
    <div className="space-y-0 divide-y divide-border/50" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
          <div className="w-11 h-11 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between items-center">
              <div className="h-3 w-28 bg-muted rounded" />
              <div className="h-2.5 w-10 bg-muted rounded" />
            </div>
            <div className="h-2.5 w-40 bg-muted/60 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConversationsSidebar({ state }: Readonly<ConversationsSidebarProps>) {
  const {
    selectedConversation,
    setSelectedConversation,
    conversations,
    loadingConversations,
  } = state;

  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase().trim();
    return conversations.filter(
      (conv) =>
        conv.name.toLowerCase().includes(q) ||
        conv.userType?.toLowerCase().includes(q) ||
        conv.lastMessage?.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  const totalUnread = useMemo(
    () => conversations.reduce((acc, conv) => acc + (conv.unread || 0), 0),
    [conversations]
  );

  return (
    <aside
      aria-label="Chat conversations"
      className={`w-full sm:w-80 sm:flex flex-col border-r border-border shrink-0 bg-card h-full ${
        selectedConversation ? "hidden sm:flex" : "flex"
      }`}
    >
      {/* ── Sidebar Header ── */}
      <div className="border-b border-border px-4 pt-4 pb-3 flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-foreground tracking-tight">
              Messages
            </h2>
            {/* Total unread pill — numbered, like WhatsApp/Instagram */}
            {totalUnread > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black bg-primary text-primary-foreground tabular-nums shadow-sm">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground font-medium">
            {conversations.length} {conversations.length === 1 ? "chat" : "chats"}
          </span>
        </div>

        {/* Search — Instagram DM pill style */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search conversations…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 min-h-[44px] py-2.5 rounded-full border border-input bg-muted/50 text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all"
            aria-label="Search conversations"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Conversations List ── */}
      <PullToRefresh onRefresh={state.refreshConversations} className="flex-1 overflow-y-auto">
        {(() => {
          if (loadingConversations) {
            return <SidebarSkeleton />;
          }

          if (conversations.length === 0) {
            return (
              <EmptyState
                emoji="💬"
                title="No Conversations Yet"
                description="Your workspace chat will appear here as soon as you apply, create campaigns, or initiate deals."
                compact
              />
            );
          }

          if (filteredConversations.length === 0) {
            return (
              <div className="p-6 text-center text-muted-foreground text-xs">
                No chats matching &quot;{searchQuery}&quot;
              </div>
            );
          }

          return (
            <div className="divide-y divide-border/50">
              {filteredConversations.map((conv: Conversation) => {
                const isSelected = selectedConversation === conv.userId;
                const isBrand = conv.userType?.toUpperCase() === "BRAND";
                const hasUnread = conv.unread > 0;

                return (
                  <ListItem
                    key={conv.userId}
                    as="button"
                    variant="flush"
                    compact
                    active={isSelected}
                    unread={hasUnread}
                    onClick={() => setSelectedConversation(conv.userId)}
                    aria-label={`Chat with ${conv.name}${hasUnread ? `, ${conv.unread} unread` : ""}`}
                    {...(isSelected ? { "aria-current": "true" as const } : {})}
                    leading={
                      <div className="relative shrink-0">
                        <div className="relative w-11 h-11 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center text-foreground font-bold text-sm">
                          {conv.avatar ? (
                            <Image
                              src={conv.avatar}
                              alt={conv.name || "User avatar"}
                              width={44}
                              height={44}
                              unoptimized
                              className="object-cover w-full h-full rounded-full"
                            />
                          ) : (
                            <span
                              className={`w-full h-full flex items-center justify-center text-sm font-black ${
                                isBrand
                                  ? "bg-primary/15 text-primary"
                                  : "bg-verified-muted text-verified"
                              }`}
                            >
                              {(conv.name || "U").charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        {/* Online dot — bottom right (green) */}
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-verified rounded-full border-2 border-card" />
                      </div>
                    }
                    title={conv.name}
                    titleBadge={
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide shrink-0 ${
                          isBrand
                            ? "bg-primary/10 text-primary"
                            : "bg-verified-muted text-verified"
                        }`}
                      >
                        {isBrand ? "Brand" : "Creator"}
                      </span>
                    }
                    subtitle={
                      conv.isTyping ? (
                        <span className="inline-flex items-center gap-1.5 text-primary font-semibold italic">
                          <TypingDots />
                          <span>typing…</span>
                        </span>
                      ) : (
                        conv.lastMessage || "Start a conversation"
                      )
                    }
                    trailing={
                      <span className="text-muted-foreground text-[10px] font-medium whitespace-nowrap font-mono">
                        {formatConversationTime(conv.lastMessageTime)}
                      </span>
                    }
                    trailingSecondary={
                      hasUnread ? (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black bg-primary text-primary-foreground tabular-nums shadow-sm">
                          {conv.unread > 99 ? "99+" : conv.unread}
                        </span>
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
          );
        })()}
      </PullToRefresh>
    </aside>
  );
}
