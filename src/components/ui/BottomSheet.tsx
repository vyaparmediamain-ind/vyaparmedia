"use client";

import React, { useEffect, useState, useId } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion, type PanInfo, type Transition } from "framer-motion";
import { X } from "lucide-react";
import { haptic } from "@/lib/haptics";

export interface BottomSheetProps {
  readonly open?: boolean;
  readonly isOpen?: boolean;
  readonly onClose: () => void;
  readonly title?: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly maxWidth?: string; // Desktop max-width constraint (default 520px)
  readonly className?: string;
  readonly children: React.ReactNode;
  readonly showCloseButton?: boolean;
  readonly showGrabHandle?: boolean;
  readonly "aria-label"?: string;
  readonly responsive?: boolean; // When true (default), adapts to center modal on desktop (md+)
}

/**
 * Universal Adaptive BottomSheet & Modal Component.
 * - Mobile (< 768px): Native bottom sheet with slide-up spring physics, drag handle,
 *   drag-to-dismiss gesture, and safe-area inset padding.
 * - Desktop (>= 768px): Responsive center-aligned modal dialog.
 */
export function BottomSheet({
  open,
  isOpen,
  onClose,
  title,
  description,
  maxWidth = "520px",
  className = "",
  children,
  showCloseButton = true,
  showGrabHandle = true,
  "aria-label": ariaLabel,
  responsive = true,
}: Readonly<BottomSheetProps>) {
  const isVisible = Boolean(open ?? isOpen);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Listen for Escape key
  useEffect(() => {
    if (!isVisible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isVisible) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [isVisible]);

  if (!mounted) return null;

  const isSheetMode = !responsive || isMobile;

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!isSheetMode) return;
    // Dismiss if dragged down more than 80px or with downward flick velocity
    if (info.offset.y > 80 || info.velocity.y > 350) {
      haptic.light();
      onClose();
    }
  };

  const transition: Transition = shouldReduceMotion
    ? { duration: 0 }
    : isSheetMode
    ? { type: "spring", damping: 28, stiffness: 320 }
    : { type: "spring", stiffness: 350, damping: 26 };

  const variants = isSheetMode
    ? {
        initial: { y: shouldReduceMotion ? 0 : "100%", opacity: shouldReduceMotion ? 0 : 1 },
        animate: { y: 0, opacity: 1 },
        exit: { y: shouldReduceMotion ? 0 : "100%", opacity: shouldReduceMotion ? 0 : 1 },
      }
    : {
        initial: { scale: shouldReduceMotion ? 1 : 0.95, opacity: 0, y: shouldReduceMotion ? 0 : 16 },
        animate: { scale: 1, opacity: 1, y: 0 },
        exit: { scale: shouldReduceMotion ? 1 : 0.95, opacity: 0, y: shouldReduceMotion ? 0 : 16 },
      };

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4 pointer-events-none">
          {/* Backdrop Blur Overlay */}
          <motion.button
            type="button"
            aria-label="Close backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-xs w-full h-full cursor-pointer pointer-events-auto"
          />

          {/* BottomSheet / Modal Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            {...(title ? { "aria-labelledby": titleId } : {})}
            aria-label={ariaLabel || (typeof title === "string" ? title : "Dialog")}
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            transition={transition}
            drag={isSheetMode ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
            {...(!isSheetMode && maxWidth ? { style: { maxWidth } } : {})}
            className={`pointer-events-auto relative w-full bg-card border-border shadow-2xl z-10 flex flex-col overflow-hidden text-foreground ${
              isSheetMode
                ? "rounded-t-3xl border-t max-h-[calc(100dvh-max(16px,env(safe-area-inset-top,0px)))] pb-[max(16px,env(safe-area-inset-bottom,0px))] pl-[max(0px,env(safe-area-inset-left,0px))] pr-[max(0px,env(safe-area-inset-right,0px))]"
                : "rounded-2xl border max-h-[calc(100dvh-max(40px,env(safe-area-inset-top,0px))-env(safe-area-inset-bottom,0px))]"
            } ${className}`}
          >
            {/* Native Mobile Grab Handle (Swipe down to dismiss) */}
            {isSheetMode && showGrabHandle && (
              <div
                className="pt-3 pb-1 flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing select-none"
                title="Swipe down to dismiss"
              >
                <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30 hover:bg-muted-foreground/50 transition-colors" />
              </div>
            )}

            {/* Header */}
            {(title || showCloseButton) && (
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between shrink-0 gap-3">
                <div className="min-w-0 flex-1">
                  {title && (
                    <div id={titleId} className="font-bold text-base text-foreground truncate">
                      {title}
                    </div>
                  )}
                  {description && (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {description}
                    </div>
                  )}
                </div>

                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer shrink-0"
                    aria-label="Close dialog"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {/* Sheet / Modal Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-5">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default BottomSheet;
