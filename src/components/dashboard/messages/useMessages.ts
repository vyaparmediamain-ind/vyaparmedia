"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { fetcher } from "@/lib/fetcher";
import { logger } from "@/lib/logger-client";
import { detectContactLeak, ContactLeakResult } from "@/lib/contact-leak-detector";
import {
  subscribeToIncomingMessages,
  subscribeToTypingPresence,
} from "@/lib/supabase-messaging-realtime";
import type { ToastItem, ToastType } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import { formatTime } from "@/lib/utils-client";
import { formatUserError, USER_SUCCESS_MESSAGES } from "@/lib/user-messages";
import {
  Message,
  Conversation,
  RawConversation,
  RawMessage,
  normalizeConversation,
  sendMessageSchema,
  reportUserSchema,
} from "./MessagesHelpers";
import { DealContextData } from "./DealContextMiniCard";
import { type SingleDealResponse as DealPartnerDetailResponse } from "@/lib/schemas";


export function useMessages() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const dealIdParam = searchParams?.get("deal") || searchParams?.get("dealId");
  const withParam = searchParams?.get("with") || searchParams?.get("recipientId") || searchParams?.get("userId");
  const processedDealRef = useRef<string | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(withParam || null);
  const [currentDealId, setCurrentDealId] = useState<string | null>(dealIdParam || null);
  const [dealDetails, setDealDetails] = useState<DealContextData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionsRef = useRef<Record<string, number>>({});

  const typingRefreshRef = useRef<number>(0);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const broadcastTypingRef = useRef<((isTyping: boolean) => void) | null>(null);

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

  // Live Contact Leak Detection while typing
  const contactLeakResult: ContactLeakResult = useMemo(() => {
    return detectContactLeak(newMessage);
  }, [newMessage]);

  // Load conversations
  const {
    data: messagesData,
    isLoading: loadingConversations,
    mutate: mutateConversations,
  } = useSWR<RawConversation[] | { conversations?: RawConversation[] }>(
    session ? "/api/messages" : null,
    fetcher
  );

  useEffect(() => {
    if (!messagesData) return;
    const convsRaw = Array.isArray(messagesData) ? messagesData : messagesData.conversations || [];
    const convs: Conversation[] = convsRaw
      .map((raw: RawConversation) => normalizeConversation(raw))
      .filter((conv: Conversation | null): conv is Conversation => Boolean(conv));

    setConversations((prev) => {
      const mergedMap = new Map<string, Conversation>();
      for (const c of convs) {
        mergedMap.set(c.userId, c);
      }
      for (const p of prev) {
        if (!mergedMap.has(p.userId)) {
          mergedMap.set(p.userId, p);
        }
      }
      return Array.from(mergedMap.values());
    });

    setSelectedConversation((prev) => {
      if (prev) return prev;
      if (withParam) return withParam;
      return convs[0]?.userId || null;
    });
  }, [messagesData, withParam]);

  const addConversationStub = useCallback(
    (partner: { userId: string; name: string; avatar?: string; userType: string }) => {
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
    },
    []
  );

  useEffect(() => {
    if (withParam && withParam !== selectedConversation) {
      setSelectedConversation(withParam);
    }
  }, [withParam, selectedConversation]);

  useEffect(() => {
    if (dealIdParam) {
      setCurrentDealId(dealIdParam);
    }
  }, [dealIdParam]);

  // Fetch deal details when currentDealId is present
  useEffect(() => {
    if (!currentDealId || !session) {
      setDealDetails(null);
      return;
    }

    apiClient.deals
      .getById<DealPartnerDetailResponse>(currentDealId)
      .then((data) => {
        if (data?.deal) {
          setDealDetails({
            id: data.deal.id,
            title: data.deal.campaign?.title || "Campaign Deal",
            amountInPaise: data.deal.totalAmount || data.deal.amount || 0,
            status: data.deal.status,
            submissionDeadline: data.deal.submissionDeadline || null,
            brandName: data.deal.brand?.companyName || null,
            creatorName: data.deal.influencer?.displayName || null,
          });
        }
      })
      .catch((err) => {
        logger.error("[messages] Error loading deal details:", err);
      });
  }, [currentDealId, session]);

  // Load deal partner from URL deal param if needed
  useEffect(() => {
    if (!dealIdParam || !session || loadingConversations) return;
    if (processedDealRef.current === dealIdParam) return;

    const currentUserId = session?.user?.id;
    if (!currentUserId) return;

    processedDealRef.current = dealIdParam;

    apiClient.deals
      .getById<DealPartnerDetailResponse>(dealIdParam)
      .then((data) => {
        const deal = data?.deal;
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

        const partnerUserId = partner.userId;
        if (!partnerUserId) return;

        setSelectedConversation(partnerUserId);
        addConversationStub({
          userId: partnerUserId,
          name: partner.name,
          ...(partner.avatar ? { avatar: partner.avatar } : {}),
          userType: partner.userType,
        });
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          logger.error("[messages] Error loading deal for messaging:", err);
        }
      });
  }, [dealIdParam, session, loadingConversations, addConversationStub]);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(
    async (showLoading = false) => {
      if (!selectedConversation || !session) return;

      if (showLoading) setLoadingMessages(true);
      try {
        const data = (await apiClient.messages.list({
          with: selectedConversation,
        })) as {
          messages?: RawMessage[];
          dealId?: string | null;
          presence?: { isTyping?: boolean };
          hasActiveDeal?: boolean;
        };

        try {
          const blockData = await apiClient.users.checkBlock(selectedConversation);
          setIsChatUserBlocked(blockData?.data?.isBlocked || false);
        } catch (blockErr) {
          logger.error("[messages] Failed to fetch block status:", blockErr);
        }

        const mappedMessages: Message[] = (data.messages || []).map((m: RawMessage) => ({
          id: m.id,
          senderId: m.senderId,
          content: m.content,
          createdAt: formatTime(m.createdAt),
          rawCreatedAt: m.createdAt,
          isMe: m.senderId === session?.user?.id,
          isBlocked: Boolean(m.isBlocked),
          hasWarning: Boolean(m.hasWarning),
          isRead: Boolean(m.isRead),
          readAt: m.readAt || null,
          messageType: m.messageType || "TEXT",
          dealId: data.dealId || null,
          status: "sent",
          metadata: m.metadata || null,
        }));


        setMessages(mappedMessages);
        setIsPeerTyping(Boolean(data.presence?.isTyping));
        setHasActiveDeal(data.hasActiveDeal ?? true);
        if (data.dealId && !currentDealId) {
          setCurrentDealId(data.dealId);
        }
      } catch (err) {
        logger.error("[messages] Failed to fetch messages:", err);
        setIsPeerTyping(false);
      } finally {
        if (showLoading) setLoadingMessages(false);
      }
    },
    [selectedConversation, session, currentDealId]
  );

  // 1. Initial message load & Fast Fallback Polling (2.5s for fast delivery)
  useEffect(() => {
    if (!selectedConversation || !session) return;

    fetchMessages(true);
    const interval = globalThis.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchMessages(false);
      }
    }, 2500);

    return () => globalThis.clearInterval(interval);
  }, [fetchMessages, selectedConversation, session]);

  // 2. Real-time Incoming Message Subscription (Supabase Realtime)
  useEffect(() => {
    const currentUserId = session?.user?.id;
    if (!currentUserId) return;

    const unsubscribe = subscribeToIncomingMessages(currentUserId, (incomingMsg) => {
      // If the incoming message belongs to our currently open conversation
      if (
        incomingMsg.senderId === selectedConversation ||
        incomingMsg.receiverId === selectedConversation
      ) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === incomingMsg.id)) {
            return prev;
          }
          const formattedMsg: Message = {
            id: incomingMsg.id,
            senderId: incomingMsg.senderId,
            content: incomingMsg.content,
            createdAt: formatTime(incomingMsg.createdAt),
            rawCreatedAt: incomingMsg.createdAt,
            isMe: incomingMsg.senderId === currentUserId,
            messageType: (incomingMsg.messageType as Message["messageType"]) || "TEXT",
            dealId: incomingMsg.dealId || null,
            status: "sent",
            metadata: (incomingMsg.metadata as Message["metadata"]) || null,
          };
          return [...prev, formattedMsg];
        });
      }

      // Also refresh conversation previews
      fetchMessages(false);
    });

    return () => {
      unsubscribe();
    };
  }, [session, selectedConversation, fetchMessages]);

  // 3. Real-time Typing Presence Subscription
  useEffect(() => {
    const currentUserId = session?.user?.id;
    if (!currentUserId || !selectedConversation) return;

    const convKey = [currentUserId, selectedConversation].sort().join("-");
    const { broadcastTyping, unsubscribe } = subscribeToTypingPresence(convKey, (isTyping) => {
      setIsPeerTyping(isTyping);
    });

    broadcastTypingRef.current = broadcastTyping;

    return () => {
      unsubscribe();
      broadcastTypingRef.current = null;
    };
  }, [session, selectedConversation]);

  // Save and Restore Scroll Positions
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !selectedConversation) return;

    // Restore scroll position
    const savedPos = scrollPositionsRef.current[selectedConversation];
    if (typeof savedPos === "number") {
      container.scrollTop = savedPos;
    } else {
      container.scrollTop = container.scrollHeight;
    }

    const handleScroll = () => {
      if (selectedConversation) {
        scrollPositionsRef.current[selectedConversation] = container.scrollTop;
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [selectedConversation]);

  // Scroll to bottom when new messages arrive
  const lastMessageId = messages.at(-1)?.id ?? "";
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastMessageId]);

  // Typing emitter
  const publishTyping = useCallback(
    async (isTyping: boolean) => {
      if (!selectedConversation) return;

      // 1. Broadcast via Supabase Realtime channel
      if (broadcastTypingRef.current) {
        broadcastTypingRef.current(isTyping);
      }

      // 2. Also send lightweight backend PATCH
      try {
        await apiClient.messages.setTyping({
          with: selectedConversation,
          isTyping,
        });
      } catch {
        // Best-effort typing indicator
      }
    },
    [selectedConversation]
  );


  const handleInputChange = (value: string) => {
    setNewMessage(value);
    if (!selectedConversation) return;

    const now = Date.now();
    if (value.trim() && now - typingRefreshRef.current > 2000) {
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

  // Optimistic Message Send & Failure Retry
  const executeSendMessage = async (tempId: string, content: string) => {
    try {
      const payload = (await apiClient.messages.send({
        receiverId: selectedConversation || undefined,
        content,
        ...(currentDealId ? { dealId: currentDealId } : {}),
      })) as { success?: boolean; message?: RawMessage; error?: string };

      if (!payload?.success) {
        throw new Error(payload?.error || "Failed to send message");
      }


      if (payload?.message) {
        const sentMsg = payload.message;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId
              ? {
                  ...msg,
                  id: sentMsg.id || msg.id,
                  createdAt: sentMsg.createdAt
                    ? formatTime(sentMsg.createdAt)
                    : msg.createdAt,
                  rawCreatedAt: sentMsg.createdAt || msg.rawCreatedAt,
                  status: "sent",
                  isBlocked: Boolean(sentMsg.isBlocked),
                  hasWarning: Boolean(sentMsg.hasWarning),
                  isRead: Boolean(sentMsg.isRead),
                  readAt: sentMsg.readAt || null,
                }
              : msg
          )
        );
      }

      fetchMessages(false);
    } catch (err) {
      logger.error("[messages] Failed to send message:", err);
      // Keep the message bubble in failed state with retry button
      setMessages((prev) =>
        prev.map((msg) => (msg.id === tempId ? { ...msg, status: "failed" } : msg))
      );
      showToast("error", formatUserError(err, "Message send failed. Tap to retry."));
    }
  };

  const handleSend = async () => {
    if (!selectedConversation) return;

    const validation = sendMessageSchema.safeParse({ content: newMessage });
    if (!validation.success) {
      showToast("error", validation.error.issues[0]?.message || "Message cannot be empty");
      return;
    }

    const trimmedMessage = validation.data.content.trim();
    const tempId = `temp-${Date.now()}`;

    // Optimistic UI push
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        senderId: session?.user?.id || "me",
        content: trimmedMessage,
        createdAt: formatTime(new Date()),
        rawCreatedAt: new Date().toISOString(),
        isMe: true,
        status: "sending",
      },
    ]);

    setNewMessage("");
    publishTyping(false);

    await executeSendMessage(tempId, trimmedMessage);
  };

  const handleRetryMessage = async (failedId: string) => {
    const targetMsg = messages.find((m) => m.id === failedId);
    if (!targetMsg) return;

    // Reset status to sending
    setMessages((prev) =>
      prev.map((m) => (m.id === failedId ? { ...m, status: "sending" } : m))
    );

    await executeSendMessage(failedId, targetMsg.content);
  };

  const handleBlockUser = async () => {
    if (!selectedConversation) return;
    const confirmBlock = window.confirm(
      "Are you sure you want to block this user? You will not be able to send or receive messages from them."
    );
    if (!confirmBlock) return;

    try {
      await apiClient.users.blockUser({ blockedUserId: selectedConversation, action: "block" });
      setIsChatUserBlocked(true);
      showToast("success", USER_SUCCESS_MESSAGES.USER_BLOCKED);
    } catch (err) {
      showToast("error", formatUserError(err, "Failed to block user. Please try again."));
    }
  };

  const handleUnblockUser = async () => {
    if (!selectedConversation) return;
    try {
      await apiClient.users.blockUser({ blockedUserId: selectedConversation, action: "unblock" });
      setIsChatUserBlocked(false);
      showToast("success", USER_SUCCESS_MESSAGES.USER_UNBLOCKED);
    } catch (err) {
      showToast("error", formatUserError(err, "Failed to unblock user. Please try again."));
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversation) return;

    const validation = reportUserSchema.safeParse({
      reason: reportReason,
      description: reportDescription,
    });
    if (!validation.success) {
      showToast("error", validation.error.issues[0]?.message || "Invalid report input");
      return;
    }

    setSubmittingReport(true);
    try {
      await apiClient.users.reportUser({
        reportedUserId: selectedConversation,
        reason: reportReason,
        description: reportDescription,
      });
      showToast("success", USER_SUCCESS_MESSAGES.REPORT_SUBMITTED);
      setIsReportModalOpen(false);
      setReportReason("");
      setReportDescription("");
    } catch (err) {
      showToast("error", formatUserError(err, "Failed to submit report. Please try again."));
    } finally {
      setSubmittingReport(false);
    }
  };


  const refreshConversations = useCallback(async () => {
    await Promise.all([
      mutateConversations(),
      selectedConversation ? fetchMessages(false) : Promise.resolve(),
    ]);
  }, [mutateConversations, selectedConversation, fetchMessages]);

  const selectedChat = useMemo(() => {
    return conversations.find((c) => c.userId === selectedConversation) || null;
  }, [conversations, selectedConversation]);

  return {
    status,
    session,
    conversations,
    refreshConversations,
    selectedConversation,
    setSelectedConversation,
    currentDealId,
    dealDetails,
    messages,
    newMessage,
    handleInputChange,
    publishTyping,
    handleSend,
    handleRetryMessage,
    handleBlockUser,
    handleUnblockUser,
    handleReportSubmit,
    handleReportUserSubmit: handleReportSubmit,
    isPeerTyping,
    loadingMessages,
    loadingConversations,
    messagesEndRef,
    scrollContainerRef,
    isChatUserBlocked,
    isReportModalOpen,
    setIsReportModalOpen,
    reportReason,
    setReportReason,
    reportDescription,
    setReportDescription,
    submittingReport,
    hasActiveDeal,
    selectedChat,
    contactLeakResult,
    toasts,
    removeToast,
    showToast,
  };
}
