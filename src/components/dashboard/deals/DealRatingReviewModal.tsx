"use client";

import React, { useState } from "react";
import Image from "next/image";
import { BottomSheet, Button, Textarea, type ToastType } from "@/components/ui";
import { Star, ShieldCheck, CheckCircle2, MessageSquare, Award } from "lucide-react";
import { formatUserError } from "@/lib/user-messages";

interface DealRatingReviewModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly dealId: string;
  readonly partnerName: string;
  readonly partnerAvatar?: string | null | undefined;
  readonly partnerRole: "Brand" | "Creator";
  readonly existingReview?: {
    rating: number;
    comment?: string | null | undefined;
    createdAt?: string | Date | undefined;
  } | null | undefined;
  readonly onReviewSubmitted: () => void;
  readonly showToast: (type: ToastType, message: string) => void;
}

const RATING_LABELS: Record<number, string> = {
  1: "1 - Poor Collaboration",
  2: "2 - Below Expectations",
  3: "3 - Satisfactory",
  4: "4 - Very Good & Professional",
  5: "5 - Outstanding Experience!",
};

export function DealRatingReviewModal({
  isOpen,
  onClose,
  dealId,
  partnerName,
  partnerAvatar,
  partnerRole,
  existingReview,
  onReviewSubmitted,
  showToast,
}: Readonly<DealRatingReviewModalProps>) {
  const [rating, setRating] = useState<number>(existingReview?.rating ?? 5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState<string>(existingReview?.comment ?? "");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const activeRating = hoverRating ?? rating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      showToast("error", "Please select a star rating between 1 and 5.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to submit review");
      }

      showToast("success", `Review for ${partnerName} published successfully!`);
      onReviewSubmitted();
      onClose();
    } catch (err: unknown) {
      showToast("error", formatUserError(err, "Failed to submit review."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={existingReview ? "Your Feedback & Rating" : `Rate Collaboration with ${partnerName}`}
    >
      <div className="space-y-5 py-2">
        {/* Partner Header */}
        <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-muted/40 border border-border">
          <div className="relative w-12 h-12 rounded-full overflow-hidden bg-primary/10 border border-primary/20 shrink-0 flex items-center justify-center text-primary font-bold">
            {partnerAvatar ? (
              <Image src={partnerAvatar} alt={partnerName} fill className="object-cover" />
            ) : (
              partnerName.substring(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-bold text-foreground truncate">{partnerName}</h4>
              <ShieldCheck className="w-4 h-4 text-verified shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Verified {partnerRole} &bull; Completed Escrow Deal
            </p>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-verified-muted text-verified border border-verified-border shrink-0">
            <CheckCircle2 className="w-3 h-3" /> Settled
          </span>
        </div>

        {/* Existing Review Read-only View */}
        {existingReview ? (
          <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Submitted Rating
              </span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= existingReview.rating
                        ? "fill-amber-500 text-amber-500"
                        : "text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
            </div>

            {existingReview.comment ? (
              <p className="text-sm text-foreground/90 italic bg-muted/30 p-3 rounded-xl border border-border/50">
                &ldquo;{existingReview.comment}&rdquo;
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic">No written comment provided.</p>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 text-verified font-medium">
                <Award className="w-3.5 h-3.5" /> Published &amp; Impacting DRS Score
              </span>
              <Button variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          /* New Review Submission Form */
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Star Selector */}
            <div className="space-y-2 text-center p-4 rounded-2xl bg-card border border-border">
              <label htmlFor="review-comment" className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Overall Experience
              </label>
              <div className="flex items-center justify-center gap-2 py-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    className="p-1 cursor-pointer transition-transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={`Rate ${star} star`}
                  >
                    <Star
                      className={`w-7 h-7 transition-colors ${
                        star <= activeRating
                          ? "fill-amber-500 text-amber-500"
                          : "text-muted-foreground/30 hover:text-muted-foreground/60"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-xs font-semibold text-primary transition-all">
                {RATING_LABELS[activeRating] || "Select your rating"}
              </p>
            </div>

            {/* Written Comment */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="review-comment"
                  className="text-xs font-bold text-foreground flex items-center gap-1"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-primary" />
                  Public Feedback &amp; Collaboration Notes (Optional)
                </label>
                <span className="text-[11px] text-muted-foreground">
                  {comment.length}/500
                </span>
              </div>
              <Textarea
                id="review-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                placeholder={`Describe your experience working with ${partnerName}. How was the responsiveness, brief clarity, and deliverable quality?`}
                rows={4}
                className="text-sm resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                Note: Feedback is visible on public verified profiles and directly contributes to creator/brand DRS™ trust metrics. Contact info (phone, handles, links) is strictly filtered.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isSubmitting}
                className="gap-2 font-bold shadow-sm"
              >
                <Star className="w-4 h-4 fill-primary-foreground text-primary-foreground" />
                <span>{isSubmitting ? "Publishing..." : "Publish Verified Review"}</span>
              </Button>
            </div>
          </form>
        )}
      </div>
    </BottomSheet>
  );
}
