"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button, Input, Select, Skeleton } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import { taxComplianceSchema } from "@/lib/validations/auth";
import {
  Receipt,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck2,
  Building2,
  AlertTriangle,
  Info,
  CreditCard,
  Building,
  FileText,
} from "lucide-react";

type TaxComplianceData = {
  userType: "BRAND" | "INFLUENCER" | "ADMIN";
  verifiedPanDocument: boolean;
  compliance: {
    panNumberMasked: string | null;
    gstinMasked: string | null;
    gstStateCode: string | null;
    gstRegistrationType: string;
    gstTurnoverSlab: string | null;
    itrAcknowledgementMasked: string | null;
    itrAssessmentYear: string | null;
    tdsSection: string | null;
    eInvoiceApplicable: boolean;
    status: string;
    updatedAt: string;
  } | null;
  summary: {
    status: string;
    blocking: string[];
    advisories: string[];
  };
};

type Draft = {
  panNumber: string;
  gstin: string;
  gstRegistrationType: string;
  gstTurnoverSlab: string;
  itrAcknowledgementNumber: string;
  itrAssessmentYear: string;
};

const gstRegistrationOptions = [
  { value: "UNREGISTERED", label: "Unregistered / below threshold" },
  { value: "REGISTERED", label: "Registered GST taxpayer" },
  { value: "COMPOSITION", label: "Composition scheme" },
  { value: "EXEMPT", label: "Exempt supplies only" },
];

const gstTurnoverOptions = [
  { value: "", label: "Select turnover slab" },
  { value: "BELOW_20L", label: "Below INR 20 lakh" },
  { value: "BETWEEN_20L_AND_5CR", label: "INR 20 lakh to 5 crore" },
  { value: "FIVE_CR_PLUS", label: "INR 5 crore or more" },
  { value: "TEN_CR_PLUS", label: "INR 10 crore or more" },
];

function emptyDraft(): Draft {
  return {
    panNumber: "",
    gstin: "",
    gstRegistrationType: "UNREGISTERED",
    gstTurnoverSlab: "",
    itrAcknowledgementNumber: "",
    itrAssessmentYear: "",
  };
}

function StatusPill({ status }: Readonly<{ status: string }>) {
  if (status === "READY") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-verified bg-verified-muted px-2.5 py-1 rounded-full border border-verified-border shrink-0 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Payouts
      </span>
    );
  }
  if (status === "PENDING_REVIEW") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-pending bg-pending-muted px-2.5 py-1 rounded-full border border-pending-border shrink-0 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5" /> Under Review
      </span>
    );
  }
  if (status === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-disputed bg-disputed-muted px-2.5 py-1 rounded-full border border-disputed-border shrink-0 whitespace-nowrap">
        <AlertCircle className="w-3.5 h-3.5" /> Tax Review Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-pending bg-pending-muted px-2.5 py-1 rounded-full border border-pending-border shrink-0 whitespace-nowrap">
      <AlertTriangle className="w-3.5 h-3.5" /> Action Required
    </span>
  );
}

function validateComplianceDraft(draft: Draft) {
  const errors: Record<string, string> = {};
  const result = taxComplianceSchema.safeParse({
    pan: draft.panNumber.trim().toUpperCase(),
    gstin: draft.gstin.trim().toUpperCase(),
  });
  if (!result.success) {
    for (const issue of result.error.issues) {
      if (issue.path[0] === "pan") {
        errors.panNumber = issue.message;
      }
      if (issue.path[0] === "gstin") {
        errors.gstin = issue.message;
      }
    }
  }
  return errors;
}

