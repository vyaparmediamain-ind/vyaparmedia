"use client";


import { logger } from "@/lib/logger-client";
/**
* ErrorBoundary Enterprise-Grade React Error Barrier
*
* Catches unhandled React rendering errors to prevent:
* - White screens exposing internal component trees
* - Stack traces leaking to users in production
* - Sensitive data visible in error messages
*
* In production: shows a generic error UI with a support reference ID.
* In development: shows full details for debugging.
*/

import React from "react";
import { Button } from "@/components/ui";

interface Props {
children: React.ReactNode;
/** Optional custom fallback UI */
fallback?: React.ReactNode;
/** Shown in the error UI for support correlation */
componentName?: string;
}

interface State {
hasError: boolean;
errorId: string | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
constructor(props: Props) {
super(props);
this.state = { hasError: false, errorId: null };
}

static getDerivedStateFromError(error: Error): State {
const errorId =
typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
? (crypto.randomUUID().split("-")[0] ?? "000000").toUpperCase()
// Fallback for environments without crypto.randomUUID use a timestamp-based ID.
: Date.now().toString(36).toUpperCase().slice(-6);

// Prevent white screens / error boundaries for common extension errors
if (
error?.message?.includes('Failed to fetch') ||
error?.stack?.includes('chrome-extension') ||
error?.stack?.includes('frame_ant')
) {
return { hasError: false, errorId: null };
}

return { hasError: true, errorId };
}

override componentDidCatch(error: Error, info: React.ErrorInfo) {
if (
error?.message?.includes('Failed to fetch') ||
error?.stack?.includes('chrome-extension') ||
error?.stack?.includes('frame_ant')
) {
// Silently swallow extension-induced rendering errors
return;
}
// In production: never log sensitive info to console
if (process.env.NODE_ENV === "development") {
logger.error(
`[ErrorBoundary] Error in ${this.props.componentName || "Unknown"}: ${error instanceof Error ? error.message : String(error)}`,
error instanceof Error ? error : undefined,
{ componentStack: info?.componentStack }
);
} else {
// Production: minimal, non-sensitive log
logger.error(
`[ErrorBoundary] Error in ${this.props.componentName || "Component"} [ID: ${this.state.errorId}]`,
);
}
}

handleRetry = () => {
this.setState({ hasError: false, errorId: null });
};

override render() {
if (this.state.hasError) {
if (this.props.fallback) {
return this.props.fallback;
}

return (
<div
role="alert"
aria-live="assertive"
className="text-center flex flex-col items-center justify-center gap-4 rounded-lg error-boundary-card"
>
<div className="text-3xl text-rose flex items-center justify-center">
  <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-rose opacity-80">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
</div>
<h3
className="text-lg font-bold m-0 text-text-primary"
>
Something went wrong
</h3>
<p
className="text-sm leading-relaxed m-0 text-secondary max-w-360"
>
An unexpected error occurred in this section.
{this.state.errorId && (
<>
{" "}
Please reference ID{" "}
<code
className="text-xs rounded-sm px-2 py-0.5 font-mono bg-glass-light"
>
ERR-{this.state.errorId}
</code>{" "}
if you contact support.
</>
)}
</p>
<div className="flex gap-3">
<Button
variant="secondary"
aria-label="Try rendering this component again"
onClick={this.handleRetry}
>
Try Again
</Button>
<Button
variant="primary"
aria-label="Reload the entire page"
onClick={() => window.location.reload()}
>
Reload Page
</Button>
</div>
</div>
);
}

return this.props.children;
}
}
