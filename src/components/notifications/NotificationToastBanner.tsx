"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Wallet,
  Briefcase,
  MessageSquare,
  AlertTriangle,
  Star,
  Bell,
  X,
  ExternalLink,
} from "lucide-react";
import { NotificationToast } from "@/hooks/useNotificationCenter";
import { getNotificationHref, getNotificationTypeMeta } from "@/lib/notification-utils";

interface NotificationToastBannerProps {
  toast: NotificationToast | null;
  onDismiss: () => void;
  onMarkAsRead?: (id: string) => void;
}

function renderToastIcon(iconName: string, className: string) {
  switch (iconName) {
    case "wallet":
      return <Wallet className={className} />;
    case "briefcase":
      return <Briefcase className={className} />;
    case "message":
      return <MessageSquare className={className} />;
    case "shield-alert":
      return <AlertTriangle className={className} />;
    case "star":
      return <Star className={className} />;
    default:
      return <Bell className={className} />;
  }
}

export default function NotificationToastBanner({
  toast,
  onDismiss,
  onMarkAsRead,
}: Readonly<NotificationToastBannerProps>) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  if (!toast) return null;

  const meta = getNotificationTypeMeta(toast.type);
  const href = getNotificationHref({
    id: toast.id,
    type: toast.type,
    title: toast.title,
    message: toast.message,
    isRead: false,
    createdAt: new Date(),
    data: toast.data,
  });

  const handleNavigate = () => {
    if (onMarkAsRead) {
      onMarkAsRead(toast.id);
    }
    onDismiss();
    router.push(href);
  };

  return (
    <AnimatePresence>
      <div
        className="fixed top-[calc(1rem+env(safe-area-inset-top,0px))] right-[max(1rem,calc(env(safe-area-inset-right,0px)+1rem))] md:right-8 z-[99999] max-w-sm w-[calc(100vw-32px)] pointer-events-none"
        role="status"
        aria-live="polite"
      >
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -20, scale: shouldReduceMotion ? 1 : 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -20, scale: shouldReduceMotion ? 1 : 0.95 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: "easeOut" }}
          className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-2xl shadow-black/20 text-foreground cursor-pointer hover:border-primary/40 transition-colors group"
          onClick={handleNavigate}
        >
          {/* Type Icon Badge */}
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${meta.badgeBg} ${meta.borderColor} ${meta.textColor}`}
          >
            {renderToastIcon(meta.iconName, "w-4 h-4")}
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold tracking-tight text-foreground truncate">
                {toast.title}
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground shrink-0">
                {meta.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
              {toast.message}
            </p>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-primary mt-1.5 group-hover:underline">
              <span>View details</span>
              <ExternalLink className="w-3 h-3" />
            </div>
          </div>

          {/* Dismiss Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            aria-label="Dismiss notification"
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
