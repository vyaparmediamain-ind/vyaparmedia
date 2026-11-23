import { PLATFORM_CONFIG } from "@/lib/platform-config";
import { AppError } from "@/lib/errors";

/**
 * Platform Corporate Configuration & Tax Prerequisite Verifier
 * Conforms to VyaparMedia Report Standard (v3).
 *
 * Rules:
 * - External / Tax Reports (GST TCS, TDS, Invoices, Brand Spend & GST, Influencer Income & TDS)
 *   MUST be blocked when essential statutory corporate details (legalName, GSTIN, address) are missing.
 * - Missing non-tax fields must be flagged with visible warnings instead of failing silently.
 */

export const REQUIRED_TAX_CONFIG_KEYS = ["legalName", "gstin", "address"] as const;
export type RequiredTaxConfigKey = (typeof REQUIRED_TAX_CONFIG_KEYS)[number];

export const RECOMMENDED_CONFIG_KEYS = [
  "name",
  "tradeName",
  "email",
  "phone",
  "website",
  "pan",
  "cin",
  "udyam",
  "sacCode",
] as const;

export interface PlatformConfigFieldStatus {
  key: string;
  label: string;
  envVar: string;
  isTaxRequired: boolean;
  isConfigured: boolean;
  value: string;
}

const FIELD_METADATA: Record<
  string,
  { label: string; envVar: string; isTaxRequired: boolean }
> = {
  legalName: {
    label: "Company Legal Name",
    envVar: "PLATFORM_LEGAL_NAME",
    isTaxRequired: true,
  },
  gstin: {
    label: "Company GSTIN",
    envVar: "PLATFORM_GSTIN",
    isTaxRequired: true,
  },
  address: {
    label: "Registered Corporate Address",
    envVar: "PLATFORM_ADDRESS",
    isTaxRequired: true,
  },
  name: {
    label: "Platform Brand Name",
    envVar: "PLATFORM_NAME",
    isTaxRequired: false,
  },
  tradeName: {
    label: "Trade / Doing Business As (DBA) Name",
    envVar: "PLATFORM_TRADE_NAME",
    isTaxRequired: false,
  },
  email: {
    label: "Official Contact / Support Email",
    envVar: "PLATFORM_EMAIL",
    isTaxRequired: false,
  },
  phone: {
    label: "Official Support Phone",
    envVar: "PLATFORM_PHONE",
    isTaxRequired: false,
  },
  website: {
    label: "Public Website URL",
    envVar: "PLATFORM_WEBSITE",
    isTaxRequired: false,
  },
  pan: {
    label: "Company Permanent Account Number (PAN)",
    envVar: "PLATFORM_PAN",
    isTaxRequired: false,
  },
  cin: {
    label: "Corporate Identification Number (CIN)",
    envVar: "PLATFORM_CIN",
    isTaxRequired: false,
  },
  udyam: {
    label: "MSME / Udyam Registration Number",
    envVar: "PLATFORM_UDYAM",
    isTaxRequired: false,
  },
  sacCode: {
    label: "Primary Service Accounting Code (SAC)",
    envVar: "PLATFORM_PRIMARY_SAC",
    isTaxRequired: false,
  },
};

/**
 * Checks if a config value is present and not a dummy placeholder.
 */
export function isConfigValuePresent(val?: string | null): boolean {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (trimmed === "[Not configured]") return false;
  if (/X{4,}/i.test(trimmed)) return false;
  return true;
}

/**
 * Returns full status of all platform configuration fields.
 */
export function getPlatformConfigStatus(): PlatformConfigFieldStatus[] {
  const result: PlatformConfigFieldStatus[] = [];

  for (const [key, meta] of Object.entries(FIELD_METADATA)) {
    const rawValue = (PLATFORM_CONFIG as unknown as Record<string, string>)[key] || "";
    const isConfigured = isConfigValuePresent(rawValue);
    result.push({
      key,
      label: meta.label,
      envVar: meta.envVar,
      isTaxRequired: meta.isTaxRequired,
      isConfigured,
      value: isConfigured ? rawValue : "[Not configured]",
    });
  }

  return result;
}

/**
 * Lists all missing configuration fields (required or recommended).
 */
export function getMissingPlatformConfigFields(): PlatformConfigFieldStatus[] {
  return getPlatformConfigStatus().filter((f) => !f.isConfigured);
}

/**
 * Lists only missing fields that are strictly mandatory for statutory tax reports.
 */
export function getMissingTaxConfigFields(): PlatformConfigFieldStatus[] {
  return getPlatformConfigStatus().filter((f) => f.isTaxRequired && !f.isConfigured);
}

/**
 * Validates that all statutory tax report prerequisites are satisfied.
 */
export function validateTaxReportPrerequisites(): {
  valid: boolean;
  missingFields: string[];
  missingFieldLabels: string[];
  errorMessage: string;
} {
  const missing = getMissingTaxConfigFields();

  if (missing.length === 0) {
    return {
      valid: true,
      missingFields: [],
      missingFieldLabels: [],
      errorMessage: "",
    };
  }

  const missingKeys = missing.map((m) => m.key);
  const missingLabels = missing.map((m) => m.label);

  const errorMessage = `Platform configuration incomplete: ${missingLabels.join(
    ", "
  )} must be configured in environment variables (${missing
    .map((m) => m.envVar)
    .join(", ")}) before external or tax reports can be generated.`;

  return {
    valid: false,
    missingFields: missingKeys,
    missingFieldLabels: missingLabels,
    errorMessage,
  };
}

/**
 * Asserts statutory tax report prerequisites, throwing an AppError if invalid.
 */
export function assertTaxReportPrerequisites(): void {
  const check = validateTaxReportPrerequisites();
  if (!check.valid) {
    throw AppError.badRequest(check.errorMessage);
  }
}

/**
 * Returns whether all platform configuration fields (including recommended) are set.
 */
export function isPlatformConfigComplete(): boolean {
  return getMissingPlatformConfigFields().length === 0;
}
