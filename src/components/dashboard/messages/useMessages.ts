"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { fetcher } from "@/lib/fetcher";
import { logger } from "@/lib/logger-client";
import { checkMessageForContacts } from "@/lib/contact-filter";
import { ToastItem, ToastType } from "@/components/ui/toast";
import {
Message,
Conversation,
RawConversation,
RawMessage,
normalizeConversation,
sendMessageSchema,
reportUserSchema,
} from "./MessagesHelpers";

export function useMessages() {
const { data: session, status } = useSession();
const searchParams = useSearchParams();
const dealIdParam = searchParams?.get("deal");
const processedDealRef = useRef<string | null>(null);
const [conversations, setConversations] = useState<Conversation[]>([]);
const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
const [messages, setMessages] = useState<Message[]>([]);
const [newMessage, setNewMessage] = useState("");
const [isPeerTyping, setIsPeerTyping] = useState(false);
const [loadingMessages, setLoadingMessages] = useState(false);
const messagesEndRef = useRef<HTMLDivElement>(null);
const typingRefreshRef = useRef<number>(0);
const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const [isChatUserBlocked, setIsChatUserBlocked] = useState(false);
const [isReportModalOpen, setIsReportModalOpen] = useState(false);
const [reportReason, setReportReason] = useState("");
const [reportDescription, setReportDescription] = useState("");
const [submittingReport, setSubmittingReport] = useState(false);
const [hasActiveDeal, setHasActiveDeal] = useState(true);

const [toasts, setToasts] = useState<ToastItem[]>([]);
const removeToast = (toastId: string) => {
setToasts((prev) => prev.filter((t) => t.id !== toastId));
};
const showToast = (type: ToastType, message: string) => {
const toastId = String(Date.now());
setToasts((prev) => [...prev, { id: toastId, type, message }]);
setTimeout(() => removeToast(toastId), 5000);
};

const getKeepIfStillExists = useCallback((convs: Conversation[]) => {
return (prev: string | null) => {
if (!prev) return null;
return convs.some((c) => c.userId === prev) ? prev : null;
};
}, []);

const { data: messagesData, isLoading: loadingConversations } = useSWR<RawConversation[] | { conversations?: RawConversation[] }>(
session ? "/api/messages" : null,
fetcher
);

useEffect(() => {
if (!messagesData) return;
const convsRaw = Array.isArray(messagesData) ? messagesData : messagesData.conversations || [];
const convs: Conversation[] = convsRaw
.map((raw: RawConversation) => normalizeConversation(raw))
.filter((conv: Conversation | null): conv is Conversation => Boolean(conv));
setConversations(convs);
setSelectedConversation(getKeepIfStillExists(convs));
}, [messagesData, getKeepIfStillExists]);

const addConversationStub = useCallback((partner: { userId: string; name: string; avatar?: string; userType: string }) => {
setConversations((prev) => {
const exists = prev.some((c) => c.userId === partner.userId);
if (exists) return prev;

const stubConv: Conversation = {
id: partner.userId,
userId: partner.userId,
name: partner.name,
avatar: partner.avatar || null,
userType: partner.userType,
lastMessage: "",
lastMessageTime: "",
unread: 0,
};
return [stubConv, ...prev];
});
}, []);

useEffect(() => {
if (!dealIdParam || !session || loadingConversations) return;
if (processedDealRef.current === dealIdParam) return;

const currentUserId = session?.user?.id;
if (!currentUserId) return;

processedDealRef.current = dealIdParam;

fetch(`/api/deals/${encodeURIComponent(dealIdParam)}`)
.then(async (res) => {
if (!res.ok) throw new Error("Failed to fetch deal details");
return res.json();
})
.then((data) => {
const deal = data.deal;
if (!deal) return;

const isInfluencer = deal.influencer?.userId === currentUserId;
const partner = isInfluencer
? {
userId: deal.brand?.userId,
name: deal.brand?.companyName || "Brand",
avatar: deal.brand?.logo,
userType: "BRAND",
}
: {
userId: deal.influencer?.userId,
name: deal.influencer?.displayName || "Influencer",
avatar: deal.influencer?.avatar,
userType: "INFLUENCER",
};

if (!partner.userId) return;

setSelectedConversation(partner.userId);
addConversationStub(partner);
})
.catch((err) => {
if (err?.name !== "AbortError") {
logger.error("[messages] Error loading deal for messaging:", err);
}
});
}, [dealIdParam, session, loadingConversations, addConversationStub]);

const fetchMessages = useCallback(
async (showLoading = false) => {
if (!selectedConversation || !session) return;

if (showLoading) setLoadingMessages(true);
try {
const response = await fetch(`/api/messages?with=${encodeURIComponent(selectedConversation)}`, {
cache: "no-store",
});
const data = await response.json();
if (!response.ok) {
throw new Error(data?.error || "Failed to load messages");
}

try {
const blockRes = await fetch(`/api/users/block?checkUserId=${encodeURIComponent(selectedConversation)}`);
if (blockRes.ok) {
const blockData = await blockRes.json();
setIsChatUserBlocked(blockData.data?.isBlocked || false);
}
} catch (blockErr) {
logger.error("[messages] Failed to fetch block status:", blockErr);
}

    const mappedMessages = (data.messages || []).map((m: RawMessage) => ({
      id: m.id,
      senderId: m.senderId,
      content: m.content,
      createdAt: new Date(m.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      rawCreatedAt: m.createdAt,
      isMe: m.senderId === session?.user?.id,
      isBlocked: m.isBlocked,
      hasWarning: m.hasWarning,
      isRead: Boolean(m.isRead),
      readAt: m.readAt || null,
      messageType: m.messageType || "TEXT",
      fileUrl: m.fileUrl || null,
      metadata: m.metadata || null,
    }));
    setMessages(mappedMessages);
setIsPeerTyping(Boolean(data.presence?.isTyping));
setHasActiveDeal(data.hasActiveDeal ?? true);
} catch (err) {
logger.error("[messages] Failed to fetch messages:", err);
setMessages([]);
setIsPeerTyping(false);
} finally {
if (showLoading) setLoadingMessages(false);
}
},
[selectedConversation, session]
);

useEffect(() => {
if (!selectedConversation || !session) return;

fetchMessages(true);
const interval = globalThis.setInterval(() => {
fetchMessages(false);
}, 10000);

return () => globalThis.clearInterval(interval);
}, [fetchMessages, selectedConversation, session]);

useEffect(() => {
setIsChatUserBlocked(false);
setReportReason("");
setReportDescription("");
}, [selectedConversation]);

const lastMessageId = messages.at(-1)?.id ?? "";
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, [lastMessageId]);

const publishTyping = useCallback(
async (isTyping: boolean) => {
if (!selectedConversation) return;

try {
await fetch("/api/messages", {
method: "PATCH",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
with: selectedConversation,
isTyping,
}),
});
} catch {
// Typing presence is best-effort; messages still work without Redis.
}
},
[selectedConversation]
);

