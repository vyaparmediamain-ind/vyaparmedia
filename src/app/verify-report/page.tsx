"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, ArrowLeft, Search, Building2, CheckCircle2 } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { PLATFORM_CONFIG } from "@/lib/platform-config";
import Logo from "@/components/Logo";

export default function VerifyReportLandingPage() {
  const router = useRouter();
  const [reportCode, setReportCode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reportCode.trim();
    if (!trimmed) {
      setError("Please enter a valid Report Verification Code or ID");
      return;
    }
    setError("");
    router.push(`/verify-report/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-8">
      <header className="max-w-xl mx-auto w-full flex items-center justify-between pb-6 border-b border-border">
        <Logo asLink={true} size="md" />
        <Link
          href="/"
          className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Home</span>
        </Link>
      </header>

      <main className="max-w-xl mx-auto w-full my-auto py-12">
        <div className="rounded-3xl bg-card border border-border p-6 sm:p-10 shadow-xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <span className="text-2xs font-mono font-bold tracking-widest text-primary uppercase block">
              Document Authenticity Verification
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-foreground">
              Verify Official Platform Report
            </h1>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Authenticate campaign ROI statements, tax certificates, and escrow audit reports against our cryptographic ledger.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label htmlFor="reportCode" className="text-xs font-bold text-foreground">
                Report Verification Code or ID
              </label>
              <div className="relative">
                <Input
                  id="reportCode"
                  value={reportCode}
                  onChange={(e) => {
                    setReportCode(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="e.g. REP-202611-ABCD or clx123..."
                  className="font-mono text-sm tracking-wider uppercase pr-10"
                />
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
              {error && <p className="text-xs text-destructive font-medium">{error}</p>}
            </div>

            <Button type="submit" variant="primary" disabled={!reportCode.trim()} className="w-full gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Verify Authenticity</span>
            </Button>
          </form>

          <div className="p-4 rounded-2xl bg-muted/40 border border-border text-2xs text-muted-foreground text-left space-y-1.5">
            <div className="font-bold text-foreground flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span>Zero-Leak Privacy Assurance</span>
            </div>
            <p>
              This public verification portal checks document cryptographic signatures without exposing underlying brand deal financials, creator PAN details, or bank account identities.
            </p>
          </div>
        </div>
      </main>

      <footer className="max-w-xl mx-auto w-full pt-6 border-t border-border text-center text-xs text-muted-foreground space-y-2">
        <p className="font-semibold text-foreground">{PLATFORM_CONFIG.legalName || PLATFORM_CONFIG.name || "VyaparMedia"}</p>
        <p className="text-2xs">
          GSTIN: {PLATFORM_CONFIG.gstin} · CIN: {PLATFORM_CONFIG.cin}
        </p>
      </footer>
    </div>
  );
}
