"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { logger } from "@/lib/logger-client";

/**
* Enterprise Features: Visual Security Watermark & DOM Tamper Detection
* - Renders a faint, repeating watermark (User ID/Email/IP/Time) over the UI.
* - This acts as a deterrent against unauthorized screenshotting of sensitive data
* like brand wallets, pending deals, or influencer PII.
* - Tamper Detection observes if the watermark node is deleted or display:none is applied via DevTools.
*/
function checkRemovedNodes(removedNodes: NodeList, watermarkId: string) {
for (const node of Array.from(removedNodes)) {
if ((node as HTMLElement).id === watermarkId) {
logger.warn("[SECURITY] Tampering detected: Watermark removed.");
}
}
}

function checkStyleChanges(mutation: MutationRecord, watermarkId: string) {
if (mutation.type === "attributes" && mutation.attributeName === "style") {
const el = mutation.target as HTMLElement;
if (el.id === watermarkId) {
if (el.style.opacity === "0" || el.style.display === "none" || el.style.visibility === "hidden") {
logger.warn("[SECURITY] Tampering detected: Watermark hidden.");
}
}
}
}

export function EnterpriseWatermark() {
const { data: session } = useSession();
const pathname = usePathname();
const [mounted, setMounted] = useState(false);

useEffect(() => {
setTimeout(() => setMounted(true), 0);
}, []);

// Only show on protected routes where data leaks matter most
const isSensitiveRoute =
pathname?.startsWith("/dashboard/wallet") ||
pathname?.startsWith("/dashboard/deals") ||
pathname?.startsWith("/admin");

useEffect(() => {
if (!mounted || !isSensitiveRoute || !session?.user) return;

// --- Enterprise DOM Tamper Detection ---
const watermarkId = "enterprise-security-watermark";

let isUpdating = false;
// MutationObserver detects if someone tries to delete the watermark from DOM
const observer = new MutationObserver((mutations) => {
if (isUpdating) return;
isUpdating = true;
try {
for (const mutation of mutations) {
checkRemovedNodes(mutation.removedNodes, watermarkId);
checkStyleChanges(mutation, watermarkId);
}
} finally {
isUpdating = false;
}
});

observer.observe(document.body, {
childList: true,
subtree: true,
attributes: true,
attributeFilter: ["style"]
});

return () => observer.disconnect();
}, [mounted, isSensitiveRoute, session]);

if (!mounted || !isSensitiveRoute || !session?.user) return null;

const userEmail = session.user.email ?? "unknown";

return (
<div
id="enterprise-security-watermark"
className="fixed flex flex-wrap items-center justify-center pointer-events-none enterprise-watermark-container"
>
{/* Generate a grid of repeating watermarks identifying the internal user */}
{Array.from({ length: 30 }).map((_, i) => (
<div
key={`watermark-${userEmail}-${i}`}
className="text-sm text-center p-10 font-mono whitespace-pre-line enterprise-watermark-item"
>
{session.user.email} <br />
{session.user.id.slice(-8)} <br />
{new Date().toISOString().split("T")[0]}
</div>
))}
</div>
);
}
