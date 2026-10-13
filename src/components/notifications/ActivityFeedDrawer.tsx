"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCheck,
  Settings,
  X,
  Wallet,
  Briefcase,
  MessageSquare,
  Star,
  Bell,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import {
  NotificationItem,
  groupNotificationsByRecency,
  formatNotificationTime,
  getNotificationTypeMeta,
  getNotificationHref,
} from "@/lib/notification-utils";
import { Drawer, ListItem } from "@/components/ui";

interface ActivityFeedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

type FilterTab = "all" | "unread" | "deals" | "payments";

function renderActivityIcon(iconName: string, className: string) {
  switch (iconName) {
    case "wallet":
      return <Wallet className={className} />;
    case "briefcase":
      return <Briefcase className={className} />;
    case "message":
      return <MessageSquare className={className} />;
    case "shield-alert":
      return <ShieldAlert className={className} />;
    case "star":
      return <Star className={className} />;
    default:
      return <Bell className={className} />;
  }
}

export default function ActivityFeedDrawer({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
}: Readonly<ActivityFeedDrawerProps>) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      if (activeFilter === "unread") return !notif.isRead;
      if (activeFilter === "deals") {
        const meta = getNotificationTypeMeta(notif.type);
        return meta.category === "deal";
      }
      if (activeFilter === "payments") {
        const meta = getNotificationTypeMeta(notif.type);
        return meta.category === "payment";
      }
      return true;
    });
  }, [notifications, activeFilter]);

  const grouped = useMemo(() => {
    return groupNotificationsByRecency(filteredNotifications);
  }, [filteredNotifications]);

  if (!isOpen) return null;

  const handleItemClick = (notif: NotificationItem) => {
    if (!notif.isRead) {
      onMarkAsRead(notif.id);
    }
    const href = getNotificationHref(notif);
    onClose();
    router.push(href);
  };

  const sections = [
    { title: "Today", items: grouped.today },
    { title: "Earlier this week", items: grouped.thisWeek },
    { title: "Older", items: grouped.older },
  ].filter((s) => s.items.length > 0);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      side="right"
      maxWidth="28rem"
      aria-label="Activity Feed"
      showCloseButton={false}
      className="w-full max-w-md h-full"
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Mobile Swipe Dismiss Indicator */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-card/95 shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Top Header */}
        <div className="p-4 border-b border-border/80 flex items-center justify-between bg-card/95 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight text-foreground">Activity</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-destructive text-destructive-foreground shrink-0 whitespace-nowrap">
                {unreadCount > 99 ? "99+" : unreadCount} new
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline px-2.5 py-2 rounded-md transition-colors min-h-[44px]"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}

            <Link
              href="/dashboard/settings?tab=notifications"
              onClick={onClose}
              className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Notification Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>

            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Close activity drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2.5 border-b border-border/60 bg-muted/30 flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
          {(
            [
              { key: "all", label: "All" },
              { key: "unread", label: "Unread" },
              { key: "deals", label: "Deals" },
              { key: "payments", label: "Payments" },
            ] as const
          ).map((tab) => {
            const active = activeFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveFilter(tab.key)}
                className={`px-3.5 py-1.5 min-h-[44px] rounded-full text-xs font-medium transition-all flex items-center justify-center ${
                  active
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Scrollable Feed List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center h-full">
              <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-foreground">You&apos;re all caught up!</h3>
              <p className="text-xs text-muted-foreground max-w-xs mt-1">
                No notifications in this filter. Important business events like payments and deal updates will appear here in real-time.
              </p>
            </div>
          ) : (
            sections.map((sec) => (
              <div key={sec.title} className="py-2">
                {/* Recency Section Header */}
                <div className="px-4 py-1.5 text-[11px] font-bold tracking-wider uppercase text-muted-foreground/80 bg-muted/20">
                  {sec.title}
                </div>

                {/* Notifications in group */}
                <div className="divide-y divide-border/30">
                  {sec.items.map((item) => {
                    const meta = getNotificationTypeMeta(item.type);
                    const timeStr = formatNotificationTime(item.createdAt);

                    return (
                      <ListItem
                        key={item.id}
                        as="div"
                        variant="flush"
                        compact
                        alignLeading="start"
                        unread={!item.isRead}
                        onClick={() => handleItemClick(item)}
                        aria-label={`Notification: ${item.title}`}
                        leading={
                          <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${meta.badgeBg} ${meta.borderColor} ${meta.textColor} shadow-xs`}
                          >
                            {renderActivityIcon(meta.iconName, "w-5 h-5")}
                          </div>
                        }
                        title={item.title}
                        subtitle={item.message}
                        subtitleClamp={2}
                        meta={
                          <span
                            className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.badgeBg} ${meta.borderColor} ${meta.textColor}`}
                          >
                            {meta.label}
                          </span>
                        }
                        trailing={
                          <span className="text-[10px] sm:text-[11px] text-muted-foreground shrink-0 font-mono whitespace-nowrap">
                            {timeStr}
                          </span>
                        }
                        trailingSecondary={
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                        }
                      />
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border/80 bg-card/95 text-center shrink-0">
          <Link
            href="/dashboard/notifications"
            onClick={onClose}
            className="text-xs font-semibold text-primary hover:underline"
          >
            View all notification history →
          </Link>
        </div>
      </div>
    </Drawer>
  );
}
