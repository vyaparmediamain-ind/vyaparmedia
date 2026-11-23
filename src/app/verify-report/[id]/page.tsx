import React from "react";
import Link from "next/link";
import { ReportVerificationService } from "@/services/report-verification.service";
import { ShieldCheck, ShieldAlert, ArrowLeft, Building2 } from "lucide-react";
import { PLATFORM_CONFIG } from "@/lib/platform-config";
import Logo from "@/components/Logo";

interface VerifyReportPageProps {
  params: Promise<{ id: string }>;
}

export default async function VerifyReportPage({ params }: VerifyReportPageProps) {
  const { id } = await params;
  const result = await ReportVerificationService.verifyReport(id);

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
          {result.valid ? (
            <>
              <div className="w-16 h-16 rounded-full bg-verified-muted border border-verified-border text-verified flex items-center justify-center mx-auto shadow-inner">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <span className="text-2xs font-mono font-bold tracking-widest text-verified uppercase block">
                  Official Cryptographic Seal
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-foreground">
                  Official Document Verified
                </h1>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  This report has been authenticated directly against the VyaparMedia cryptographic ledger.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-muted/50 border border-border text-xs text-left space-y-2 font-mono">
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Report ID:</span>
                  <span className="font-bold text-foreground">{result.id}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Document Type:</span>
                  <span className="font-bold text-foreground">{result.type}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Issued At:</span>
                  <span className="font-bold text-foreground">
                    {result.createdAt ? new Date(result.createdAt).toLocaleString("en-IN") : "Recorded"}
                  </span>
                </div>
              </div>

              <div className="text-2xs text-muted-foreground space-y-1">
                <div className="flex items-center justify-center gap-1 font-semibold text-foreground">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{PLATFORM_CONFIG.legalName || "VyaparMedia Technologies Private Limited"}</span>
                </div>
                <p>Governed under Section 65B of Indian Evidence Act &amp; IT Act 2000.</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center mx-auto shadow-inner">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <span className="text-2xs font-mono font-bold tracking-widest text-destructive uppercase block">
                  Verification Failed
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-foreground">
                  Document Not Found
                </h1>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Report ID &ldquo;{id}&rdquo; was not found or verification records have expired.
                </p>
              </div>
              <p className="text-2xs text-muted-foreground">
                If you believe this document is genuine, please request a freshly generated copy from the issuer.
              </p>
            </>
          )}
        </div>
      </main>

      <footer className="max-w-xl mx-auto w-full pt-6 border-t border-border text-center text-2xs text-muted-foreground">
        &copy; {new Date().getFullYear()} {PLATFORM_CONFIG.name || "VyaparMedia"}. All rights reserved.
      </footer>
    </div>
  );
}
