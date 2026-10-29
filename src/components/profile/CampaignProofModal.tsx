"use client";

import React from "react";
import Image from "next/image";
import { CampaignProofItem } from "./types";
import { formatCurrency, formatDate } from "@/lib/utils-client";
import { BottomSheet } from "@/components/ui";

import {
  ShieldCheck,
  Lock,
  Star,
  CheckCircle2,
  Calendar,
  Layers,
} from "lucide-react";

interface CampaignProofModalProps {
  proof: CampaignProofItem | null;
  onClose: () => void;
}

export default function CampaignProofModal({
  proof,
  onClose,
}: Readonly<CampaignProofModalProps>) {
  if (!proof) return null;

  const headerTitle = (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-10 h-10 rounded-full overflow-hidden bg-muted shrink-0 border border-border flex items-center justify-center">
        {proof.brandAvatar ? (
          <Image
            src={proof.brandAvatar}
            alt={proof.brandName}
            width={40}
            height={40}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-xs font-bold text-foreground">
            {proof.brandName.substring(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0 text-left">
        <div className="flex items-center gap-1.5">
          <h4 className="text-sm font-bold text-foreground truncate">
            {proof.brandName}
          </h4>
          <ShieldCheck className="w-4 h-4 text-verified" />
        </div>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>Completed on {formatDate(proof.completedDate)}</span>
        </p>
      </div>
    </div>
  );

  return (
    <BottomSheet
      open={Boolean(proof)}
      onClose={onClose}
      title={headerTitle}
      maxWidth="32rem"
    >

      <div className="space-y-5">
        {/* Media Banner / Cover Photo */}
        <div className="relative aspect-[16/9] w-full rounded-2xl bg-muted overflow-hidden border border-border">
          {proof.coverImage ? (
            <Image
              src={proof.coverImage}
              alt={proof.title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-escrow-muted via-card to-muted p-6 text-center">
              <Lock className="w-8 h-8 text-escrow mb-2" />
              <span className="text-sm font-bold text-foreground">Verified Escrow Deliverable</span>
            </div>
          )}

          {/* Escrow Badge Overlay */}
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md bg-escrow-muted/95 text-escrow border-escrow-border shadow-md shrink-0 whitespace-nowrap">
              <Lock className="w-3.5 h-3.5" />
              <span className="tabular-nums">{formatCurrency(proof.amountPaise)} Escrow Released</span>
            </span>
          </div>
        </div>

        {/* Campaign Brief & Title */}
        <div className="space-y-2">
          <h3 id="proof-modal-title" className="text-base sm:text-lg font-bold text-foreground">
            {proof.title}
          </h3>
          {proof.outcomeMetric && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0 whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{proof.outcomeMetric}</span>
            </div>
          )}
        </div>

        {/* Deliverables Checklist */}
        {proof.deliverables && proof.deliverables.length > 0 && (
          <div className="p-4 rounded-2xl bg-muted/50 border border-border">
            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>Verified Deliverables</span>
            </h5>
            <ul className="space-y-1.5">
              {proof.deliverables.map((d, idx) => (
                <li key={idx} className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-verified shrink-0" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Brand Testimonial / Review */}
        {proof.reviewComment && (
          <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Brand Feedback</span>
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="w-3.5 h-3.5 fill-amber-500" />
                <span className="text-xs font-bold text-foreground">{proof.rating || 5}.0</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic leading-relaxed">
              &ldquo;{proof.reviewComment}&rdquo;
            </p>
          </div>
        )}

        {/* Escrow Guarantee Box */}
        <div className="p-3.5 rounded-xl border border-verified-border bg-verified-muted flex items-center gap-2.5 text-xs text-verified">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>
            Funds were held in VyaparMedia escrow and released automatically upon brand milestone approval.
          </span>
        </div>
      </div>
    </BottomSheet>
  );
}

