"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Modal, Button, Input, Select, Textarea } from "@/components/ui";
import { useMessages } from "./useMessages";
import { Message, formatMessageDateDivider } from "./MessagesHelpers";

interface ChatPanelProps {
  readonly state: ReturnType<typeof useMessages>;
}

function ChatHeader({ state }: Readonly<ChatPanelProps>) {
  const {
    setSelectedConversation,
    isPeerTyping,
    isChatUserBlocked,
    setIsReportModalOpen,
    handleBlockUser,
    handleUnblockUser,
    selectedChat,
  } = state;

  if (!selectedChat) return null;

  const isBrand = selectedChat.userType?.toUpperCase() === "BRAND";

  return (
    <div className="border-b border-card flex items-center justify-between gap-3 px-5 py-3.5 backdrop-blur-md bg-secondary/80 z-10">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile Back Button */}
        <Button
          variant="ghost"
          onClick={() => setSelectedConversation(null)}
          aria-label="Back to conversations list"
          className="chat-back-btn show-mobile p-1.5 min-w-0 hover:bg-tertiary rounded-lg"
        >
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Button>

        {/* User Avatar with status pulse */}
        <div className="relative flex-shrink-0">
          <div className="conversation-avatar">
            {selectedChat.avatar ? (
              <Image
                src={selectedChat.avatar}
                alt={selectedChat.name || "User avatar"}
                fill
                unoptimized
                className="object-cover rounded-full"
              />
            ) : (
              (selectedChat.name || "U").charAt(0).toUpperCase()
            )}
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-card shadow-sm" />
        </div>

        {/* User Info & Role */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base text-white truncate max-w-180">
              {selectedChat.name}
            </span>
            <span
              className="conversation-role-badge"
              data-role={isBrand ? "BRAND" : "CREATOR"}
            >
              {isBrand ? "Brand" : "Creator"}
            </span>
          </div>
          <div className="text-xs text-secondary flex items-center gap-1.5">
            {isPeerTyping ? (
              <span className="text-blue-400 font-semibold italic flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                <span>Typing...</span>
              </span>
            ) : (
              <span>Verified Workspace Member</span>
            )}
          </div>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex gap-2 items-center flex-shrink-0">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsReportModalOpen(true)}
          aria-label={`Report ${selectedChat?.name ?? "this user"}`}
          className="text-xs px-2.5 py-1.5 flex items-center gap-1.5 border-card hover:bg-tertiary"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
          <span className="hidden sm:inline">Report</span>
        </Button>

        <Button
          variant={isChatUserBlocked ? "secondary" : "ghost"}
          size="sm"
          onClick={isChatUserBlocked ? handleUnblockUser : handleBlockUser}
          aria-label={isChatUserBlocked ? `Unblock ${selectedChat?.name ?? "user"}` : `Block ${selectedChat?.name ?? "user"}`}
          className={`text-xs px-2.5 py-1.5 flex items-center gap-1.5 ${
            isChatUserBlocked
              ? "text-emerald border-emerald/30 bg-emerald-500/10 hover:bg-emerald-500/20"
              : "text-muted hover:text-rose hover:bg-rose-subtle"
          }`}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
          <span className="hidden sm:inline">{isChatUserBlocked ? "Unblock" : "Block"}</span>
        </Button>
      </div>
    </div>
  );
}

