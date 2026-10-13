"use client";

import React from "react";
import { Button, Select, Input, Textarea } from "@/components/ui";
import { DisputeDetail } from "./DisputeHelpers";
import { formatDate } from "@/lib/utils-client";
import { Paperclip, ExternalLink, Plus, X, FileText } from "lucide-react";

interface DisputeEvidenceProps {
  readonly dispute: DisputeDetail;
  readonly showEvidenceForm: boolean;
  readonly setShowEvidenceForm: (show: boolean) => void;
  readonly evidenceType: string;
  readonly setEvidenceType: (type: string) => void;
  readonly evidenceUrl: string;
  readonly setEvidenceUrl: (url: string) => void;
  readonly evidenceDesc: string;
  readonly setEvidenceDesc: (desc: string) => void;
  readonly onSubmit: (e: React.FormEvent) => void;
  readonly isSubmitting: boolean;
}

export function DisputeEvidence({
  dispute,
  showEvidenceForm,
  setShowEvidenceForm,
  evidenceType,
  setEvidenceType,
  evidenceUrl,
  setEvidenceUrl,
  evidenceDesc,
  setEvidenceDesc,
  onSubmit,
  isSubmitting,
}: Readonly<DisputeEvidenceProps>) {
  const canAddEvidence = ["OPEN", "TIER1_AUTO", "TIER2_MEDIATION"].includes(dispute.status);
  const evidenceList = dispute.evidence || [];

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header Row */}
      <div className="flex justify-between items-center pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-primary" />
          <h2 className="text-base font-bold text-foreground">Evidence Vault</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
            {evidenceList.length}
          </span>
        </div>

        {canAddEvidence && (
          <Button
            variant={showEvidenceForm ? "secondary" : "primary"}
            size="sm"
            onClick={() => setShowEvidenceForm(!showEvidenceForm)}
            className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-xl"
          >
            {showEvidenceForm ? (
              <>
                <X className="w-3.5 h-3.5" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                Add Evidence
              </>
            )}
          </Button>
        )}
      </div>

      {/* Evidence Submission Form */}
      {showEvidenceForm && (
        <form
          onSubmit={onSubmit}
          className="bg-background/80 border border-border rounded-xl p-4 space-y-3 animate-fade-in"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Submit Supporting Documentation
            </h3>
          </div>

          <Select
            label="Evidence Category"
            id="evidence-type-select"
            value={evidenceType}
            onChange={(e) => setEvidenceType(e.target.value)}
            fullWidth
          >
            <option value="CONTRACT">Contract & Agreement Terms</option>
            <option value="DELIVERABLE">Deliverable Video / Photo Draft</option>
            <option value="CHAT_LOG">Platform Chat Log / Direct Agreement</option>
            <option value="PAYMENT_PROOF">Payment or Invoice Receipt</option>
            <option value="OTHER">Other Documentation</option>
          </Select>

          <Input
            label="Evidence Direct URL"
            id="evidence-url-input"
            type="url"
            placeholder="https://drive.google.com/... or https://dropbox.com/..."
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            fullWidth
            required
          />

          <Textarea
            label="Context & Explanation"
            id="evidence-desc-textarea"
            rows={3}
            placeholder="Explain how this document supports your position..."
            value={evidenceDesc}
            onChange={(e) => setEvidenceDesc(e.target.value)}
            fullWidth
          />

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowEvidenceForm(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting || !evidenceUrl}
            >
              {isSubmitting ? "Uploading..." : "Submit to Mediators"}
            </Button>
          </div>
        </form>
      )}

      {/* Evidence Items List */}
      {evidenceList.length === 0 ? (
        <div className="text-center py-6 px-4 bg-muted/30 rounded-xl border border-dashed border-border/80">
          <FileText className="w-8 h-8 text-muted-foreground/60 mx-auto mb-2" />
          <p className="text-xs font-semibold text-foreground">No Evidence Files Uploaded Yet</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs mx-auto">
            Both parties can upload screenshots, contract revisions, or raw media drafts to substantiate their claim.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {evidenceList.map((item) => (
            <div
              key={item.id}
              className="bg-background/60 border border-border/70 rounded-xl p-3 hover:border-border transition-colors space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border">
                  {item.type.replaceAll("_", " ")}
                </span>
                {item.submittedAt && (
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(item.submittedAt)}
                  </span>
                )}
              </div>

              {item.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              )}

              {item.url && (
                <div className="pt-1">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Evidence File
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
