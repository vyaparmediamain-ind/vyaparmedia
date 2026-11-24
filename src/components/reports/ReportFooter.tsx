"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { PLATFORM_CONFIG } from "@/lib/platform-config";
import { ShieldCheck } from "lucide-react";

export interface ReportFooterProps {
  integrityCode?: string | undefined;
  reportId?: string | undefined;
  showQrCode?: boolean | undefined;
  disclaimer?: string | undefined;
  className?: string | undefined;
}

export function ReportFooter({
  integrityCode,
  reportId,
  showQrCode = true,
  disclaimer = "Estimated figures are indicative. This report is not tax, legal or financial advice.",
  className = "",
}: ReportFooterProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!reportId || !showQrCode) return;

    const origin =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : PLATFORM_CONFIG.website;

    const verifyUrl = `${origin}/verify-report/${reportId}`;

    QRCode.toDataURL(verifyUrl, {
      margin: 1,
      width: 80,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => {
        // Fallback: omit QR if rendering fails
      });
  }, [reportId, showQrCode]);

  const website = PLATFORM_CONFIG.domain || (PLATFORM_CONFIG.website ? PLATFORM_CONFIG.website.replace(/^https?:\/\//, "") : "");
  const email = PLATFORM_CONFIG.email;

  return (
    <footer className={`report-footer pt-6 border-t-2 border-border space-y-4 ${className}`}>
      {/* Top Bar: Verification QR + Integrity Code + Platform Seal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
            <ShieldCheck className="w-4 h-4 text-verified shrink-0" />
            <span>Cryptographic Document Integrity &amp; Verification</span>
          </div>

          {integrityCode && (
            <div className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground block font-mono">
                SHA-256 Payload Hash:
              </span>
              <span className="font-mono text-2xs text-muted-foreground break-all block bg-muted/50 p-1.5 rounded-lg border border-border/80">
                {integrityCode}
              </span>
            </div>
          )}

          <p className="text-2xs text-muted-foreground leading-relaxed pt-0.5">
            {disclaimer}
          </p>
        </div>

        {/* QR Code Seal for Public Verification */}
        {qrDataUrl && reportId && (
          <div className="flex items-center gap-2.5 shrink-0 p-2 rounded-xl bg-card border border-border shadow-xs">
            <Image
              src={qrDataUrl}
              alt={`QR verification for report ${reportId}`}
              width={64}
              height={64}
              className="w-16 h-16 object-contain rounded print:w-16 print:h-16"
            />
            <div className="text-left space-y-0.5 max-w-[120px]">
              <span className="text-[9px] font-mono font-bold text-primary uppercase block">
                Scan to Verify
              </span>
              <span className="text-[9px] text-muted-foreground block leading-tight font-mono truncate" title={reportId}>
                {reportId}
              </span>
              <span className="text-[8px] text-muted-foreground block leading-tight">
                Public Ledger Seal
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Repeating Print Footer with Page Counters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-2xs text-muted-foreground print:text-[8pt] font-sans">
        <div>
          <span>{PLATFORM_CONFIG.name || "VyaparMedia"}</span>
          <span className="mx-1.5 opacity-50">&middot;</span>
          <span>{website}</span>
          <span className="mx-1.5 opacity-50">&middot;</span>
          <span>{email}</span>
        </div>

        {/* CSS Page Counter for multi-page printouts */}
        <div className="print-page-counter font-mono">
          <span className="print-only">
            Page <span className="page-number font-bold"></span> of{" "}
            <span className="page-total font-bold"></span>
          </span>
          <span className="no-print">Official System Export</span>
        </div>
      </div>
    </footer>
  );
}

export default ReportFooter;
