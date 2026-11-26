import { createHash } from "node:crypto";
import { PLATFORM_CONFIG } from "@/lib/platform-config";

/**
 * Pure Report Metadata, Hashing & Letterhead Builder
 * Conforms to VyaparMedia Report Standard (v3).
 *
 * Rules:
 * - Pure logic: inject clock (`now`) for 100% deterministic unit tests.
 * - Time: store UTC, format display timestamps explicitly in Asia/Kolkata (IST).
 * - Security: mask PII emails (e.g. `r***@gmail.com`).
 * - Integrity: SHA-256 canonical payload hashing + 6-char Base32 short code.
 */

export interface ReportUserContext {
  id?: string | null | undefined;
  name?: string | null | undefined;
  email?: string | null | undefined;
  role?: string | null | undefined;
}

export interface DataQualitySummary {
  verifiedPercent: number;
  estimatedPercent: number;
  selfReportedPercent: number;
  text?: string | undefined;
}

export interface BuildReportMetaInput {
  type: string; // e.g. "ROI", "SPEND", "INCOME", "STATEMENT", "TDS", "REVENUE"
  scope: string; // e.g. "Campaign: Diwali Mega Push", "Wallet: usr_123"
  period: string; // e.g. "FY 2025-26", "01/10/2026 - 31/10/2026"
  user?: ReportUserContext | null | undefined;
  dataQualitySummary?: DataQualitySummary | undefined;
  versions?: Record<string, string> | undefined;
  dataSources?: string[] | undefined;
  now?: Date | string | number | undefined;
  payload?: unknown; // data object to hash for cryptographic integrity code
  extraMeta?: Record<string, string | number | null | undefined> | undefined;
}

export interface ReportMeta {
  reportId: string;
  type: string;
  scope: string;
  period: string;
  generatedAtIst: string;
  generatedAtUtc: string;
  user: {
    id: string;
    name: string;
    role: string;
    email: string;
    maskedEmail: string;
  };
  dataQualitySummary?: {
    verifiedPercent: number;
    estimatedPercent: number;
    selfReportedPercent: number;
    text: string;
  } | undefined;
  versions: Record<string, string>;
  dataSources: string[];
  integrityCode: string;
  shortHash: string;
  extraMeta?: Record<string, string | number | null | undefined> | undefined;
}

/** RFC 4648 Base32 alphabet (uppercase, no padding) */
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Encodes a buffer or byte array into standard Base32 string.
 */
export function encodeBase32(buffer: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | (buffer[i] ?? 0);
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Deterministically serializes any JSON-compatible value with sorted object keys.
 * Handles arrays, primitives, and nulls consistently across environments.
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return "null";
  }
  if (typeof obj === "number" || typeof obj === "boolean") {
    return JSON.stringify(obj);
  }
  if (typeof obj === "string") {
    return JSON.stringify(obj);
  }
  if (obj instanceof Date) {
    return JSON.stringify(obj.toISOString());
  }
  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (typeof obj === "object") {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const entries = keys.map(
      (k) => `${JSON.stringify(k)}:${canonicalJson((obj as Record<string, unknown>)[k])}`
    );
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(String(obj));
}

/**
 * Computes SHA-256 hex digest of string content.
 */
export function sha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Converts the first 4 bytes of a SHA-256 hash into a 6-character Base32 string.
 */
export function extractBase32ShortCode(hashHex: string, length = 6): string {
  const cleanHex = hashHex.replace(/[^0-9a-fA-F]/g, "").slice(0, 10);
  const bytes = new Uint8Array(Math.ceil(cleanHex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  const base32 = encodeBase32(bytes);
  return base32.slice(0, length).padEnd(length, "X").toUpperCase();
}

/**
 * Masks an email address for privacy in public/exported documents.
 * Format: `rahul.sharma@gmail.com` -> `r***@gmail.com`
 * Short handles: `a@b.com` -> `a***@b.com`
 */
export function maskEmail(email?: string | null): string {
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return "Protected";
  }

  const [localPart, domain] = email.trim().toLowerCase().split("@");
  if (!localPart || !domain) {
    return "Protected";
  }

  const visibleChar = localPart.charAt(0);
  return `${visibleChar}***@${domain}`;
}

/**
 * Formats a Date explicitly in Asia/Kolkata (IST) timezone.
 * Output: e.g. "22 Nov 2026, 09:40 PM IST"
 */
export function formatIstDateTime(dateInput: Date | string | number): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) {
    return "Invalid Date";
  }

  const formatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return `${formatter.format(d)} IST`;
}

/**
 * Formats YYYYMMDD in Asia/Kolkata.
 */
export function formatIstDateKey(dateInput: Date | string | number): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) {
    return "19700101";
  }

  const formatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value || "1970";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";

  return `${year}${month}${day}`;
}

/**
 * Formats standard Data Quality text line.
 * e.g. "Data quality: 85% verified, 15% estimated, 0% self-reported"
 */
export function formatDataQualityText(dq: DataQualitySummary): string {
  const v = Math.round(dq.verifiedPercent);
  const e = Math.round(dq.estimatedPercent);
  const s = Math.round(dq.selfReportedPercent);
  return `Data quality: ${v}% verified, ${e}% estimated, ${s}% self-reported`;
}

/**
 * Standard Report ID Builder
 * Format: `VM-<TYPE>-<YYYYMMDD>-<6 char base32 of hash>`
 */