export default function IndiaTaxCompliancePanel() {
  const [data, setData] = useState<TaxComplianceData | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function loadCompliance() {
    setLoading(true);
    setError("");
    try {
      const payload = (await apiClient.settings.getComplianceInfo({
        cache: "no-store",
      } as RequestInit)) as { data?: TaxComplianceData; message?: string };
      const next = payload.data as TaxComplianceData;
      setData(next);
      setDraft({
        ...emptyDraft(),
        gstRegistrationType:
          next.compliance?.gstRegistrationType || "UNREGISTERED",
        gstTurnoverSlab: next.compliance?.gstTurnoverSlab || "",
        itrAssessmentYear: next.compliance?.itrAssessmentYear || "",
      });
    } catch (err) {
      setError(
        formatUserError(
          err,
          "Unable to load tax compliance details. Please try refreshing the page."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCompliance();
  }, []);

  const registeredForGst = useMemo(
    () =>
      draft.gstRegistrationType === "REGISTERED" ||
      draft.gstRegistrationType === "COMPOSITION",
    [draft.gstRegistrationType]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    setFieldErrors({});

    const pan = draft.panNumber.trim().toUpperCase();
    const gstin = draft.gstin.trim().toUpperCase();

    const newFieldErrors = validateComplianceDraft(draft);

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      setSaving(false);
      return;
    }

    const payload: Record<string, string> = {
      gstRegistrationType: draft.gstRegistrationType,
    };

    if (draft.gstTurnoverSlab) payload.gstTurnoverSlab = draft.gstTurnoverSlab;
    if (draft.itrAssessmentYear.trim()) {
      payload.itrAssessmentYear = draft.itrAssessmentYear.trim();
    }
    if (pan) payload.panNumber = pan;
    if (gstin) payload.gstin = gstin;
    if (draft.itrAcknowledgementNumber.trim()) {
      payload.itrAcknowledgementNumber = draft.itrAcknowledgementNumber.trim();
    }

    try {
      await apiClient.settings.saveComplianceInfo(payload);
      setSuccess("India tax compliance details updated successfully.");
      await loadCompliance();
    } catch (err) {
      setError(
        formatUserError(
          err,
          "Failed to save tax compliance information. Please verify your PAN/GST details and try again."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-48 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-xl" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const compliance = data?.compliance;
  const summary = data?.summary;
  const status = summary?.status || "ACTION_REQUIRED";

  // Calculate compliance readiness percentage
  let readinessScore = 0;
  if (compliance?.panNumberMasked || data?.verifiedPanDocument) readinessScore += 40;
  if (compliance?.gstRegistrationType && compliance.gstRegistrationType !== "UNREGISTERED") {
    if (compliance?.gstinMasked) readinessScore += 30;
  } else {
    readinessScore += 30;
  }
  if (compliance?.tdsSection) readinessScore += 15;
  if (compliance?.itrAcknowledgementMasked) readinessScore += 15;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 1. Overview Status Card (matching KYC TierStatusCardComponent) */}
      <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Statutory Compliance &amp; Taxation
            </span>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-foreground tracking-tight">
                  India Tax Compliance &amp; TDS
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  PAN, GSTIN, ITR acknowledgment, and Section 194-O TDS readiness for Indian tax laws.
                </p>
              </div>
            </div>
          </div>

          <div className="sm:text-right p-3 sm:p-0 rounded-xl bg-muted/30 sm:bg-transparent border sm:border-0 border-border">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Status Rating
            </span>
            <div className="mt-1">
              <StatusPill status={status} />
            </div>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              TDS: {compliance?.tdsSection ? compliance.tdsSection.replace("_REVIEW", " (Review)") : "Standard 194J / 194C"}
            </span>
          </div>
        </div>

        {/* Readiness Bar */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-verified" /> Verified ITD &amp; GSTN Declaration
            </span>
            <span className="text-foreground font-bold tabular-nums">
              {readinessScore}% Verified
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-verified h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(10, readinessScore))}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. ITD / CBDT TDS Advisory Card (matching KYC DigiLockerCardComponent) */}
      <div className="p-5 sm:p-6 rounded-2xl border border-verified-border bg-verified-muted/10 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-verified-muted text-verified flex items-center justify-center font-bold text-xl border border-verified-border">
              🇮🇳
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">
                  Automated TDS Credit &amp; Form 16A Filings
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-verified-muted text-verified border border-verified-border">
                  <ShieldCheck className="w-3 h-3" /> Income Tax Dept &amp; TRACES
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Section 194-O / 194J statutory tax ledger</p>
            </div>
          </div>

          <p className="text-xs text-foreground/80 leading-relaxed max-w-2xl">
            TDS deducted on all campaign escrow releases is deposited directly with the Government of India under your verified PAN. Quarterly Form 16A certificates are generated automatically.
          </p>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
            <span className="flex items-center gap-1 text-verified font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> TRACES 26AS Linked
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Auto-Generated Tax Invoices
            </span>
          </div>
        </div>
      </div>

      {/* 3. Tax Identity Records Snapshot Card */}
      <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                Registered Tax Identifiers
              </h3>
              <p className="text-xs text-muted-foreground">
                Official masked identifiers linked to your legal taxpayer record
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 text-xs font-bold text-verified bg-verified-muted px-2.5 py-1 rounded-full border border-verified-border">
            <ShieldCheck className="w-3.5 h-3.5" /> 256-bit Encrypted
          </span>
        </div>

        {/* 6 Metric Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border flex flex-col justify-between">
            <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-primary" /> PAN Number
            </div>
            <div className="font-mono font-extrabold text-sm text-foreground">
              {compliance?.panNumberMasked || (data?.verifiedPanDocument ? "Document Verified" : "Not Provided")}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/30 border border-border flex flex-col justify-between">
            <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-primary" /> GSTIN Identifier
            </div>
            <div className="font-mono font-extrabold text-sm text-foreground">
              {compliance?.gstinMasked || "Not Declared / Exempt"}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/30 border border-border flex flex-col justify-between">
            <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-primary" /> GST Category
            </div>
            <div className="font-bold text-sm text-foreground">
              {compliance?.gstRegistrationType ? compliance.gstRegistrationType.replace("_", " ") : "Unregistered"}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/30 border border-border flex flex-col justify-between">
            <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-primary" /> TDS Deduction Rule
            </div>
            <div className="font-bold text-sm text-foreground">
              {compliance?.tdsSection
                ? compliance.tdsSection.replace("_REVIEW", " (Under Review)")
                : "Standard 194J / 194C"}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/30 border border-border flex flex-col justify-between">
            <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" /> ITR Acknowledgement
            </div>
            <div className="font-bold text-sm text-foreground">
              {compliance?.itrAcknowledgementMasked || "Not Provided"}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/30 border border-border flex flex-col justify-between">
            <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-primary" /> E-Invoice Status
            </div>
            <div className="font-bold text-sm text-foreground">
              {compliance?.eInvoiceApplicable ? "Applicable (> ₹5 Cr)" : "Not Required"}
            </div>
          </div>
        </div>

        {/* Blocking or advisory warnings */}
        {(summary?.blocking?.length || summary?.advisories?.length) ? (
          <div className="space-y-2 pt-2">
            {summary.blocking?.map((item) => (
              <div
                key={item}
                className="p-3 rounded-xl bg-disputed-muted text-disputed border border-disputed-border text-xs font-semibold flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
            {summary.advisories?.map((item) => (
              <div
                key={item}
                className="p-3 rounded-xl bg-pending-muted text-pending border border-pending-border text-xs font-medium flex items-center gap-2"
              >
                <Info className="w-4 h-4 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* 4. Update Tax Details Form Card */}
      <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                Update Tax &amp; GST Declarations
              </h3>
              <p className="text-xs text-muted-foreground">
                Leave any field blank to retain your existing value. Only submitted fields will update.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="p-3.5 rounded-xl bg-disputed-muted text-disputed border border-disputed-border text-xs font-semibold flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            role="status"
            aria-live="polite"
            className="p-3.5 rounded-xl bg-verified-muted text-verified border border-verified-border text-xs font-semibold flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="tax-pan"
              label="PAN Number (10 alphanumeric digits)"
              error={fieldErrors.panNumber}
              value={draft.panNumber}
              placeholder={compliance?.panNumberMasked || "e.g. ABCDE1234F"}
              maxLength={10}
              onChange={(event) =>
                setDraft({ ...draft, panNumber: event.target.value.toUpperCase() })
              }
              fullWidth
            />

            <Select
              id="tax-gst-type"
              label="GST Registration Category"
              value={draft.gstRegistrationType}
              onChange={(event) =>
                setDraft({ ...draft, gstRegistrationType: event.target.value })
              }
              options={gstRegistrationOptions}
              fullWidth
            />

            <Input
              id="tax-gstin"
              label="GSTIN (15 alphanumeric digits)"
              error={fieldErrors.gstin}
              value={draft.gstin}
              placeholder={compliance?.gstinMasked || "e.g. 27ABCDE1234F1Z5"}
              maxLength={15}
              disabled={!registeredForGst}
              onChange={(event) =>
                setDraft({ ...draft, gstin: event.target.value.toUpperCase() })
              }
              fullWidth
            />

            <Select
              id="tax-turnover"
              label="GST Annual Turnover Slab"
              value={draft.gstTurnoverSlab}
              onChange={(event) =>
                setDraft({ ...draft, gstTurnoverSlab: event.target.value })
              }
              options={gstTurnoverOptions}
              fullWidth
            />

            <Input
              id="tax-itr-ay"
              label="ITR Assessment Year"
              value={draft.itrAssessmentYear}
              placeholder="e.g. 2025-26"
              onChange={(event) =>
                setDraft({ ...draft, itrAssessmentYear: event.target.value })
              }
              fullWidth
            />

            <Input
              id="tax-itr-ack"
              label="ITR Acknowledgement Number"
              value={draft.itrAcknowledgementNumber}
              placeholder={compliance?.itrAcknowledgementMasked || "15 digit acknowledgement"}
              inputMode="numeric"
              onChange={(event) =>
                setDraft({
                  ...draft,
                  itrAcknowledgementNumber: event.target.value.replace(/\D/g, ""),
                })
              }
              fullWidth
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={saving}
              aria-busy={saving}
              className="text-xs font-bold px-5"
            >
              {saving ? "Saving Tax Details..." : "Save Tax Details"}
            </Button>
          </div>
        </form>
      </div>

      {/* Trust & ITD Footer */}
      <div className="p-4 rounded-2xl bg-muted/30 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-verified shrink-0" />
          <span>All PAN and GST data are cryptographically tokenized and validated against NSDL / GSTN APIs.</span>
        </div>
        <span className="font-semibold text-foreground">Section 194-O Compliant</span>
      </div>
    </div>
  );
}
