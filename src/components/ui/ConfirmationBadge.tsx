"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { useOptimizedMotion } from "@/hooks/useOptimizedMotion";

interface ConfirmationBadgeProps {
  show: boolean;
  message?: string;
  className?: string;
}

/**
 * 2026 UX Confirmation Micro-Component:
 * Answers: "Did that work?" with an immediate, satisfying confirmation
 * pulse. Instantly displays without motion if user prefers reduced motion.
 */
export function ConfirmationBadge({
  show,
  message = "Saved",
  className = "",
}: Readonly<ConfirmationBadgeProps>) {
  const { shouldReduceMotion } = useOptimizedMotion();

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{
            opacity: 0,
            scale: shouldReduceMotion ? 1 : 0.8,
            y: shouldReduceMotion ? 0 : 4,
          }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
            transition: shouldReduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 500, damping: 25 },
          }}
          exit={{
            opacity: 0,
            scale: shouldReduceMotion ? 1 : 0.9,
            transition: shouldReduceMotion ? { duration: 0 } : { duration: 0.15 },
          }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold shadow-sm shrink-0 whitespace-nowrap ${className}`}
        >
          <motion.div
            initial={shouldReduceMotion ? {} : { rotate: -45, scale: 0 }}
            animate={shouldReduceMotion ? {} : { rotate: 0, scale: 1 }}
            transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.05, type: "spring", stiffness: 600 }}
            className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0"
          >
            <Check className="w-2.5 h-2.5 stroke-[3]" />
          </motion.div>
          <span>{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ConfirmationBadge;
