"use client";

/**
* useInactivityLogout Hook Enterprise Session Security
*
* Automatically signs the user out after a period of inactivity.
* Shows a warning modal at 5 minutes before timeout.
*
* Tracks: mouse moves, clicks, keyboard presses, scroll, touch
* Default timeout: 30 minutes (financial platform standard)
*/

import { useEffect, useRef, useCallback, useState } from "react";
import { signOut } from "next-auth/react";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 5 * 60 * 1000; // Show warning 5 min before logout

interface InactivityState {
/** True when the warning modal should be shown */
showWarning: boolean;
/** Seconds remaining until forced logout */
secondsRemaining: number;
/** Call this to reset the inactivity timer (user acknowledged warning) */
extendSession: () => void;
}

/**
* Hook that monitors user inactivity and auto-logs out after timeout.
* Only active when `enabled` is true (i.e., user is authenticated).
*/
export function useInactivityLogout(enabled: boolean): InactivityState {
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

const [showWarning, setShowWarning] = useState(false);
const [secondsRemaining, setSecondsRemaining] = useState(300); // 5 min

const clearAllTimers = useCallback(() => {
if (timerRef.current) clearTimeout(timerRef.current);
if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
if (countdownRef.current) clearInterval(countdownRef.current);
}, []);

const performLogout = useCallback(async () => {
clearAllTimers();
setShowWarning(false);
await signOut({ redirect: true, callbackUrl: "/login?reason=inactivity" });
}, [clearAllTimers]);

const startCountdown = useCallback(() => {
// Defer state updates so they don't fire synchronously inside the effect
queueMicrotask(() => {
setSecondsRemaining(Math.floor(WARNING_BEFORE_MS / 1000));
setShowWarning(true);
});

countdownRef.current = setInterval(() => {
setSecondsRemaining((prev) => {
if (prev <= 1) {
clearInterval(countdownRef.current!);
return 0;
}
return prev - 1;
});
}, 1000);
}, []);

const resetTimer = useCallback(() => {
if (!enabled) return;

clearAllTimers();
// Defer state resets to avoid synchronous setState-in-effect
queueMicrotask(() => {
setShowWarning(false);
setSecondsRemaining(Math.floor(WARNING_BEFORE_MS / 1000));
});

// Set warning timer (fires before logout)
warningTimerRef.current = setTimeout(() => {
startCountdown();
}, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);

// Set logout timer
timerRef.current = setTimeout(() => {
performLogout();
}, INACTIVITY_TIMEOUT_MS);
}, [enabled, clearAllTimers, startCountdown, performLogout]);

const extendSession = useCallback(() => {
resetTimer();
}, [resetTimer]);

useEffect(() => {
if (!enabled) return;

const ACTIVITY_EVENTS = [
"mousemove",
"mousedown",
"keydown",
"scroll",
"touchstart",
"click",
"focus",
] as const;

// Throttle: only reset timer if it's been > 1 second since last event
let lastReset = 0;
const handleActivity = () => {
const now = Date.now();
if (now - lastReset > 1000) {
lastReset = now;
resetTimer();
}
};

ACTIVITY_EVENTS.forEach((event) => {
window.addEventListener(event, handleActivity, { passive: true });
});

// Start the timer on mount
resetTimer();

return () => {
clearAllTimers();
ACTIVITY_EVENTS.forEach((event) => {
window.removeEventListener(event, handleActivity);
});
};
}, [enabled, resetTimer, clearAllTimers]);

return { showWarning, secondsRemaining, extendSession };
}
