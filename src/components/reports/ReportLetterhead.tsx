"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { PLATFORM_CONFIG } from "@/lib/platform-config";
import { isConfigValuePresent } from "@/lib/platform-config-check";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";

export interface ReportLetterheadProps {
  title?: string | undefined;
  subtitle?: string | undefined;
  categoryLabel?: string | undefined;
  referenceId?: string | undefined;
  generatedDate?: string | undefined;
  isAdmin?: boolean | undefined;
  showAdminBanner?: boolean | undefined;
  className?: string | undefined;
}

export function ReportLetterhead({
  title,
  subtitle,
  categoryLabel = "OFFICIAL FINANCIAL STATEMENT & LEDGER RECORD",
  referenceId,
  generatedDate,
  isAdmin = false,
  showAdminBanner = true,
  className = "",
}: ReportLetterheadProps) {
  const platformConfig = usePlatformConfig();

  const missingTaxFields: string[] = [];
  if (!isConfigValuePresent(platformConfig.legalName)) missingTaxFields.push("Company Legal Name");
  if (!isConfigValuePresent(platformConfig.gstin)) missingTaxFields.push("GSTIN");
  if (!isConfigValuePresent(platformConfig.address)) missingTaxFields.push("Registered Address");

  const renderConfigValue = (val: string | undefined | null, fieldName: string) => {
    if (isConfigValuePresent(val)) {
      return val;
    }
    return (
      <span
        title={`Missing ${fieldName}. Please configure in environment variables.`}
        className="inline-block text-amber-600 dark:text-amber-400 font-mono text-2xs bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/30"
      >
        [Not configured]
      </span>
    );
  };

  const hasCin =
    platformConfig.cin &&
    !["N/A", "NONE", "PROPRIETORSHIP"].includes(platformConfig.cin.toUpperCase());

  return (
    <header className={`report-letterhead border-b-2 border-border pb-6 mb-8 ${className}`}>
      {/* Admin Alert Banner for Incomplete Platform Corporate Config */}
      {isAdmin && showAdminBanner && missingTaxFields.length > 0 && (
        <div className="no-print mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>Platform Configuration Warning:</strong> Required corporate fields missing (
              {missingTaxFields.join(", ")}). External tax reports are currently blocked.
            </span>
          </div>
          <Link
            href="/admin/system"
            className="inline-flex items-center gap-1 font-bold underline hover:opacity-80 shrink-0"
          >
            <span>Configure in Admin System</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        {/* Left: VyaparMedia Branding & Document Title */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 shrink-0 relative"
              style={{
                printColorAdjust: "exact",
                WebkitPrintColorAdjust: "exact",
              }}
            >
              <Image
                src="/logo-vm.png"
                alt="VyaparMedia"
                width={56}
                height={56}
                priority
                className="w-14 h-14 object-contain select-none print:w-14 print:h-14"
              />
            </div>
            <div>
              <span className="text-lg sm:text-xl font-black tracking-tight text-foreground leading-none block">
                Vyapar<span className="text-primary font-black ml-0.5">Media</span>
              </span>
              <span className="text-[10px] sm:text-[11px] text-muted-foreground font-medium block">
                Trusted Creator Commerce
              </span>
            </div>
          </div>

          <div>
            {categoryLabel && (
              <span className="text-2xs font-mono font-bold tracking-widest text-primary uppercase block mb-1">
                {categoryLabel}
              </span>
            )}
            {title && (
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground uppercase">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1 max-w-lg leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right: Company Details (read ONLY from platformConfig) */}
        <div className="text-left sm:text-right text-xs text-muted-foreground space-y-0.5 font-sans max-w-md">
          <div className="font-bold text-foreground">
            {platformConfig.tradeName && platformConfig.tradeName !== platformConfig.legalName
              ? `${platformConfig.tradeName.toUpperCase()} (${renderConfigValue(
                  platformConfig.legalName,
                  "Legal Name"
                )})`
              : renderConfigValue(platformConfig.legalName, "Legal Name")}
          </div>

          <div>
            {hasCin && (
              <>
                CIN: {platformConfig.cin}
                <span className="mx-1 opacity-50">|</span>
              </>
            )}
            {platformConfig.udyam && (
              <>
                Udyam: {platformConfig.udyam}
                <span className="mx-1 opacity-50">|</span>
              </>
            )}
            GSTIN: {renderConfigValue(platformConfig.gstin, "GSTIN")}
            {platformConfig.pan && (
              <>
                <span className="mx-1 opacity-50">|</span>
                PAN: {platformConfig.pan}
              </>
            )}
          </div>

          <div className="break-words">
            {renderConfigValue(platformConfig.address, "Registered Corporate Address")}
          </div>

          <div className="pt-0.5">
            {platformConfig.phone && (
              <>
                Phone: {platformConfig.phone}
                <span className="mx-1 opacity-50">|</span>
              </>
            )}
            Email: {renderConfigValue(platformConfig.email, "Support Email")}
            <span className="mx-1 opacity-50">|</span>
            {renderConfigValue(platformConfig.website, "Website")}
          </div>

          {(generatedDate || referenceId) && (
            <div className="font-mono text-2xs text-muted-foreground pt-1">
              {generatedDate && <span>Generated: {generatedDate}</span>}
              {generatedDate && referenceId && <span className="mx-1.5 opacity-50">|</span>}
              {referenceId && <span>Ref: {referenceId}</span>}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default ReportLetterhead;
