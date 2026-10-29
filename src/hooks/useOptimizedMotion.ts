"use client";

import { useReducedMotion } from "framer-motion";
export { useReducedMotion };

/**
 * Hook to provide accessibility-first motion configs that strictly respect
 * the user's `prefers-reduced-motion` operating system setting.
 * 2026 UX principle: "Animations should answer: did that work? Without causing motion sickness."
 */
export function useOptimizedMotion() {
  const shouldReduceMotion = useReducedMotion();

  // Instant transition fallback if user prefers reduced motion
  const instantTransition = {
    duration: 0,
    ease: "linear",
  };

  // Spring transition for confirming state-changes (subtle scale bounce)
  const confirmationScale = shouldReduceMotion
    ? {
        scale: 1,
        transition: instantTransition,
      }
    : {
        scale: [1, 1.14, 1],
        transition: {
          type: "spring",
          stiffness: 500,
          damping: 25,
          duration: 0.35,
        },
      };

  // Drawer slide-in/out
  const drawerVariants = {
    hidden: {
      x: shouldReduceMotion ? 0 : "100%",
      opacity: shouldReduceMotion ? 0 : 1,
    },
    visible: {
      x: 0,
      opacity: 1,
      transition: shouldReduceMotion
        ? instantTransition
        : {
            type: "spring",
            stiffness: 400,
            damping: 35,
          },
    },
    exit: {
      x: shouldReduceMotion ? 0 : "100%",
      opacity: shouldReduceMotion ? 0 : 1,
      transition: shouldReduceMotion
        ? instantTransition
        : {
            duration: 0.2,
            ease: "easeIn",
          },
    },
  };

  // Modal fade/scale
  const modalVariants = {
    hidden: {
      opacity: 0,
      scale: shouldReduceMotion ? 1 : 0.96,
      y: shouldReduceMotion ? 0 : 12,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: shouldReduceMotion
        ? instantTransition
        : {
            type: "spring",
            stiffness: 450,
            damping: 30,
          },
    },
    exit: {
      opacity: 0,
      scale: shouldReduceMotion ? 1 : 0.96,
      y: shouldReduceMotion ? 0 : 12,
      transition: shouldReduceMotion
        ? instantTransition
        : {
            duration: 0.18,
            ease: "easeIn",
          },
    },
  };

  // Fade-in list items
  const itemFadeVariants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 8,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: shouldReduceMotion
        ? instantTransition
        : {
            duration: 0.22,
            ease: "easeOut",
          },
    },
  };

  return {
    shouldReduceMotion: Boolean(shouldReduceMotion),
    instantTransition,
    confirmationScale,
    drawerVariants,
    modalVariants,
    itemFadeVariants,
  };
}
