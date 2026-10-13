"use client";

import React from "react";
import Image from "next/image";
import { BottomSheet, Button, Select, Textarea } from "@/components/ui";
import { useMessages } from "./useMessages";
import { Message, formatMessageDateDivider } from "./MessagesHelpers";
import { DealContextMiniCard } from "./DealContextMiniCard";
import { ContactLeakWarningBanner } from "./ContactLeakWarningBanner";
import Link from "next/link";
import {
  ChevronLeft,
  Shield,
  ShieldAlert,
  Flag,
  Ban,
  Unlock,
  Send,
  Check,
  CheckCheck,
  Lock,
  MessageSquare,
  ExternalLink,
} from "lucide-react";

interface ChatPanelProps {
  readonly state: ReturnType<typeof useMessages>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated 3-dot typing bubble (Instagram DM style with peer avatar)
// ─────────────────────────────────────────────────────────────────────────────
function TypingBubble({ avatarSrc, name }: { avatarSrc?: string | null | undefined; name?: string | undefined }) {
  return (
    <div className="flex items-start gap-2.5 justify-start">
      {/* Peer mini-avatar */}
      <div className="relative w-8 h-8 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center text-xs font-bold text-foreground shrink-0 mt-0.5">
        {avatarSrc ? (
          <Image src={avatarSrc} alt={name || "User"} width={32} height={32} unoptimized className="object-cover w-full h-full rounded-full" />
        ) : (
          (name || "U").charAt(0).toUpperCase()
        )}
      </div>
      <div className="flex items-center gap-1 bg-card border border-border rounded-2xl rounded-tl-sm px-3.5 py-3 shadow-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat Header — with deal context chip when active (Collabr pattern)
// ─────────────────────────────────────────────────────────────────────────────
function ChatHeader({ state }: Readonly<ChatPanelProps>) {
  const {
    setSelectedConversation,
    isPeerTyping,
    isChatUserBlocked,
    setIsReportModalOpen,
    handleBlockUser,
    handleUnblockUser,
    selectedChat,
    dealDetails,
  } = state;

  if (!selectedChat) return null;

  const isBrand = selectedChat.userType?.toUpperCase() === "BRAND";
  const profileHref = isBrand
    ? `/brand/${selectedChat.id || encodeURIComponent(selectedChat.name || "")}`
    : `/dashboard/influencers/${selectedChat.id || ""}`;

  return (
    <div className="border-b border-border bg-card shrink-0">
      {/* Main header row */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3">
        {/* Left: back + avatar + name */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile back */}
          <button
            type="button"
            onClick={() => setSelectedConversation(null)}
            aria-label="Back to conversations"
            className="sm:hidden w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Avatar with online dot */}
          <Link
            href={profileHref}
            className="relative shrink-0 group"
            title={`View ${isBrand ? "Brand" : "Creator"} Profile`}
          >
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center text-foreground font-bold text-sm group-hover:ring-2 group-hover:ring-primary/40 transition-all">
              {selectedChat.avatar ? (
                <Image
                  src={selectedChat.avatar}
                  alt={selectedChat.name || "User avatar"}
                  width={40}
                  height={40}
                  unoptimized
                  className="object-cover w-full h-full rounded-full"
                />
              ) : (
                <span
                  className={`w-full h-full flex items-center justify-center text-sm font-black ${
                    isBrand ? "bg-primary/15 text-primary" : "bg-verified-muted text-verified"
                  }`}
                >
                  {(selectedChat.name || "U").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-verified rounded-full border-2 border-card" />
          </Link>

          {/* Name + status row */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={profileHref}
                className="font-bold text-sm sm:text-base text-foreground hover:text-primary transition-colors truncate max-w-[160px] sm:max-w-xs"
                title={`View ${isBrand ? "Brand" : "Creator"} Profile`}
              >
                {selectedChat.name}
              </Link>
              <Link
                href={profileHref}
                className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide shrink-0 hover:opacity-80 transition-opacity ${
                  isBrand ? "bg-primary/10 text-primary" : "bg-verified-muted text-verified"
                }`}
              >
                {isBrand ? "Brand" : "Creator"}
              </Link>
            </div>

            {/* Typing / deal context subtitle */}
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              {isPeerTyping ? (
                <span className="text-primary font-semibold italic flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                  Typing…
                </span>
              ) : dealDetails ? (
                <span className="inline-flex items-center gap-1 text-escrow font-semibold">
                  <Lock className="w-3 h-3" />
                  {dealDetails.title}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3 text-verified" />
                  Verified Workspace Member
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            href={profileHref}
            variant="secondary"
            aria-label={`View ${selectedChat?.name ?? "user"} profile`}
            className="text-xs min-h-[44px] px-3 py-2 flex items-center gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Profile</span>
          </Button>

          <Button
            variant="secondary"
            onClick={() => setIsReportModalOpen(true)}
            aria-label={`Report ${selectedChat?.name ?? "this user"}`}
            className="text-xs min-h-[44px] px-3 py-2 flex items-center gap-1"
          >
            <Flag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Report</span>
          </Button>

          <Button
            variant={isChatUserBlocked ? "secondary" : "ghost"}
            onClick={isChatUserBlocked ? handleUnblockUser : handleBlockUser}
            aria-label={
              isChatUserBlocked
                ? `Unblock ${selectedChat?.name ?? "user"}`
                : `Block ${selectedChat?.name ?? "user"}`
            }
            className={`text-xs min-h-[44px] px-3 py-2 flex items-center gap-1 ${
              isChatUserBlocked
                ? "text-verified border border-verified-border bg-verified-muted"
                : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            }`}
          >
            {isChatUserBlocked ? (
              <Unlock className="w-3.5 h-3.5" />
            ) : (
              <Ban className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {isChatUserBlocked ? "Unblock" : "Block"}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Content Renderers
// ─────────────────────────────────────────────────────────────────────────────
function BlockedMessageBubble() {
  return (
    <div className="flex flex-col gap-1.5 p-3 bg-disputed-muted border border-disputed-border rounded-2xl max-w-sm">
      <div className="flex items-center gap-1.5 text-xs font-bold text-disputed">
        <ShieldAlert className="w-4 h-4" />
        Message Content Filtered
      </div>
      <p className="text-xs text-foreground/80 italic leading-relaxed">
        Sharing personal contact details (phone, email, WhatsApp, UPI) prior to deal signing is
        blocked for escrow safety.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Message List — scroll area with date dividers
// ─────────────────────────────────────────────────────────────────────────────
function MessageList({ state }: Readonly<ChatPanelProps>) {
  const {
    messages,
    isPeerTyping,
    loadingMessages,
    messagesEndRef,
    scrollContainerRef,
    selectedChat,
  } = state;

  const renderMessageContent = (msg: Message) => {
    if (msg.isBlocked) return <BlockedMessageBubble />;
    return <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>;
  };

  return (
    <div
      ref={scrollContainerRef}
      aria-label="Chat messages"
      aria-live="polite"
      aria-relevant="additions"
      className="flex-1 px-4 sm:px-5 py-4 flex flex-col gap-2.5 overflow-y-auto bg-background/50 dark:bg-background/30"
    >
      {/* Loading spinner */}
      {loadingMessages && (
        <div className="flex flex-col items-center justify-center gap-2 my-auto py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-muted-foreground">Loading messages…</span>
        </div>
      )}

      {/* Empty state */}
      {!loadingMessages && messages.length === 0 && (
        <div className="my-auto flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center shadow-sm">
            <MessageSquare className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <div className="font-bold text-sm text-foreground mb-1">No messages yet</div>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              Start the conversation — discuss deliverables, share feedback, and coordinate campaign details.
            </p>
          </div>
        </div>
      )}

      {/* Message bubbles */}
      {!loadingMessages &&
        messages.length > 0 &&
        messages.map((msg: Message, index: number) => {
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const currDate = msg.rawCreatedAt ? new Date(msg.rawCreatedAt).toDateString() : "";
          const prevDate = prevMsg?.rawCreatedAt
            ? new Date(prevMsg.rawCreatedAt).toDateString()
            : "";
          const showDateDivider = !prevMsg || (currDate && prevDate && currDate !== prevDate);
          const dateLabel = formatMessageDateDivider(msg.rawCreatedAt || msg.createdAt);

          // Telegram/Instagram-style radius: sent = rounded-2xl rounded-br-sm, received = rounded-2xl rounded-tl-sm
          const bubbleRadius = msg.isMe
            ? "rounded-2xl rounded-br-sm"
            : "rounded-2xl rounded-tl-sm";

          const bubbleColors = msg.isMe
            ? "bg-primary text-primary-foreground"
            : "bg-card text-foreground border border-border/80";

          return (
            <React.Fragment key={msg.id}>
              {/* Date divider */}
              {showDateDivider && dateLabel && (
                <div className="flex items-center gap-3 my-2">
                  <div className="flex-1 h-px bg-border/60" />
                  <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase px-2 py-0.5 rounded-full bg-muted/60 border border-border/40">
                    {dateLabel}
                  </span>
                  <div className="flex-1 h-px bg-border/60" />
                </div>
              )}

              {/* Message row — always items-start so avatar & bubble column pin to top */}
              <div className={`flex items-start gap-2 group ${msg.isMe ? "flex-row-reverse" : "flex-row"}`}>

                {/* Avatar — received only; sent side gets a fixed-width spacer to keep bubbles from spanning full width */}
                {!msg.isMe ? (
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                    {selectedChat?.avatar ? (
                      <div className="relative w-8 h-8">
                        <Image
                          src={selectedChat.avatar}
                          alt={selectedChat.name || "User"}
                          fill
                          unoptimized
                          className="object-cover rounded-full"
                        />
                      </div>
                    ) : (
                      (selectedChat?.name || "U").charAt(0).toUpperCase()
                    )}
                  </div>
                ) : (
                  <div className="w-8 shrink-0" />
                )}

                {/* Bubble + timestamp column */}
                <div className={`flex flex-col gap-1 min-w-0 max-w-[72%] sm:max-w-xs ${msg.isMe ? "items-end" : "items-start"}`}>
                  <div className={`px-4 py-2.5 ${bubbleRadius} ${bubbleColors} shadow-xs`}>
                    {renderMessageContent(msg)}
                  </div>

                  {/* Timestamp & read receipts */}
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground px-1">
                    <span>{msg.createdAt}</span>
                    {msg.isMe && (
                      <span className="inline-flex items-center">
                        {msg.status === "sending" ? (
                          <span className="w-2.5 h-2.5 border border-muted-foreground border-t-transparent rounded-full animate-spin" />
                        ) : msg.status === "failed" ? (
                          <span className="text-destructive font-bold">!</span>
                        ) : msg.isRead ? (
                          <CheckCheck className="w-3 h-3 text-primary" />
                        ) : (
                          <Check className="w-3 h-3 opacity-60" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}

      {/* Typing indicator bubble */}
      {isPeerTyping && (
        <TypingBubble avatarSrc={selectedChat?.avatar} name={selectedChat?.name} />
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat Input Area — message input with contact-leak warning
// ─────────────────────────────────────────────────────────────────────────────
function ChatInputArea({ state }: Readonly<ChatPanelProps>) {
  const {
    newMessage,
    isChatUserBlocked,
    handleInputChange,
    handleSend,
    hasActiveDeal,
  } = state;

  // Blocked state
  if (isChatUserBlocked) {
    return (
      <div className="p-4 border-t border-border bg-card shrink-0">
        <div className="font-bold text-xs text-destructive px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-center">
          🚫 Messaging disabled — a block relationship exists with this account.
        </div>
      </div>
    );
  }

  // No active deal state
  if (!hasActiveDeal) {
    return (
      <div className="p-4 pb-[max(1rem,calc(env(safe-area-inset-bottom,0px)+1rem))] border-t border-border bg-card shrink-0">
        <div className="font-semibold text-xs text-pending px-4 py-3 bg-pending-muted border border-pending-border rounded-xl text-center flex items-center justify-center gap-2">
          <Lock className="w-3.5 h-3.5" />
          Messaging is locked — you can only message users who have an active deal with you.
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-card shrink-0 pb-[env(safe-area-inset-bottom,0px)]">
      {/* Contact leak warning */}
      <ContactLeakWarningBanner leakResult={state.contactLeakResult} />

      {/* Input row */}
      <div className="p-3.5 sm:p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          {/* Text input */}
          <input
            type="text"
            value={newMessage}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message… (Enter to send)"
            className="flex-1 min-h-[44px] py-2.5 px-4 rounded-2xl border border-input bg-muted/40 text-foreground placeholder:text-muted-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all"
            aria-label="Type a message"
          />

          {/* Send button */}
          <Button
            type="submit"
            variant="primary"
            disabled={!newMessage.trim()}
            className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center shrink-0 shadow-sm disabled:opacity-40 p-0 cursor-pointer"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Report User Modal — unchanged behavior, refreshed layout
// ─────────────────────────────────────────────────────────────────────────────
export function ReportUserModal({ state }: Readonly<ChatPanelProps>) {
  const {
    isReportModalOpen,
    setIsReportModalOpen,
    reportReason,
    setReportReason,
    reportDescription,
    setReportDescription,
    handleReportSubmit,
    submittingReport,
    selectedChat,
  } = state;

  return (
    <BottomSheet
      open={isReportModalOpen}
      onClose={() => setIsReportModalOpen(false)}
      title={`Report ${selectedChat?.name || "User"}`}
      maxWidth="480px"
    >
      <form onSubmit={handleReportSubmit} className="space-y-4 pt-2">
        <Select
          id="report-reason"
          label="Reason for Report"
          value={reportReason}
          onChange={(e) => setReportReason(e.target.value)}
          required
          fullWidth
        >
          <option value="SPAM">Spam or Unsolicited Commercial Messaging</option>
          <option value="CONTACT_LEAK">Attempting Off-Platform Payment or Contact Leak</option>
          <option value="HARASSMENT">Harassment or Inappropriate Behavior</option>
          <option value="FRAUD">Fraudulent Offer or Fake Deliverables</option>
          <option value="OTHER">Other Terms Violation</option>
        </Select>

        <Textarea
          id="report-details"
          label="Additional Details (Optional)"
          value={reportDescription}
          onChange={(e) => setReportDescription(e.target.value)}
          placeholder="Please provide specific context to help our Trust & Safety team investigate…"
          fullWidth
        />

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-border">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsReportModalOpen(false)}
            className="w-full sm:w-auto min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={submittingReport || !reportReason.trim()}
            className="w-full sm:w-auto min-h-[44px] font-bold"
          >
            {submittingReport ? "Submitting..." : "Submit Report"}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatPanel — root component
// Layout: DealContextMiniCard (sticky pinned) → ChatHeader → MessageList → ChatInputArea
// ─────────────────────────────────────────────────────────────────────────────
export function ChatPanel({ state }: Readonly<ChatPanelProps>) {
  const { selectedConversation, dealDetails } = state;

  if (!selectedConversation) {
    return (
      <main
        aria-label="Select a conversation"
        className="hidden sm:flex flex-1 flex-col items-center justify-center p-8 bg-card text-center"
      >
        <div className="flex flex-col items-center gap-4 max-w-xs">
          {/* Premium empty state icon */}
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-muted/60 border border-border flex items-center justify-center shadow-sm">
              <MessageSquare className="w-9 h-9 text-muted-foreground/60" />
            </div>
            <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-sm">
              <Lock className="w-3 h-3 text-primary-foreground" />
            </span>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-foreground mb-1">
              Messages
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Select a conversation to discuss deliverables, milestones, and campaign details.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      aria-label="Active conversation"
      className="flex flex-1 flex-col h-full bg-card min-w-0 overflow-hidden"
    >
      {/* 1. Collabr-style sticky deal context banner — ABOVE the header */}
      {dealDetails && <DealContextMiniCard deal={dealDetails} />}

      {/* 2. Chat header with deal chip in subtitle */}
      <ChatHeader state={state} />

      {/* 3. Message scroll area */}
      <MessageList state={state} />

      {/* 4. Input area */}
      <ChatInputArea state={state} />
    </main>
  );
}
