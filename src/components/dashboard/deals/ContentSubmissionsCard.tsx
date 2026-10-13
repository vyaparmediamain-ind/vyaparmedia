"use client";

import React, { useState } from "react";
import EmptyState from "@/components/ui/EmptyState";
import { Card } from "@/components/ui";
import { formatContractDate, ContentSubmission, ContentUrlEntry } from "./DealDetailHelpers";
import {
  History,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Video,
  FileText,
} from "lucide-react";

interface ContentSubmissionsCardProps {
  readonly submissions?: ContentSubmission[] | undefined;
}

function isImageUrl(url?: string, type?: string): boolean {
  if (!url) return false;
  if (type?.toLowerCase().includes("image") || type?.toLowerCase().includes("photo") || type?.toLowerCase().includes("post")) return true;
  return /\.(jpe?g|png|webp|gif|svg|avif)(\?.*)?$/i.test(url);
}

function isVideoUrl(url?: string, type?: string): boolean {
  if (!url) return false;
  if (type?.toLowerCase().includes("video") || type?.toLowerCase().includes("reel") || type?.toLowerCase().includes("story") || type?.toLowerCase().includes("short")) return true;
  return /\.(mp4|webm|mov|mkv)(\?.*)?$/i.test(url);
}

export function ContentSubmissionsCard({ submissions }: Readonly<ContentSubmissionsCardProps>) {
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);

  if (!submissions || submissions.length === 0) {
    return (
      <EmptyState
        emoji=""
        title="No Submissions Yet"
        description="Deliverable submissions and revision versions will appear here once submitted."
        compact
      />
    );
  }

  return (
    <Card className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <h3 className="font-heading font-bold text-base sm:text-lg text-foreground">
            Deliverables & Version History
          </h3>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted font-semibold text-muted-foreground border border-border">
          {submissions.length} {submissions.length === 1 ? "Version" : "Versions"}
        </span>
      </div>

      <div className="space-y-4">
        {submissions.map((sub, index) => {
          const versionNumber = sub.version || (submissions.length - index);
          const isLatest = index === 0;
          const isExpanded = expandedVersion === versionNumber || (isLatest && expandedVersion === null);
          const notes = sub.notes || "";
          const subUrls: ContentUrlEntry[] = Array.isArray(sub.contentUrls) ? sub.contentUrls : [];

          let statusBadge = (
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold bg-pending-muted text-pending border border-pending-border shrink-0 whitespace-nowrap">
              <Clock className="w-3 h-3" /> Under Review
            </span>
          );

          if (sub.status === "APPROVED") {
            statusBadge = (
              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold bg-verified-muted text-verified border border-verified-border shrink-0 whitespace-nowrap">
                <CheckCircle2 className="w-3 h-3" /> Approved
              </span>
            );
          } else if (sub.status === "REVISION_REQUESTED") {
            statusBadge = (
              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold bg-disputed-muted text-disputed border border-disputed-border shrink-0 whitespace-nowrap">
                <AlertTriangle className="w-3 h-3" /> Revision Requested
              </span>
            );
          }

          return (
            <div
              key={sub.id || `version-${versionNumber}`}
              className={`rounded-xl border transition-all overflow-hidden ${
                isLatest
                  ? "border-primary/40 bg-card shadow-sm"
                  : "border-border bg-muted/30"
              }`}
            >
              {/* Version Accordion Header */}
              <button
                type="button"
                onClick={() => setExpandedVersion(isExpanded ? -1 : versionNumber)}
                className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left hover:bg-muted/50 transition-colors"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold font-mono ${
                    isLatest ? "bg-primary text-primary-foreground" : "bg-muted text-foreground border border-border"
                  }`}>
                    v{versionNumber}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {isLatest ? "Latest Deliverable" : `Submission v${versionNumber}`}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Submitted on {formatContractDate(sub.submittedAt || sub.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {statusBadge}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Version Details Collapsible Content */}
              {isExpanded && (
                <div className="p-3.5 sm:p-4 pt-0 space-y-3 border-t border-border">
                  {/* Brand Feedback */}
                  {sub.feedback && (
                    <div className="p-3 rounded-xl bg-pending-muted border border-pending-border text-xs">
                      <div className="font-bold text-pending flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Brand Feedback:</span>
                      </div>
                      <p className="text-foreground leading-relaxed">
                        &ldquo;{sub.feedback}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Visual Proof-of-Work Media Preview Grid */}
                  {(() => {
                    const mediaItems =
                      subUrls.length > 0
                        ? subUrls.filter((u): u is ContentUrlEntry & { url: string } => Boolean(u.url))
                        : sub.contentUrl
                        ? [{ url: sub.contentUrl, type: "deliverable" }]
                        : [];

                    if (mediaItems.length === 0) return null;

                    return (
                      <div className="space-y-1.5 mb-2">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Deliverable Previews
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {mediaItems.map((item, itemIdx) => {
                            const isImg = isImageUrl(item.url, item.type);
                            const isVid = isVideoUrl(item.url, item.type);
                            const label = item.type.replace(/_\d+$/, "").replaceAll("_", " ");

                            if (isImg) {
                              return (
                                <a
                                  key={`thumb-${itemIdx}-${item.url}`}
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group relative aspect-video rounded-xl overflow-hidden border border-border/80 bg-muted/40 shadow-xs hover:border-primary/60 transition-all block focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                                  title={`View ${label}`}
                                >
                                  <img
                                    src={item.url}
                                    alt={label}
                                    loading="lazy"
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent opacity-85 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                                    <div className="flex items-center justify-between gap-1 text-[11px] text-white">
                                      <span className="font-medium truncate capitalize flex items-center gap-1">
                                        <ImageIcon className="w-3 h-3 shrink-0" />
                                        <span className="truncate">{label}</span>
                                      </span>
                                      <ExternalLink className="w-3 h-3 shrink-0 opacity-80 group-hover:opacity-100" />
                                    </div>
                                  </div>
                                </a>
                              );
                            }

                            if (isVid) {
                              return (
                                <a
                                  key={`thumb-${itemIdx}-${item.url}`}
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group relative aspect-video rounded-xl overflow-hidden border border-border/80 bg-muted/50 shadow-xs hover:border-primary/60 transition-all flex flex-col items-center justify-center p-2.5 text-center focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                                  title={`Watch ${label}`}
                                >
                                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                                    <Video className="w-4 h-4" />
                                  </div>
                                  <span className="text-[11px] font-semibold text-foreground truncate max-w-full capitalize">
                                    {label}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                    Watch Video <ExternalLink className="w-2.5 h-2.5" />
                                  </span>
                                </a>
                              );
                            }

                            return (
                              <a
                                key={`thumb-${itemIdx}-${item.url}`}
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group relative aspect-video rounded-xl border border-border/80 bg-muted/40 shadow-xs hover:border-primary/60 transition-all flex flex-col items-center justify-center p-2.5 text-center focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                                title={`Open ${label}`}
                              >
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center mb-1 text-muted-foreground group-hover:text-primary transition-colors">
                                  <FileText className="w-4 h-4" />
                                </div>
                                <span className="text-[11px] font-semibold text-foreground truncate max-w-full capitalize">
                                  {label}
                                </span>
                                <span className="text-[10px] text-primary font-medium flex items-center gap-1 mt-0.5">
                                  View Asset <ExternalLink className="w-2.5 h-2.5" />
                                </span>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Deliverable Items */}
                  <div className="space-y-2">
                    {subUrls.length > 0 ? (
                      subUrls.map((urlObj: ContentUrlEntry) => (
                        <div
                          key={urlObj.type}
                          className="flex justify-between items-center p-2.5 bg-muted/40 rounded-xl border border-border text-xs"
                        >
                          <div>
                            <span className="font-semibold text-foreground capitalize block">
                              {urlObj.type.replace(/_\d+$/, "").replaceAll("_", " ")}
                            </span>
                            {urlObj.feedback && (
                              <span className="text-[11px] text-pending">
                                Note: {urlObj.feedback}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {urlObj.status && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                urlObj.status === "APPROVED"
                                  ? "bg-verified-muted text-verified border border-verified-border"
                                  : urlObj.status === "REVISION_REQUESTED"
                                  ? "bg-disputed-muted text-disputed border border-disputed-border"
                                  : "bg-muted text-muted-foreground border border-border"
                              }`}>
                                {urlObj.status}
                              </span>
                            )}
                            <a
                              href={urlObj.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                            >
                              Open <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ))
                    ) : sub.contentUrl ? (
                      <div className="flex justify-between items-center p-2.5 bg-muted/40 rounded-xl border border-border text-xs">
                        <span className="font-semibold text-foreground">Deliverable Media Link</span>
                        <a
                          href={sub.contentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          Open <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ) : null}
                  </div>

                  {/* Creator Notes */}
                  {notes.trim() && (
                    <div className="p-3 bg-muted/40 rounded-xl border border-border text-xs text-muted-foreground">
                      <strong className="text-foreground">Creator Notes:</strong> {notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
