/**
 * Centralized Haptic Feedback Utility (Web Vibration API)
 *
 * Provides subtle, tactile feedback for key PWA mobile interactions
 * (e.g., Pull-to-Refresh trigger, Deal Action approval, Wallet withdrawal, Swipe-to-dismiss).
 *
 * Silently no-ops on desktop, iOS Safari, or non-supporting environments without error.
 */

function canVibrate(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function"
  );
}

function trigger(pattern: number | number[]): void {
  try {
    if (canVibrate()) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Silently ignore in permissions-policy restricted contexts, iframes, or desktop
  }
}

export const haptic = {
  /**
   * Ultra-short tick (8ms) — tab switches, micro selections.
   */
  selection: () => trigger(8),

  /**
   * Subtle short pulse (12ms) — swipe-to-dismiss, button taps, list actions.
   */
  light: () => trigger(12),

  /**
   * Distinct medium pulse (20ms) — pull-to-refresh trigger, item expansion.
   */
  medium: () => trigger(20),

  /**
   * Satisfying success confirmation pattern (12ms pulse, 35ms pause, 18ms pulse) —
   * Deal Approve/Reject confirm, Withdrawal submitted, Milestones verified.
   */
  success: () => trigger([12, 35, 18]),

  /**
   * Warning alert pattern (20ms pulse, 40ms pause, 20ms pulse).
   */
  warning: () => trigger([20, 40, 20]),

  /**
   * Error pattern (30ms pulse, 45ms pause, 30ms pulse).
   */
  error: () => trigger([30, 45, 30]),

  /**
   * Custom duration or pattern.
   */
  custom: (pattern: number | number[]) => trigger(pattern),
};

export default haptic;
