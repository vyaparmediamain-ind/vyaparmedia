"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { NotificationItem } from "@/lib/notification-utils";
import { logger } from "@/lib/logger-client";
import { apiClient } from "@/lib/api-client";

export interface NotificationToast {
  id: string;
  title: string;
  message: string;
  type: string;
  url?: string | undefined;
  data?: Record<string, unknown> | null | undefined;
}

export function useNotificationCenter(userId?: string | null) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeToast, setActiveToast] = useState<NotificationToast | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const inFlightRef = useRef<boolean>(false);
  const lastFetchTimeRef = useRef<number>(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const fetchNotifications = useCallback(async (force = false) => {
    if (!userId) return;
    const now = Date.now();
    // Throttle automatic refreshes to at least 15 seconds to avoid hammering the DB
    if (!force && (inFlightRef.current || now - lastFetchTimeRef.current < 15000)) {
      return;
    }
    try {
      inFlightRef.current = true;
      setIsLoading(true);
      const data = await apiClient.settings.getNotifications({ limit: 30 });
      if (!isMountedRef.current) return;
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount ?? 0);
      lastFetchTimeRef.current = Date.now();
    } catch (err) {
      logger.warn("[useNotificationCenter] Failed to fetch notifications", { error: err });
    } finally {
      inFlightRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [userId]);

  // Initial load
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Network interruption & tab visibility reconciliation:
  // Whenever the user reconnects to the network or focuses the tab,
  // reconcile state from the server to guarantee zero missed events.
  useEffect(() => {
    function handleOnlineOrVisible() {
      if (document.visibilityState === "visible") {
        fetchNotifications();
      }
    }

    window.addEventListener("online", handleOnlineOrVisible);
    document.addEventListener("visibilitychange", handleOnlineOrVisible);

    return () => {
      window.removeEventListener("online", handleOnlineOrVisible);
      document.removeEventListener("visibilitychange", handleOnlineOrVisible);
    };
  }, [fetchNotifications]);

  // Trigger foreground In-App Toast
  const triggerToast = useCallback((notif: NotificationToast) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setActiveToast(notif);
    // Non-intrusive auto-dismiss after 4.5 seconds
    toastTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setActiveToast(null);
      }
    }, 4500);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setActiveToast(null);
  }, []);

  // Adaptive background polling: refresh notifications every 30 seconds when tab is active
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchNotifications();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [userId, fetchNotifications]);

  // Mark single notification as read (with zero off-by-one errors)
  const markAsRead = useCallback(
    async (notificationId: string) => {
      // Optimistic update
      let wasUnread = false;
      setNotifications((prev) =>
        prev.map((n) => {
          if (n.id === notificationId) {
            if (!n.isRead) {
              wasUnread = true;
            }
            return { ...n, isRead: true };
          }
          return n;
        })
      );

      // Only decrement if the item was actually unread (prevents off-by-one)
      if (wasUnread) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }

      try {
        await apiClient.settings.markNotificationsAsRead({
          notificationIds: [notificationId],
        });
      } catch (err) {
        logger.error("[useNotificationCenter] Failed to mark notification as read", err);
      }
    },
    []
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await apiClient.settings.markNotificationsAsRead({ markAll: true });
    } catch (err) {
      logger.error("[useNotificationCenter] Failed to mark all as read", err);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    activeToast,
    dismissToast,
    markAsRead,
    markAllAsRead,
    refresh: () => fetchNotifications(true),
  };
}