export function buildReportId(type: string, date: Date, hashHex: string): string {
  const cleanType = type.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "REP";
  const dateStr = formatIstDateKey(date);
  const shortCode = extractBase32ShortCode(hashHex, 6);
  return `VM-${cleanType}-${dateStr}-${shortCode}`;
}

/**
 * Pure Report Metadata Builder
 * Creates canonical report ID, timestamps, masked credentials, and SHA-256 integrity code.
 */
export function buildReportMeta(input: BuildReportMetaInput): ReportMeta {
  const date = input.now instanceof Date ? input.now : input.now ? new Date(input.now) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  // Compute canonical SHA-256 hash of payload (or metadata fallback)
  const canonicalData = input.payload !== undefined
    ? canonicalJson(input.payload)
    : canonicalJson({
        type: input.type,
        scope: input.scope,
        period: input.period,
        userId: input.user?.id || null,
        timestamp: safeDate.toISOString(),
      });

  const integrityCode = sha256Hex(canonicalData);
  const shortHash = extractBase32ShortCode(integrityCode, 6);
  const reportId = buildReportId(input.type, safeDate, integrityCode);

  const dq = input.dataQualitySummary
    ? {
        verifiedPercent: input.dataQualitySummary.verifiedPercent,
        estimatedPercent: input.dataQualitySummary.estimatedPercent,
        selfReportedPercent: input.dataQualitySummary.selfReportedPercent,
        text: input.dataQualitySummary.text || formatDataQualityText(input.dataQualitySummary),
      }
    : undefined;

  return {
    reportId,
    type: input.type.toUpperCase(),
    scope: input.scope,
    period: input.period,
    generatedAtIst: formatIstDateTime(safeDate),
    generatedAtUtc: safeDate.toISOString(),
    user: {
      id: input.user?.id || "",
      name: input.user?.name || "Platform Member",
      role: input.user?.role || "USER",
      email: input.user?.email || "",
      maskedEmail: maskEmail(input.user?.email),
    },
    dataQualitySummary: dq,
    versions: input.versions || {
      analyticsEngine: "v3.0",
      pricingModel: "v3.0",
      complianceRuleSet: "FY2025-26",
    },
    dataSources: input.dataSources || [
      "Meta Graph API",
      "YouTube Data API v3",
      "Vyapar Escrow Ledger",
      "Statutory Tax Records",
    ],
    integrityCode,
    shortHash,
    extraMeta: input.extraMeta,
  };
}

/**
 * Builds text lines for CSV header blocks with `# ` comment prefixes.
 * Conforms to Report Standard Section 7.
 */
export function buildReportTextHeader(meta: ReportMeta): string[] {
  const lines: string[] = [];

  // 1. Corporate Identity from PLATFORM_CONFIG
  lines.push(`# Platform: ${PLATFORM_CONFIG.name || "[Not configured]"}`);
  lines.push(`# Legal Name: ${PLATFORM_CONFIG.legalName || "[Not configured]"}`);
  if (PLATFORM_CONFIG.tradeName) {
    lines.push(`# Trade Name: ${PLATFORM_CONFIG.tradeName}`);
  }
  lines.push(`# Registered Address: ${PLATFORM_CONFIG.address || "[Not configured]"}`);
  lines.push(`# GSTIN: ${PLATFORM_CONFIG.gstin || "[Not configured]"}`);
  if (PLATFORM_CONFIG.pan) {
    lines.push(`# PAN: ${PLATFORM_CONFIG.pan}`);
  }
  if (
    PLATFORM_CONFIG.cin &&
    !["N/A", "NONE", "PROPRIETORSHIP"].includes(PLATFORM_CONFIG.cin.toUpperCase())
  ) {
    lines.push(`# CIN: ${PLATFORM_CONFIG.cin}`);
  }
  if (PLATFORM_CONFIG.udyam) {
    lines.push(`# MSME/Udyam Reg: ${PLATFORM_CONFIG.udyam}`);
  }
  lines.push(`# Support Email: ${PLATFORM_CONFIG.email || "[Not configured]"}`);
  lines.push(`# Website: ${PLATFORM_CONFIG.website || "[Not configured]"}`);

  // 2. Report Meta Block
  lines.push(`# ---`);
  lines.push(`# Report Title: ${meta.type} REPORT`);
  lines.push(`# Report ID: ${meta.reportId}`);
  lines.push(`# Generated At: ${meta.generatedAtIst} (${meta.generatedAtUtc})`);
  lines.push(
    `# Generated For: ${meta.user.name} (${meta.user.role}) <${meta.user.maskedEmail}>`
  );
  lines.push(`# Scope: ${meta.scope}`);
  lines.push(`# Period: ${meta.period}`);
  if (meta.dataQualitySummary) {
    lines.push(`# ${meta.dataQualitySummary.text}`);
  }
  lines.push(`# SHA-256 Integrity: ${meta.integrityCode}`);

  return lines;
}

/**
 * Builds text lines for CSV footer blocks with `# ` comment prefixes.
 */
export function buildReportTextFooter(meta: ReportMeta): string[] {
  return [
    `# --- End of Report ---`,
    `# Generated by ${PLATFORM_CONFIG.name || "[Not configured]"} · ${PLATFORM_CONFIG.website || "[Not configured]"}`,
    `# For queries: ${PLATFORM_CONFIG.email || "[Not configured]"} | Report ID: ${meta.reportId}`,
    `# Disclaimer: Estimated figures are indicative. This report is not tax, legal or financial advice.`,
  ];
}
