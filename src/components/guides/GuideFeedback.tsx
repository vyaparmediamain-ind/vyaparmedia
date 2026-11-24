"use client";

import React, { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown, Check } from "lucide-react";
import { useGuideDrawer } from "./GuideDrawerContext";

interface GuideFeedbackProps {
  readonly guideId: string;
  readonly className?: string;
}

export function GuideFeedback({ guideId, className = "" }: Readonly<GuideFeedbackProps>) {
  const { activeLanguage } = useGuideDrawer();
  const [feedback, setFeedback] = useState<"helpful" | "not_helpful" | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`vm_guide_feedback_${guideId}`);
      if (stored === "helpful" || stored === "not_helpful") {
        setFeedback(stored);
      } else {
        setFeedback(null);
      }
    } catch {
      // localStorage not available
    }
  }, [guideId]);

  const handleVote = async (choice: "helpful" | "not_helpful") => {
    setFeedback(choice);
    try {
      localStorage.setItem(`vm_guide_feedback_${guideId}`, choice);
    } catch {
      // localStorage error
    }

    // Attempt anonymous feedback API call if user allowed telemetry
    try {
      const consent = localStorage.getItem("cookie_consent_analytics");
      if (consent === "true") {
        await fetch("/api/guides/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guideId,
            choice,
          }),
        }).catch(() => {});
      }
    } catch {
      // fail silently per privacy policy
    }
  };

  const isHinglish = activeLanguage === "hinglish";

  return (
    <div
      aria-label="Guide feedback"
      className={`border-t border-border/80 pt-4 mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground ${className}`}
    >
      <span className="font-medium text-foreground">
        {isHinglish ? "Kya yeh guide helpful tha?" : "Was this guide helpful?"}
      </span>

      {feedback ? (
        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
          <Check className="w-3.5 h-3.5" />
          <span>{isHinglish ? "Shukriya feedback ke liye!" : "Thank you for your feedback!"}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleVote("helpful")}
            aria-label={isHinglish ? "Haan, helpful tha" : "Yes, it was helpful"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-muted/80 text-foreground transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>{isHinglish ? "Haan" : "Yes"}</span>
          </button>
          <button
            type="button"
            onClick={() => handleVote("not_helpful")}
            aria-label={isHinglish ? "Nahi, aur jankari chahiye" : "No, need more details"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-muted/80 text-foreground transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
            <span>{isHinglish ? "Nahi" : "No"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
