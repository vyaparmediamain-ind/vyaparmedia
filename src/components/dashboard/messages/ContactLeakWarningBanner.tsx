"use client";

import React from "react";
import { ShieldAlert } from "lucide-react";
import { ContactLeakResult } from "@/lib/contact-leak-detector";

export interface ContactLeakWarningBannerProps {
  leakResult: ContactLeakResult;
}

export function ContactLeakWarningBanner({ leakResult }: Readonly<ContactLeakWarningBannerProps>) {
  if (!leakResult.hasLeak) {
    return null;
  }

  return (
    <div
      role="alert"
      className="mb-2 p-3.5 rounded-xl border border-pending-border bg-pending-muted text-pending text-xs shadow-sm transition-all"
    >
      <div className="flex items-start gap-2.5">
        <div className="p-1 rounded-lg bg-pending/20 text-pending shrink-0 mt-0.5">
          <ShieldAlert className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 font-bold text-pending">
            <span>Safety Warning: External Contact Details Detected</span>
          </div>
          <p className="mt-0.5 leading-relaxed text-foreground/90">
            <strong>Platform ke bahar contact share karna deal protection khatam kar sakta hai.</strong>{" "}
            VyaparMedia escrow security, payment guarantees, and dispute mediation apply only to
            agreements conducted directly within the platform.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {leakResult.detectedTypes.map((type) => (
              <span
                key={type}
                className="px-2 py-0.5 rounded-md font-semibold text-[10px] bg-pending/20 text-pending border border-pending-border"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
