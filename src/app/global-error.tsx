"use client";

import { logger } from "@/lib/logger-client";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
error,
reset,
}: Readonly<{
error: Error & { digest?: string };
reset: () => void;
}>) {
useEffect(() => {
// Log the error to an error reporting service
logger.error(error);
}, [error]);

return (
<html lang="en">
<head>
<title>System Error - VyaparMedia</title>
</head>
<body
className="flex items-center justify-center p-6 bg-primary text-primary min-h-screen font-inter"
>
{/* Abstract Background Elements */}
<div className="fixed z-0 system-error-bg-glow" />

<div className="glass col-span-2 text-center w-full relative rounded-xl z-1 system-error-card border-rose-subtle">
      <div
        className="flex items-center justify-center mb-8 bg-rose-subtle text-rose rounded-full text-3xl mx-auto w-80 system-error-icon border-rose-subtle"
      >
        <svg
          width={36}
          height={36}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>

<h1 className="gradient-text text-xl font-extrabold mb-4 bg-gradient-rose-orange">
System Malfunction
</h1>

<p className="text-secondary text-sm mb-8">
We've encountered a critical exception in the core engine.
Our engineering team has been automatically alerted.
</p>

{error.digest && (
<div className="text-xs text-muted mb-8 p-3 rounded-md border-card font-mono bg-glass-light">
Digest: {error.digest}
</div>
)}

<div className="flex gap-3">
<Button
onClick={() => reset()}
variant="danger"
aria-label="Restart Session"
className="flex-1 btn-restart-shadow"
>
Restart Session
</Button>
<Button
href="/"
variant="secondary"
className="flex-1"
>
Return Home
</Button>
</div>
</div>
</body>
</html>
);
}
