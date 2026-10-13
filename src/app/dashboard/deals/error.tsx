"use client";

import { logger } from "@/lib/logger-client";
import { useEffect } from "react";
import { Button } from "@/components/ui";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function DealsError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    logger.error("Deals page error:", error);
  }, [error]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col items-center justify-center gap-4 text-center max-w-md mx-auto p-8 rounded-2xl border border-disputed-border bg-card mt-12 shadow-sm"
    >
      <div className="w-12 h-12 rounded-2xl bg-disputed-muted flex items-center justify-center text-disputed">
        <AlertCircle className="w-6 h-6" />
      </div>
      <div>
        <h2 className="text-xl font-extrabold text-foreground">
          Collaborations Failed to Load
        </h2>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1">
          We could not load your active collaborations. Please refresh or try again in a moment.
        </p>
      </div>

      {error.digest && (
        <code className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
          Ref: {error.digest}
        </code>
      )}

      <Button
        variant="primary"
        size="sm"
        aria-label="Retry loading deals"
        onClick={() => reset()}
        className="font-bold text-xs gap-1.5 shadow-sm mt-2"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Try Again
      </Button>
    </div>
  );
}
