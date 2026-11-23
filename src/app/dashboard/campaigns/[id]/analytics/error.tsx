"use client";

import React, { useEffect } from "react";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { logger } from "@/lib/logger-client";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CampaignAnalyticsError({ error, reset }: ErrorProps) {
  useEffect(() => {
    logger.error("Campaign analytics page render error", {
      error: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-destructive/20 bg-card p-6 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-foreground">
            Unable to load campaign analytics
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            We encountered a temporary issue aggregating campaign performance telemetry. Please try refreshing.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => reset()}
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </Button>
          <Link href="/dashboard/campaigns">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Campaigns</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
