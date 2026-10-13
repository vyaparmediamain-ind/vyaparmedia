/**
 * UI Timing, Animation & Toast Duration Constants (in Milliseconds)
 */

// Toast Auto-Dismiss Durations
export const DEFAULT_TOAST_DURATION_MS = 5000; // 5 seconds for standard toasts, error notices, alerts
export const SHORT_TOAST_DURATION_MS = 3000; // 3 seconds for quick micro-notifications
export const COPIED_FEEDBACK_DURATION_MS = 2000; // 2 seconds for "Copied to clipboard" pills
export const BANNER_NOTICE_DURATION_MS = 4000; // 4 seconds for transient page banners

// Navigation & Transition Delays
export const NAVIGATION_REDIRECT_DELAY_MS = 2000; // 2 seconds delay before redirecting after action
export const SIGN_OUT_REDIRECT_DELAY_MS = 1500; // 1.5 seconds delay before routing after logout

// Debounce & Polling Intervals
export const SEARCH_INPUT_DEBOUNCE_MS = 400; // 400ms for search input debouncing
export const TYPING_INDICATOR_TIMEOUT_MS = 2500; // 2.5 seconds before typing indicator turns off
export const REALTIME_POLL_FALLBACK_INTERVAL_MS = 15_000; // 15 seconds fallback polling if websockets drop
export const CHART_MOUNT_DELAY_MS = 50; // 50ms for chart responsive resize readiness