function MessageList({ state }: Readonly<ChatPanelProps>) {
  const { messages, isPeerTyping, loadingMessages, messagesEndRef } = state;

  const renderBlockedMessage = (msg: Message) => (
    <div className="flex flex-col gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
      <div
        className="flex items-center gap-1.5 text-xs font-bold text-rose"
        data-me={msg.isMe}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        Message Content Filtered
      </div>
      <p className="text-xs text-muted select-none italic">
        Sharing personal contact details (phone, email, WhatsApp) prior to deal signing is blocked for safety.
      </p>
    </div>
  );

  const renderFileMessage = (msg: Message) => {
    const fileName = String(msg.metadata?.fileName || "Shared File");
    const fileType = String(msg.metadata?.fileType || "");
    const isImg =
      fileType.startsWith("image/") ||
      /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.fileUrl || "");

    return (
      <div className="flex flex-col gap-2 min-w-200">
        <div className="flex items-center gap-2 font-bold text-xs">
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Attachment
        </div>

        {isImg && msg.fileUrl ? (
          <div className="relative w-full max-w-280 h-44 rounded-lg overflow-hidden bg-black/40 border border-white/10 mb-1 shadow-sm group">
            <Image
              src={msg.fileUrl}
              alt={fileName}
              fill
              sizes="(max-width: 768px) 100vw, 280px"
              className="object-cover transition-transform group-hover:scale-105"
              unoptimized={!/\.(jpg|jpeg|png|webp|gif)$/i.test(msg.fileUrl)}
            />
          </div>
        ) : null}

        {msg.fileUrl && (
          <a
            href={msg.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full block"
          >
            <Button
              variant="secondary"
              size="sm"
              className="w-full flex items-center justify-center gap-2 text-xs py-1.5 border-card bg-secondary/80 hover:bg-secondary cursor-pointer"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download {fileName.slice(0, 18)}{fileName.length > 18 ? "..." : ""}
            </Button>
          </a>
        )}
      </div>
    );
  };

  const renderOfferMessage = (msg: Message) => {
    const offer = msg.metadata || {};
    const amount = Number(offer.amount || 0);
    const isPending = offer.status === "PENDING";
    const isAccepted = offer.status === "ACCEPTED";
    const isDeclined = offer.status === "DECLINED";

    let statusClass = "bg-amber-500/20 text-amber-400 border-amber-500/30";
    if (isAccepted) {
      statusClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    } else if (isDeclined) {
      statusClass = "bg-rose-500/20 text-rose-400 border-rose-500/30";
    }

    return (
      <div className="offer-card flex flex-col gap-3 p-4 rounded-xl bg-card border border-card text-left max-w-360 shadow-lg">
        <div className="flex items-center justify-between border-b border-card pb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-base" aria-hidden="true">🤝</span>
            <span className="font-extrabold text-sm gradient-text">Custom Proposal</span>
          </div>
          <span className={`text-3xs uppercase font-extrabold px-2 py-0.5 rounded-full border ${statusClass}`}>
            {offer.status || "PENDING"}
          </span>
        </div>

        <div>
          <div className="text-sm font-bold text-primary mb-1">{offer.title || "Custom Deal Offer"}</div>
          <div className="text-xs text-secondary leading-relaxed line-clamp-3">
            {offer.description || "Direct collaboration proposal with platform escrow protection."}
          </div>
        </div>

        {offer.deliverables ? (
          <div className="text-xs bg-secondary/60 p-2.5 rounded-lg border border-white/5">
            <span className="text-muted font-bold block mb-1">Deliverables:</span>
            <span className="text-primary">{String(offer.deliverables)}</span>
          </div>
        ) : null}

        <div className="flex justify-between items-center bg-secondary p-3 rounded-lg border border-white/5">
          <span className="text-xs text-secondary">Proposed Rate:</span>
          <strong className="text-base font-extrabold text-emerald">
            ₹{(amount / 100).toLocaleString("en-IN")}
          </strong>
        </div>

        {isPending && !msg.isMe ? (
          <div className="flex gap-2 mt-1 w-full">
            <Button
              variant="primary"
              size="sm"
              onClick={() => state.handleUpdateOfferStatus?.(msg.id, "ACCEPTED")}
              className="flex-1 text-xs py-2 cursor-pointer font-bold"
            >
              ✓ Accept Offer
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => state.handleUpdateOfferStatus?.(msg.id, "DECLINED")}
              className="flex-1 text-xs py-2 cursor-pointer text-muted hover:text-rose"
            >
              ✕ Decline
            </Button>
          </div>
        ) : null}

        {isAccepted && (offer.dealId || msg.metadata?.dealId) ? (
          <Link
            href={`/dashboard/deals/${String(offer.dealId || msg.metadata?.dealId)}`}
            className="w-full block mt-1"
          >
            <Button
              variant="secondary"
              size="sm"
              className="w-full flex items-center justify-center gap-1.5 text-xs py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 font-bold cursor-pointer"
            >
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>View Active Deal & Deliverables</span>
            </Button>
          </Link>
        ) : null}
      </div>
    );
  };

  const renderMessageContent = (msg: Message) => {
    if (msg.isBlocked) {
      return renderBlockedMessage(msg);
    }

    if (msg.messageType === "FILE" && msg.fileUrl) {
      return renderFileMessage(msg);
    }

    if (msg.messageType === "OFFER") {
      return renderOfferMessage(msg);
    }

    return <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>;
  };

  return (
    <div
      aria-label="Chat messages"
      aria-live="polite"
      aria-relevant="additions"
      className="flex-1 p-5 sm:p-6 flex flex-col gap-3.5 bg-primary overflow-y-auto"
    >
      {loadingMessages && (
        <div className="text-center p-8 flex flex-col items-center gap-2">
          <span className="loading w-8 h-8" />
          <span className="text-xs text-muted">Loading messages...</span>
        </div>
      )}

      {!loadingMessages && messages.length === 0 && (
        <div className="my-auto text-center text-muted p-8 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-2xl border border-white/5">
            💬
          </div>
          <div className="font-bold text-sm text-primary">No messages in this chat yet</div>
          <p className="text-xs text-secondary max-w-280">
            Start the conversation, propose deal terms, or discuss deliverables.
          </p>
        </div>
      )}

      {!loadingMessages &&
        messages.length > 0 &&
        messages.map((msg: Message, index: number) => {
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const currDate = msg.rawCreatedAt
            ? new Date(msg.rawCreatedAt).toDateString()
            : "";
          const prevDate = prevMsg?.rawCreatedAt
            ? new Date(prevMsg.rawCreatedAt).toDateString()
            : "";
          const showDateDivider = !prevMsg || (currDate && prevDate && currDate !== prevDate);
          const dateLabel = formatMessageDateDivider(msg.rawCreatedAt || msg.createdAt);

          return (
            <React.Fragment key={msg.id}>
              {showDateDivider && dateLabel && (
                <div className="chat-date-separator flex items-center justify-center my-3 select-none">
                  <div className="chat-date-pill px-3 py-1 text-2xs font-bold rounded-full bg-tertiary border border-card text-secondary shadow-sm">
                    <span>{dateLabel}</span>
                  </div>
                </div>
              )}
              <div
                className={`flex ${msg.isMe ? "justify-end" : "justify-start"} animate-fade-in`}
              >
                <div
                  className={`chat-bubble rounded-2xl px-4 py-2.5 max-w-[85%] sm:max-w-[75%] shadow-sm transition-all ${
                    msg.isMe
                      ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-br-xs"
                      : "bg-secondary text-primary border border-card rounded-bl-xs"
                  }`}
                  data-me={msg.isMe}
                  data-blocked={msg.isBlocked}
                >
                  {renderMessageContent(msg)}
                  <div
                    className={`mt-1.5 flex items-center justify-end gap-1.5 text-3xs font-medium ${
                      msg.isMe ? "text-white/75" : "text-muted"
                    }`}
                    title={
                      msg.rawCreatedAt
                        ? new Date(msg.rawCreatedAt).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : msg.createdAt
                    }
                  >
                    <span>{msg.createdAt}</span>
                    {msg.isMe && (
                      <span
                        aria-hidden="true"
                        className={msg.isRead ? "text-cyan-300 font-bold" : "text-white/60"}
                      >
                        {msg.isRead ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}

      {/* Typing indicator */}
      {isPeerTyping && (
        <div className="flex justify-start animate-fade-in">
          <div className="flex items-center gap-1.5 bg-secondary text-secondary text-xs rounded-2xl border border-card px-4 py-3 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" />
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:0.2s]" />
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:0.4s]" />
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

function ChatInputArea({ state }: Readonly<ChatPanelProps>) {
  const {
    newMessage,
    isChatUserBlocked,
    handleInputChange,
    handleSend,
    showToast,
    publishTyping,
    handleSendFile,
    handleSendOffer,
    hasActiveDeal,
  } = state;

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = React.useState(false);

  // Offer fields
  const [offerTitle, setOfferTitle] = React.useState("");
  const [offerAmount, setOfferAmount] = React.useState("");
  const [offerDescription, setOfferDescription] = React.useState("");
  const [offerDeliverables, setOfferDeliverables] = React.useState("");
  const [offerContentDeadline, setOfferContentDeadline] = React.useState("");
  const [offerPostingDeadline, setOfferPostingDeadline] = React.useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024; //  5 MB
    const isVideo = file.type.startsWith("video/");
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      showToast(
        "error",
        `File too large. Maximum size is ${isVideo ? "50 MB" : "5 MB"} for ${isVideo ? "videos" : "images"}.`
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "chat");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to upload file");
      }

      await handleSendFile?.(data.data.url, file.name, file.type);
      showToast("success", "File shared successfully!");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "File sharing failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCreateOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerTitle.trim()) {
      showToast("error", "Offer title is required");
      return;
    }
    const amountVal = Number(offerAmount);
    if (Number.isNaN(amountVal) || amountVal <= 0) {
      showToast("error", "Please enter a valid amount");
      return;
    }

    try {
      await handleSendOffer?.({
        title: offerTitle,
        amount: Math.round(amountVal * 100), // convert to paise
        description: offerDescription,
        deliverables: offerDeliverables,
        contentDeadline: offerContentDeadline,
        postingDeadline: offerPostingDeadline,
      });
      showToast("success", "Offer sent successfully!");
      setIsOfferModalOpen(false);
      setOfferTitle("");
      setOfferAmount("");
      setOfferDescription("");
      setOfferDeliverables("");
      setOfferContentDeadline("");
      setOfferPostingDeadline("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send offer";
      showToast("error", message);
    }
  };

  const renderInputAreaContent = () => {
    if (isChatUserBlocked) {
      return (
        <div className="chat-blocked-banner font-bold text-xs text-rose px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
          🚫 Messaging is disabled because a block relationship exists with this account.
        </div>
      );
    }
    if (!hasActiveDeal) {
      return (
        <div className="chat-blocked-banner font-semibold text-xs text-amber-400 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center flex items-center justify-center gap-2">
          <span>🔒 Messaging is enabled once an application or campaign deal is initiated.</span>
        </div>
      );
    }
    return (
      <div className="flex gap-2 items-center bg-secondary p-1.5 rounded-xl border border-card shadow-sm">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          id="chat-file-upload-input"
          aria-label="Attach image or document"
        />

        {/* Attach File Button */}
        <Button
          variant="ghost"
          title="Attach Image or Document"
          aria-label="Share a file"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="p-2 text-muted hover:text-primary hover:bg-tertiary rounded-lg cursor-pointer"
        >
          {isUploading ? (
            <span className="loading w-4 h-4" />
          ) : (
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          )}
        </Button>

        {/* Create Proposal Button */}
        <Button
          variant="ghost"
          title="Send Custom Deal Proposal"
          aria-label="Create a proposal"
          onClick={() => setIsOfferModalOpen(true)}
          className="p-2 text-muted hover:text-blue-400 hover:bg-tertiary rounded-lg cursor-pointer"
        >
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M10 9H8" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
          </svg>
        </Button>

        {/* Main Message Input */}
        <Input
          type="text"
          id="chat-message-input"
          aria-label="Type your message"
          placeholder="Type a message... (Press Enter to send)"
          value={newMessage}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={() => publishTyping(false)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="flex-1 bg-transparent border-0 focus:ring-0 text-sm placeholder:text-muted py-2 px-2"
        />

        {/* Send Button */}
        <Button
          variant="primary"
          aria-label="Send message"
          onClick={handleSend}
          disabled={!newMessage.trim()}
          className="px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm"
        >
          <span>Send</span>
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </Button>
      </div>
    );
  };

  return (
    <div
      className="chat-input-area border-t border-card p-4 bg-secondary/80 backdrop-blur-md"
      data-blocked={isChatUserBlocked || !hasActiveDeal}
    >
      {renderInputAreaContent()}

      {/* Direct Custom Offer Creation Modal */}
      <Modal
        open={isOfferModalOpen}
        onClose={() => setIsOfferModalOpen(false)}
        title="Send Custom Deal Proposal"
        maxWidth="500px"
      >
        <form onSubmit={handleCreateOfferSubmit} className="flex flex-col gap-4">
          <Input
            label="Proposal Title"
            id="offer-title-input"
            value={offerTitle}
            onChange={(e) => setOfferTitle(e.target.value)}
            placeholder="e.g. 2 Dedicated YouTube Shorts + 1 Instagram Reel"
            fullWidth
            required
          />
          <Input
            label="Proposed Rate (₹ in INR)"
            type="number"
            id="offer-amount-input"
            value={offerAmount}
            onChange={(e) => setOfferAmount(e.target.value)}
            placeholder="e.g. 15000"
            fullWidth
            required
          />
          <Textarea
            label="Description & Scope"
            id="offer-description-textarea"
            value={offerDescription}
            onChange={(e) => setOfferDescription(e.target.value)}
            placeholder="Describe collaboration requirements, guidelines, deliverables..."
            rows={3}
            fullWidth
          />
          <Input
            label="Deliverables Summary"
            id="offer-deliverables-input"
            value={offerDeliverables}
            onChange={(e) => setOfferDeliverables(e.target.value)}
            placeholder="e.g. 2 Shorts, 1 Reel"
            fullWidth
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Content Draft Deadline"
              type="date"
              id="offer-content-deadline-input"
              value={offerContentDeadline}
              onChange={(e) => setOfferContentDeadline(e.target.value)}
              fullWidth
            />
            <Input
              label="Live Posting Deadline"
              type="date"
              id="offer-posting-deadline-input"
              value={offerPostingDeadline}
              onChange={(e) => setOfferPostingDeadline(e.target.value)}
              fullWidth
            />
          </div>
          <div className="flex justify-end gap-3 mt-3 pt-3 border-t border-card">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsOfferModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Send Proposal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function ChatPanel({ state }: Readonly<ChatPanelProps>) {
  const { selectedConversation, selectedChat } = state;

  return (
    <div
      className={`flex-1 flex flex-col ${
        !selectedConversation ? "hide-mobile" : ""
      }`}
    >
      {selectedChat ? (
        <>
          <ChatHeader state={state} />
          <MessageList state={state} />
          <ChatInputArea state={state} />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center flex-col gap-5 p-8 text-center bg-primary">
          <div className="w-18 h-18 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-3xl shadow-lg">
            💬
          </div>
          <div className="max-w-400">
            <h2 className="text-xl font-black text-primary mb-2">
              VyaparMedia Workspace Messages
            </h2>
            <p className="text-sm text-secondary leading-relaxed mb-6">
              Coordinate campaign briefs, submit content drafts, share deliverables, and send custom proposals in a secure environment.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="p-3 bg-secondary rounded-xl border border-card">
                <div className="text-base mb-1">🔒</div>
                <div className="text-xs font-bold text-primary mb-0.5">Protected</div>
                <div className="text-3xs text-muted">Escrow funded milestones</div>
              </div>
              <div className="p-3 bg-secondary rounded-xl border border-card">
                <div className="text-base mb-1">⚡</div>
                <div className="text-xs font-bold text-primary mb-0.5">Instant Offers</div>
                <div className="text-3xs text-muted">Direct in-chat agreements</div>
              </div>
              <div className="p-3 bg-secondary rounded-xl border border-card">
                <div className="text-base mb-1">📁</div>
                <div className="text-xs font-bold text-primary mb-0.5">Media Share</div>
                <div className="text-3xs text-muted">High-res deliverable reviews</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ReportUserModalProps {
  readonly state: ReturnType<typeof useMessages>;
}

export function ReportUserModal({ state }: Readonly<ReportUserModalProps>) {
  const {
    isReportModalOpen,
    setIsReportModalOpen,
    reportReason,
    setReportReason,
    reportDescription,
    setReportDescription,
    submittingReport,
    handleReportUserSubmit,
  } = state;

  return (
    <Modal
      open={isReportModalOpen}
      onClose={() => {
        setIsReportModalOpen(false);
        setReportReason("");
        setReportDescription("");
      }}
      title="Report User"
      maxWidth="450px"
    >
      <form onSubmit={handleReportUserSubmit}>
        <Select
          label="Reason"
          id="report-reason-select"
          value={reportReason}
          onChange={(e) => setReportReason(e.target.value)}
          className="mb-4"
          fullWidth
          required
        >
          <option value="">Select a reason...</option>
          <option value="SPAM">Spam or advertising</option>
          <option value="HARASSMENT">Harassment or abusive language</option>
          <option value="FRAUD">Fraudulent activity or scam</option>
          <option value="INAPPROPRIATE">Inappropriate content or profile</option>
          <option value="OFF_PLATFORM_PAYMENT">Asking for off-platform payment</option>
          <option value="OTHER">Other reason</option>
        </Select>
        <Textarea
          label="Details (optional)"
          id="report-details-textarea"
          value={reportDescription}
          onChange={(e) => setReportDescription(e.target.value)}
          placeholder="Provide additional details to help our moderation team understand..."
          rows={4}
          className="mb-4"
          fullWidth
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setIsReportModalOpen(false);
              setReportReason("");
              setReportDescription("");
            }}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submittingReport}>
            {submittingReport ? "Submitting..." : "Submit Report"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
