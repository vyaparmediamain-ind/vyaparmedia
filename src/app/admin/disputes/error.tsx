"use client";

import { logger } from "@/lib/logger-client";
import { useEffect } from "react";
import { Button } from "@/components/ui";
import { Scale } from "lucide-react";

export default function AdminDisputesError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    logger.error("Admin disputes error:", error);
  }, [error]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-center p-8 bg-card border border-border rounded-2xl max-w-lg mx-auto my-12 shadow-sm"
    >
      <div className="w-12 h-12 rounded-2xl bg-disputed/10 border border-disputed-border flex items-center justify-center text-disputed">
        <Scale className="w-6 h-6" />
      </div>
      <h2 className="text-xl font-bold text-foreground">Dispute queue failed to load</h2>
      <p className="text-muted-foreground text-sm max-w-md">
        The dispute resolution queue could not be fetched. Check database connectivity and try again.
      </p>
      {error.digest && (
        <code className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">Ref: {error.digest}</code>
      )}
      <Button
        variant="primary"
        aria-label="Retry loading admin disputes"
        onClick={() => reset()}
        className="mt-2 font-bold"
      >
        Try again
      </Button>
    </div>
  );
}
