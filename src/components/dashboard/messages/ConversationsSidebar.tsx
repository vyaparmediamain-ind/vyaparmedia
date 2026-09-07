"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import EmptyState from "@/components/ui/EmptyState";
import { useMessages } from "./useMessages";
import { Conversation } from "./MessagesHelpers";

interface ConversationsSidebarProps {
  readonly state: ReturnType<typeof useMessages>;
}

function formatConversationTime(timestamp?: string): string {
  if (!timestamp) return "";
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
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
    <div className={`messages-list ${selectedConversation ? "hide-mobile" : ""}`}>
      {/* Sidebar Header */}
      <div className="border-b border-card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-primary">Messages</h1>
            {totalUnread > 0 && (
              <span className="badge badge-primary font-bold text-2xs px-2 py-0.5 rounded-full">
                {totalUnread} new
              </span>
            )}
          </div>
          <span className="text-xs text-muted font-medium">
            {conversations.length} {conversations.length === 1 ? "chat" : "chats"}
          </span>
        </div>

        {/* Search input */}
        <div className="messages-search-wrapper">
          <svg
            className="messages-search-icon"
            width={15}
            height={15}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="messages-search-input"
            aria-label="Search conversations"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="messages-search-clear"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-card-border">
        {(() => {
          if (loadingConversations) {
            return (
              <div className="text-center p-8 flex flex-col items-center gap-3">
                <span className="loading w-8 h-8" />
                <span className="text-xs text-muted">Loading chats...</span>
              </div>
            );
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
              <div className="p-6 text-center text-muted text-xs">
                No conversations matching &quot;{searchQuery}&quot;
              </div>
            );
          }

          return filteredConversations.map((conv: Conversation) => {
            const isSelected = selectedConversation === conv.userId;
            const isBrand = conv.userType?.toUpperCase() === "BRAND";

            return (
              <button
                key={conv.userId}
                onClick={() => setSelectedConversation(conv.userId)}
                type="button"
                aria-label={(() => {
                  let unreadText = "";
                  if (conv.unread > 0) {
                    const pluralSuffix = conv.unread === 1 ? "" : "s";
                    unreadText = `, ${conv.unread} unread message${pluralSuffix}`;
                  }
                  return `Chat with ${conv.name}${unreadText}`;
                })()}
                {...(isSelected ? { "aria-current": "true" as const } : {})}
                data-selected={isSelected}
                className="conversation-item"
              >
                {/* Avatar with status */}
                <div className="relative flex-shrink-0">
                  <div className="conversation-avatar">
                    {conv.avatar ? (
                      <Image
                        src={conv.avatar}
                        alt={conv.name || "User avatar"}
                        fill
                        unoptimized
                        className="object-cover rounded-full"
                      />
                    ) : (
                      (conv.name || "U").charAt(0).toUpperCase()
                    )}
                  </div>
                  {conv.unread > 0 ? (
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald rounded-full border-2 border-card shadow-sm" />
                  ) : (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500/80 rounded-full border border-card" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className={`font-bold text-sm truncate max-w-130 inline-block ${isSelected ? "text-white" : "text-primary"}`}>
                        {conv.name}
                      </span>
                      <span
                        className="conversation-role-badge"
                        data-role={isBrand ? "BRAND" : "CREATOR"}
                      >
                        {isBrand ? "Brand" : "Creator"}
                      </span>
                    </div>
                    <span className="text-muted text-3xs font-medium whitespace-nowrap font-mono">
                      {formatConversationTime(conv.lastMessageTime)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span
                      className={`text-xs truncate max-w-160 ${
                        conv.unread > 0
                          ? "text-primary font-bold"
                          : "text-secondary font-normal"
                      }`}
                    >
                      {conv.isTyping ? (
                        <span className="text-blue-400 font-semibold italic flex items-center gap-1">
                          <span className="animate-pulse">●</span>
                          <span>Typing...</span>
                        </span>
                      ) : (
                        conv.lastMessage || "Start a conversation"
                      )}
                    </span>
                    {conv.unread > 0 && (
                      <span className="font-extrabold text-white text-3xs rounded-full px-2 py-0.5 bg-primary shadow-sm font-mono">
                        {conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          });
        })()}
      </div>
    </div>
  );
}
