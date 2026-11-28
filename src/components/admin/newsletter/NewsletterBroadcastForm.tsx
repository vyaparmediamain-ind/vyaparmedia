"use client";

import React, { useState } from "react";
import { Button, Input, Textarea } from "@/components/ui";
import {
  Send,
  AlertTriangle,
  FileCode,
  Eye,
  Edit3,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { formatUserError } from "@/lib/user-messages";
import { sanitizeHtml } from "@/lib/sanitize";

interface NewsletterBroadcastFormProps {
  readonly verifiedSubscribersCount: number;
}

export default function NewsletterBroadcastForm({
  verifiedSubscribersCount,
}: Readonly<NewsletterBroadcastFormProps>) {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || subject.trim().length < 3) {
      setErrorMessage("Please enter a subject line (minimum 3 characters).");
      return;
    }
    if (!content.trim() || content.trim().length < 10) {
      setErrorMessage("Please enter newsletter content (minimum 10 characters).");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to broadcast this newsletter to ${verifiedSubscribersCount} verified subscribers? This action cannot be undone.`
      )
    ) {
      return;
    }

    setIsSending(true);
    setErrorMessage(null);
    setStatusMessage("Initializing broadcast...");
    setIsCompleted(false);
    setSentCount(0);
    setTotalBatches(0);

    let currentOffset = 0;
    let totalSent = 0;
    let batches = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        batches++;
        setTotalBatches(batches);
        setStatusMessage(
          `Dispatching batch #${batches} (Sent: ${totalSent} / ~${verifiedSubscribersCount})...`
        );

        const res = await fetch("/api/admin/newsletter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: subject.trim(),
            content: content.trim(),
            offset: currentOffset,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || "Failed to dispatch batch");
        }

        const batchSent = data.sentCount || 0;
        totalSent += batchSent;
        currentOffset += batchSent;
        setSentCount(totalSent);
        hasMore = Boolean(data.hasMore && batchSent > 0);

        // Small pacing delay between batches to respect email provider rate limits
        if (hasMore) {
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      }

      setIsCompleted(true);
      setStatusMessage(
        `Broadcast complete! Delivered newsletter to ${totalSent} subscribers across ${batches} batch(es).`
      );
      setSubject("");
      setContent("");
    } catch (err: unknown) {
      setErrorMessage(
        formatUserError(
          err,
          "Failed to broadcast newsletter. Some subscribers may not have received it."
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border space-y-6">
      {/* Status or Success Alert */}
      {isCompleted && (
        <div className="p-4 rounded-xl bg-verified-muted border border-verified-border text-verified flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold block mb-0.5">Broadcast Successful</span>
            {statusMessage}
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold block mb-0.5">Broadcast Error</span>
            {errorMessage}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Input
            type="text"
            id="subject"
            name="subject"
            label="Subject Line"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={isSending}
            placeholder="e.g., New Guide: TDS & GST Compliance for Creators"
            fullWidth
          />
        </div>

        {/* View switcher: Edit vs HTML Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="content"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Newsletter Body (HTML supported)
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsPreview(false)}
                className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  !isPreview
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit HTML
              </button>
              <button
                type="button"
                onClick={() => setIsPreview(true)}
                className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  isPreview
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
            </div>
          </div>

          {isPreview ? (
            <div className="p-5 rounded-xl border border-border bg-muted/20 min-h-[250px] max-h-[450px] overflow-y-auto prose dark:prose-invert max-w-none text-sm">
              {content ? (
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
              ) : (
                <p className="text-muted-foreground italic">No content to preview.</p>
              )}
            </div>
          ) : (
            <>
              <Textarea
                id="content"
                name="content"
                required
                rows={12}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={isSending}
                className="text-sm font-mono resize-y"
                placeholder="<h1>Hello Creators,</h1><p>Here is your weekly roundup of brand deals and legal escrow insights...</p>"
                fullWidth
              />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <FileCode className="w-3.5 h-3.5" />
                <span>
                  Standard HTML tags like &lt;p&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;a&gt;, &lt;ul&gt;, and &lt;li&gt; are supported.
                </span>
              </div>
            </>
          )}
        </div>

        {/* Live Batch Dispatch Progress */}
        {isSending && (
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-primary">
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                {statusMessage}
              </span>
              <span className="font-mono">
                {sentCount} / {verifiedSubscribersCount}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-primary/20 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((sentCount / (verifiedSubscribersCount || 1)) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Broadcast Confirmation / Warning Alert */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-foreground">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-bold text-amber-600 dark:text-amber-400 block mb-0.5">
              Production Broadcast Notice
            </span>
            This action will dispatch transactional emails immediately to all{" "}
            <strong>{verifiedSubscribersCount}</strong> verified subscribers via Resend/SMTP. Please proofread thoroughly before broadcasting.
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full justify-center gap-2 font-black shadow-md cursor-pointer disabled:opacity-50"
          disabled={verifiedSubscribersCount === 0 || isSending}
        >
          {isSending ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Broadcasting Batch #{totalBatches}...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Broadcast Newsletter to {verifiedSubscribersCount} Subscribers</span>
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