const handleInputChange = (value: string) => {
setNewMessage(value);
if (!selectedConversation) return;

const now = Date.now();
if (value.trim() && now - typingRefreshRef.current > 3000) {
typingRefreshRef.current = now;
publishTyping(true);
}

if (typingStopTimerRef.current) {
clearTimeout(typingStopTimerRef.current);
}
typingStopTimerRef.current = setTimeout(() => {
publishTyping(false);
}, 2500);
};

useEffect(() => {
setIsPeerTyping(false);
typingRefreshRef.current = 0;

return () => {
if (typingStopTimerRef.current) {
clearTimeout(typingStopTimerRef.current);
}
publishTyping(false);
};
}, [publishTyping, selectedConversation]);

const handleSend = async () => {
if (!selectedConversation) return;

const validation = sendMessageSchema.safeParse({ content: newMessage });
if (!validation.success) {
showToast("error", validation.error.issues[0]?.message || "Message cannot be empty");
return;
}

const trimmedMessage = validation.data.content.trim();

const filterResult = checkMessageForContacts(trimmedMessage);
if (filterResult.hasContactInfo) {
showToast("error", "Warning: Contact details detected. You cannot share emails, phone numbers, links, or social handles before a contract is finalized.");
return;
}

const tempId = `temp-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        senderId: session?.user?.id || "me",
        content: trimmedMessage,
        createdAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        rawCreatedAt: new Date().toISOString(),
        isMe: true,
      },
    ]);

    const messageCopy = trimmedMessage;
    setNewMessage("");
    publishTyping(false);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: selectedConversation,
          content: messageCopy,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || payload?.message || "Failed to send message");
      }

      if (payload?.message) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId
              ? {
                  ...msg,
                  id: payload.message.id || msg.id,
                  createdAt: payload.message.createdAt
                    ? new Date(payload.message.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : msg.createdAt,
                  rawCreatedAt: payload.message.createdAt || msg.rawCreatedAt,
                  isBlocked: Boolean(payload.message.isBlocked),
                  hasWarning: Boolean(payload.message.hasWarning),
                  isRead: Boolean(payload.message.isRead),
                  readAt: payload.message.readAt || null,
                }
              : msg
          )
        );
      }
      fetchMessages(false);
    } catch (err) {
      logger.error("[messages] Failed to send message:", err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(messageCopy);
      showToast("error", err instanceof Error ? err.message : "Message send failed. Please try again.");
    }
  };

  const handleSendFile = async (fileUrl: string, fileName: string, fileType: string) => {
    if (!selectedConversation) return;

    const tempId = `temp-${Date.now()}`;
    const displayContent = `Shared file: ${fileName}`;

    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        senderId: session?.user?.id || "me",
        content: displayContent,
        createdAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        rawCreatedAt: new Date().toISOString(),
        isMe: true,
        messageType: "FILE",
        fileUrl,
        metadata: { fileName, fileType },
      },
    ]);

try {
const response = await fetch("/api/messages", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
receiverId: selectedConversation,
content: displayContent,
messageType: "FILE",
fileUrl,
metadata: { fileName, fileType },
}),
});

const payload = await response.json();
if (!response.ok || !payload?.success) {
throw new Error(payload?.error || payload?.message || "Failed to send file");
}

fetchMessages(false);
} catch (err) {
logger.error("[messages] Failed to send file message:", err);
setMessages((prev) => prev.filter((m) => m.id !== tempId));
showToast("error", "File sharing failed. Please try again.");
}
};

  const handleSendOffer = async (offerDetails: {
    title: string;
    amount: number; // in paise
    description: string;
    deliverables: string;
    contentDeadline: string;
    postingDeadline: string;
  }) => {
    if (!selectedConversation) return;

    const tempId = `temp-${Date.now()}`;
    const displayContent = `Custom Offer: ${offerDetails.title} (₹${(offerDetails.amount / 100).toLocaleString()})`;

    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        senderId: session?.user?.id || "me",
        content: displayContent,
        createdAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isMe: true,
        messageType: "OFFER",
        metadata: { ...offerDetails, status: "PENDING" },
      },
    ]);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: selectedConversation,
          content: displayContent,
          messageType: "OFFER",
          metadata: { ...offerDetails, status: "PENDING" },
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || payload?.message || "Failed to send offer");
      }

      fetchMessages(false);
    } catch (err) {
      logger.error("[messages] Failed to send offer message:", err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      showToast("error", "Offer creation failed. Please try again.");
    }
  };

  const handleUpdateOfferStatus = async (messageId: string, status: "ACCEPTED" | "DECLINED") => {
    try {
      const response = await fetch(`/api/messages/${encodeURIComponent(messageId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || payload?.message || "Failed to update offer");
      }

      if (status === "ACCEPTED") {
        showToast("success", "Offer accepted! Escrow funds secured and Deal is active.");
      } else {
        showToast("info", "Offer declined.");
      }
      fetchMessages(false);
    } catch (err) {
      logger.error("[messages] Failed to update offer:", err);
      const errorMsg = err instanceof Error ? err.message : "Failed to update offer status. Please try again.";
      showToast("error", errorMsg);
    }
  };

  const handleBlockUser = async () => {
    if (!selectedConversation) return;
    const confirmBlock = window.confirm(
      "Are you sure you want to block this user? You will not be able to send or receive messages from them."
    );
    if (!confirmBlock) return;

    try {
      const res = await fetch("/api/users/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockedUserId: selectedConversation,
          action: "block",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to block user");
      }

      showToast("success", "User blocked successfully");
      setIsChatUserBlocked(true);
      setConversations((prev) => prev.filter((c) => c.userId !== selectedConversation));
      setSelectedConversation(null);
    } catch (err) {
      logger.error("[messages] Block error:", err);
      showToast("error", err instanceof Error ? err.message : "Failed to block user");
    }
  };

  const handleUnblockUser = async () => {
    if (!selectedConversation) return;

    try {
      const res = await fetch("/api/users/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockedUserId: selectedConversation,
          action: "unblock",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to unblock user");
      }

      showToast("success", "User unblocked successfully");
      setIsChatUserBlocked(false);
      fetchMessages(true);
    } catch (err) {
      logger.error("[messages] Unblock error:", err);
      showToast("error", err instanceof Error ? err.message : "Failed to unblock user");
    }
  };

  const handleReportUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversation) return;

    const validation = reportUserSchema.safeParse({
      reason: reportReason,
      description: reportDescription,
    });

    if (!validation.success) {
      showToast("error", validation.error.issues[0]?.message || "Invalid report details");
      return;
    }

    setSubmittingReport(true);
    try {
      const res = await fetch("/api/users/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportedUserId: selectedConversation,
          reason: reportReason,
          description: reportDescription,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to submit report");
      }

      showToast("success", "User reported successfully. Our team will review this report.");
      setIsReportModalOpen(false);
      setReportReason("");
      setReportDescription("");
    } catch (err) {
      logger.error("[messages] Report error:", err);
      showToast("error", err instanceof Error ? err.message : "Failed to report user");
    } finally {
      setSubmittingReport(false);
    }
  };

  const selectedChat = conversations.find((c) => c.userId === selectedConversation);

  return {
    session,
    status,
    conversations,
    selectedConversation,
    setSelectedConversation,
    messages,
    newMessage,
    setNewMessage,
    isPeerTyping,
    loadingConversations,
    loadingMessages,
    messagesEndRef,
    isChatUserBlocked,
    isReportModalOpen,
    setIsReportModalOpen,
    reportReason,
    setReportReason,
    reportDescription,
    setReportDescription,
    submittingReport,
    toasts,
    removeToast,
    handleInputChange,
    handleSend,
    handleSendFile,
    handleSendOffer,
    handleUpdateOfferStatus,
    handleBlockUser,
    handleUnblockUser,
    handleReportUserSubmit,
    selectedChat,
    showToast,
    publishTyping,
    hasActiveDeal,
  };
}
