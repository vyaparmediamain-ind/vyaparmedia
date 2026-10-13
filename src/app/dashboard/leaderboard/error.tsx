"use client";

import { logger } from "@/lib/logger-client";
import { useEffect } from "react";
import { Button } from "@/components/ui";

export default function LeaderboardError({
error,
reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
useEffect(() => {
logger.error("Leaderboard page error:", error);
}, [error]);

return (
<div
role="alert"
aria-live="assertive"
className="flex flex-col items-center justify-center gap-5 text-primary flex-1 min-h-60vh"
>
<svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-rose mb-2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
<h2 className="text-xl font-extrabold">Leaderboard failed to load</h2>
<p className="text-secondary text-sm text-center max-w-380">
The leaderboard data could not be fetched. Please try again.
</p>
{error.digest && (
<code className="text-xs text-muted font-mono">Ref: {error.digest}</code>
)}
<Button variant="primary" aria-label="Retry loading leaderboard" onClick={() => reset()}>
Try again
</Button>
</div>
);
}
