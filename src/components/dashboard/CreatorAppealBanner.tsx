"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Button, Input, Badge } from "@/components/ui";
import { formatUserError } from "@/lib/user-messages";
import { AlertTriangle, ShieldAlert, FileText, CheckCircle2, Clock } from "lucide-react";

interface AppealStatusResponse {
  success: boolean;
  data: {
    status: string;
    isFlagged: boolean;
    appealSubmitted: boolean;
    appealStatus?: "PENDING" | "APPROVED" | "CONFIRMED";
    reason?: string;
    evidenceUrl?: string;
  };
}

export default function CreatorAppealBanner({
  userType,
}: {
  userType?: string | null | undefined;
}) {
  const isInfluencer = userType === "INFLUENCER";

  const { data, mutate } = useSWR<AppealStatusResponse>(
    isInfluencer ? "/api/influencers/appeal" : null,
    fetcher
  );

  const [showModal, setShowModal] = useState(false);
  const [statement, setStatement] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  if (!isInfluencer) return null;

  const appealData = data?.data;
  if (!appealData || !appealData.isFlagged) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (statement.trim().length < 15) {
      setFeedback({
        type: "error",
        msg: "Please provide a detailed explanation of at least 15 characters.",
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/influencers/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: statement.trim(),
          evidenceUrl: evidenceUrl.trim() || undefined,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || "Failed to submit appeal");
      }

      setFeedback({
        type: "success",
        msg: "Your appeal has been submitted successfully. Our Trust & Safety team will review your evidence shortly.",
      });
      mutate();
    } catch (err) {
      setFeedback({
        type: "error",
        msg: formatUserError(err, "Failed to submit appeal. Please try again."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="p-4 rounded-2xl bg-danger/10 border border-danger/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-xl bg-danger/20 text-danger shrink-0 mt-0.5 sm:mt-0">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="font-bold text-foreground text-sm flex items-center gap-2">
              Account Under Verification Review (Flagged)
              <Badge variant="danger" className="text-[10px]">Action Required</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automated social risk detection flagged abnormal growth signals. If this was caused by a genuine viral post or content format transition, you can submit an appeal with proof.
            </p>
          </div>
        </div>

        <div className="shrink-0 w-full sm:w-auto">
          {appealData.appealSubmitted ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-warning bg-warning/10 px-3 py-2 rounded-xl border border-warning/30">
              <Clock className="w-4 h-4 animate-spin" />
              <span>Appeal Submitted &bull; Pending Review</span>
            </div>
          ) : (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowModal(true)}
              className="w-full sm:w-auto text-xs font-bold cursor-pointer"
            >
              Submit Creator Appeal
            </Button>
          )}
        </div>
      </div>

      {/* Appeal Form Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Submit Authenticity Appeal</h3>
                  <p className="text-xs text-muted-foreground">
                    Provide context and evidence for our Trust &amp; Safety team.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setFeedback(null);
                }}
                className="text-muted-foreground hover:text-foreground text-sm font-bold p-1 rounded-lg hover:bg-muted"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-xl text-xs ${
                  feedback.type === "success"
                    ? "bg-verified/10 text-verified border border-verified-border"
                    : "bg-danger/10 text-danger border border-danger/30"
                }`}
              >
                {feedback.msg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label htmlFor="appeal-statement" className="text-xs font-semibold text-foreground block mb-1">
                  Explanation / Statement (Minimum 15 characters)
                </label>
                <textarea
                  id="appeal-statement"
                  rows={4}
                  required
                  placeholder="Explain the reason for recent engagement or follower changes (e.g. 'I posted a viral Reel about tech gadgets on October 24 which gained 1.2M organic views...')"
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl bg-muted/30 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="appeal-evidence-url" className="text-xs font-semibold text-foreground block mb-1">
                  Evidence URL / Proof Link (Optional but strongly recommended)
                </label>
                <Input
                  id="appeal-evidence-url"
                  placeholder="https://www.instagram.com/reel/... or Google Drive link"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  className="text-xs"
                />
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Link to your viral post, analytics screenshot, or collaborating brand verification.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting} className="font-bold">
                  {isSubmitting ? "Submitting..." : "Submit for Human Review"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
