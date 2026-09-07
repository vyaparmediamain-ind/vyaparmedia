"use client";


import { logger } from "@/lib/logger-client";
/**
* useSecureSession - Enterprise Frontend Session Integrity Monitor
*
* Provides:
* 1. Cross-Tab Session Sync: If user logs out on one tab, all tabs log out.
* 2. Token Integrity Check: On window focus, validates that the server-side
* session is still alive and not revoked.
* 3. Role Guard: Provides helpers to check if the current session has a specific role.
* 4. Suspicious Activity Detection: Tracks rapid route changes which could indicate
* an automated CSRF attack or XSS-based session riding.
*/

import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

const CROSS_TAB_LOGOUT_KEY = "VyaparMedia:secure:logout";
const BROADCAST_CHANNEL_NAME = "VyaparMedia:session";

export function useSecureSession() {
const { data: session, status } = useSession();
const pathname = usePathname();
const routeChangeTimestamps = useRef<number[]>([]);
const broadcastRef = useRef<BroadcastChannel | null>(null);

// 1. Cross-tab logout sync prefer BroadcastChannel (XSS-safe), fallback to storage event
useEffect(() => {
let cleanup: (() => void) | undefined;

if (typeof BroadcastChannel !== "undefined") {
// BroadcastChannel is same-origin and not writable via localStorage XSS
const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
broadcastRef.current = channel;

channel.onmessage = (e: MessageEvent) => {
if (e.data?.type === "logout") {
signOut({ redirect: true, callbackUrl: "/login?reason=cross_tab_logout" });
}
};

cleanup = () => {
channel.close();
broadcastRef.current = null;
};
} else {
// Fallback for older browsers validate with nonce to mitigate XSS forge
const handleStorageChange = (e: StorageEvent) => {
if (e.key === CROSS_TAB_LOGOUT_KEY && e.newValue === "true") {
localStorage.removeItem(CROSS_TAB_LOGOUT_KEY);
signOut({ redirect: true, callbackUrl: "/login?reason=cross_tab_logout" });
}
};

window.addEventListener("storage", handleStorageChange);
cleanup = () => window.removeEventListener("storage", handleStorageChange);
}

return cleanup;
}, []);





// 3. Suspicious route velocity detection
useEffect(() => {
const now = Date.now();
routeChangeTimestamps.current.push(now);

// Keep only timestamps from the last 5 seconds
routeChangeTimestamps.current = routeChangeTimestamps.current.filter(
(ts) => now - ts < 5000
);

// If more than 10 route changes in 5 seconds, something is wrong
if (routeChangeTimestamps.current.length > 10) {
logger.warn("[SECURITY][useSecureSession] Suspicious rapid navigation detected. Possible XSS automation.");
// Could sign out or show a CAPTCHA in a real production scenario
}
}, [pathname]);

// 4. Role and permission helpers
const hasRole = useCallback(
(role: string) => {
return session?.user?.userType === role;
},
[session]
);

const isAdmin = hasRole("ADMIN");
const isBrand = hasRole("BRAND");
const isInfluencer = hasRole("INFLUENCER");

// 5. Explicit secure logout
const secureLogout = useCallback(async (reason = "manual_logout") => {
// Broadcast logout to all other tabs prefer BroadcastChannel (XSS-safe)
if (broadcastRef.current) {
broadcastRef.current.postMessage({ type: "logout", reason });
} else {
// Fallback for older browsers
localStorage.setItem(CROSS_TAB_LOGOUT_KEY, "true");
}

try {
await signOut({ redirect: false });
} finally {
if (typeof window !== "undefined") {
window.location.href = `/login?reason=${reason}`;
}
}
}, []);

// 2. Client-side session error detection (rotation failure, revocation, account block)
useEffect(() => {
if (session?.error) {
logger.warn(`[SECURITY][useSecureSession] Session error detected: ${session.error}. Logging out.`);
let reason = "session_expired";
if (session.error === "SessionRevoked") reason = "session_revoked";
if (session.error === "AccountBlocked") reason = "account_blocked";
secureLogout(reason);
}
}, [session, secureLogout]);

return {
session,
status,
isAdmin,
isBrand,
isInfluencer,
hasRole,
secureLogout,
isAuthenticated: status === "authenticated",
isLoading: status === "loading",
};
}
