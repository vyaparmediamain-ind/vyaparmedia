"use client";

import { logger } from "@/lib/logger-client";
import { useEffect } from "react";
import { Button } from "@/components/ui";
import { AlertCircle } from "lucide-react";

export default function AdminCampaignError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    logger.error("Admin campaign operations audit error:", error);
  }, [error]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-center p-8 bg-card border border-border rounded-2xl max-w-lg mx-auto my-12 shadow-sm"
    >
      <div className="w-12 h-12 rounded-2xl bg-danger/10 border border-danger-border flex items-center justify-center text-danger">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h2 className="text-xl font-bold text-foreground">Campaign Audit Failed to Load</h2>
      <p className="text-muted-foreground text-sm max-w-md">
        Unable to load platform audit metrics for this campaign. Check your administrative credentials and network connectivity.
      </p>
      {error.digest && (
        <code className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
          Ref: {error.digest}
        </code>
      )}
      <Button
        variant="primary"
        aria-label="Retry loading admin campaign audit"
        onClick={() => reset()}
        className="mt-2 font-bold"
      >
        Try again
      </Button>
    </div>
  );
}
