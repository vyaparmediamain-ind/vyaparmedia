"use client";

import React, { useState } from "react";
import { DisputeDetail, MediatorAnalysis } from "./DisputeHelpers";
import { formatDateTime } from "@/lib/utils-client";
import {
  Scale,
  Building2,
  User,
  ShieldCheck,
  Send,
  Paperclip,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui";

interface ThreePartyArbitrationFeedProps {
  readonly dispute: DisputeDetail;
  readonly analysis: MediatorAnalysis | null;
  readonly currentUserId?: string | undefined;
  readonly onAddStatement?: ((statement: string) => Promise<void>) | undefined;
}

interface FeedItem {
  id: string;
  senderRole: "BRAND" | "CREATOR" | "ARBITER" | "SYSTEM";
  senderName: string;
  timestamp: string;
  type: "MESSAGE" | "EVIDENCE" | "ARBITER_VERDICT" | "SYSTEM_EVENT";
  content: string;
  evidenceUrl?: string | undefined;
  evidenceType?: string | undefined;
  verdictData?:
    | {
        brandRefund: number;
        creatorPayout: number;
      }
    | undefined;
}

export function ThreePartyArbitrationFeed({
  dispute,
  analysis,
  currentUserId: _currentUserId,
  onAddStatement,
}: Readonly<ThreePartyArbitrationFeedProps>) {
  const [statementText, setStatementText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [localMessages, setLocalMessages] = useState<FeedItem[]>([]);

  const brandName =
    (dispute.deal as { brand?: { companyName?: string; name?: string } }).brand?.companyName ||
    (dispute.deal as { brand?: { companyName?: string; name?: string } }).brand?.name ||
    "Brand Sponsor";

  const influencerName =
    (dispute.deal as { influencer?: { displayName?: string; name?: string } }).influencer?.displayName ||
    (dispute.deal as { influencer?: { displayName?: string; name?: string } }).influencer?.name ||
    "Creator Partner";

  // Build Unified 3-Party Chronological Feed
  const feedItems: FeedItem[] = React.useMemo(() => {
    const items: FeedItem[] = [];

    // 1. Initial Dispute Filing
    items.push({
      id: "event_dispute_filed",
      senderRole: "SYSTEM",
      senderName: "VyaparMedia Escrow Protocol",
      timestamp: dispute.createdAt,
      type: "SYSTEM_EVENT",
      content: `Dispute #${dispute.id.slice(-6).toUpperCase()} registered under protected escrow. Milestone payouts paused. Tier 1 auto-arbitration initiated.`,
    });

    // 2. Initial Statement by Filer
    const isRaisedByBrand = dispute.raisedByUserId !== (dispute.deal as { influencer?: { userId?: string } }).influencer?.userId;
    items.push({
      id: "statement_initial",
      senderRole: isRaisedByBrand ? "BRAND" : "CREATOR",
      senderName: isRaisedByBrand ? brandName : influencerName,
      timestamp: dispute.createdAt,
      type: "MESSAGE",
      content: dispute.description,
    });

    // 3. Evidence Items from both parties
    (dispute.evidence || []).forEach((ev) => {
      const isEvFromBrand = ev.submittedByUserId !== (dispute.deal as { influencer?: { userId?: string } }).influencer?.userId;
      items.push({
        id: `ev_${ev.id}`,
        senderRole: isEvFromBrand ? "BRAND" : "CREATOR",
        senderName: isEvFromBrand ? brandName : influencerName,
        timestamp: ev.submittedAt || dispute.createdAt,
        type: "EVIDENCE",
        content: ev.description || `Submitted supporting documentation (${ev.type})`,
        evidenceUrl: ev.url,
        evidenceType: ev.type,
      });
    });

    // 4. AI Mediator / Arbiter Proposal Event
    if (analysis && analysis.explanation) {
      items.push({
        id: "arbiter_proposal",
        senderRole: "ARBITER",
        senderName: `AI Mediator (Tier ${analysis.tier})`,
        timestamp: dispute.createdAt,
        type: "ARBITER_VERDICT",
        content: analysis.explanation,
        verdictData: {
          brandRefund: analysis.refundPercentage,
          creatorPayout: analysis.influencerPayoutPercentage,
        },
      });
    }

    // 5. Resolution Event (if resolved)
    if (dispute.resolution && dispute.resolvedAt) {
      items.push({
        id: "event_resolved",
        senderRole: "ARBITER",
        senderName: "VyaparMedia Neutral Arbiter",
        timestamp: dispute.resolvedAt,
        type: "SYSTEM_EVENT",
        content: `Case officially resolved & closed. Settlement terms: ${dispute.resolution}`,
      });
    }

    // Combine with any local statements
    return [...items, ...localMessages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [dispute, analysis, brandName, influencerName, localMessages]);

  const handleSendStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statementText.trim() || isSending) return;

    setIsSending(true);
    try {
      if (onAddStatement) {
        await onAddStatement(statementText.trim());
      }
      // Add local message for instant visual feedback
      const newMsg: FeedItem = {
        id: `local_${Date.now()}`,
        senderRole: "CREATOR",
        senderName: "You",
        timestamp: new Date().toISOString(),
        type: "MESSAGE",
        content: statementText.trim(),
      };
      setLocalMessages((prev) => [...prev, newMsg]);
      setStatementText("");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      {/* 3-Party Room Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              3-Party Arbitration Room & Evidence Feed
            </h2>
            <p className="text-xs text-muted-foreground">
              Direct statements between Brand, Creator, and Platform Neutral Arbiter
            </p>
          </div>
        </div>

        {/* 3 Participant Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Building2 className="w-3 h-3" />
            Brand
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-verified-muted text-verified border border-verified-border">
            <User className="w-3 h-3" />
            Creator
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Scale className="w-3 h-3" />
            Neutral Arbiter
          </span>
        </div>
      </div>

      {/* Chronological Chat & Decision Feed */}
      <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
        {feedItems.map((item) => {
          if (item.type === "SYSTEM_EVENT") {
            return (
              <div
                key={item.id}
                className="flex items-center justify-center my-2"
              >
                <div className="px-3.5 py-1.5 rounded-xl bg-muted/60 border border-border text-[11px] text-muted-foreground text-center max-w-md">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary inline mr-1.5 -mt-0.5" />
                  {item.content}
                </div>
              </div>
            );
          }

          if (item.senderRole === "ARBITER") {
            return (
              <div
                key={item.id}
                className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-2.5 my-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <Scale className="w-4 h-4" />
                    {item.senderName} (Official Assessment)
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDateTime(item.timestamp)}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                  {item.content}
                </p>

                {item.verdictData && (
                  <div className="flex gap-3 pt-1">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-background border border-border">
                      Refund Brand: {item.verdictData.brandRefund}%
                    </span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-background border border-border">
                      Pay Creator: {item.verdictData.creatorPayout}%
                    </span>
                  </div>
                )}
              </div>
            );
          }

          const isBrand = item.senderRole === "BRAND";

          return (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border space-y-1.5 ${
                isBrand
                  ? "bg-blue-500/5 border-blue-500/20 ml-0 mr-4"
                  : "bg-background/80 border-border mr-0 ml-4"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  {isBrand ? (
                    <Building2 className="w-3.5 h-3.5 text-blue-500" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-verified" />
                  )}
                  {item.senderName}
                  <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                    {item.senderRole}
                  </span>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {formatDateTime(item.timestamp)}
                </span>
              </div>

              {item.type === "EVIDENCE" ? (
                <div className="bg-card border border-border/80 rounded-lg p-2.5 space-y-1 mt-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Paperclip className="w-3.5 h-3.5" />
                    Evidence File: {item.evidenceType}
                  </div>
                  <p className="text-xs text-muted-foreground">{item.content}</p>
                  {item.evidenceUrl && (
                    <a
                      href={item.evidenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline pt-0.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Inspect Supporting File
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                  {item.content}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Statement Input Form */}
      {dispute.status !== "RESOLVED" && dispute.status !== "CLOSED" && (
        <form
          onSubmit={handleSendStatement}
          className="pt-2 border-t border-border/60 flex gap-2 items-end"
        >
          <div className="flex-1">
            <input
              type="text"
              placeholder="Submit formal statement or counter-proposal to mediation room..."
              value={statementText}
              onChange={(e) => setStatementText(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!statementText.trim() || isSending}
            className="flex items-center gap-1 px-4 py-2 text-xs rounded-xl"
          >
            <Send className="w-3.5 h-3.5" />
            Send
          </Button>
        </form>
      )}
    </div>
  );
}
