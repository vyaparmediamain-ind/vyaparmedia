import { AppError } from "@/lib/errors";
import { formatUserError } from "./user-messages";

export function formatCurrency(amountInPaise: number | null | undefined): string {
  if (amountInPaise === null || amountInPaise === undefined || Number.isNaN(Number(amountInPaise))) {
    return "₹0";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amountInPaise) / 100);
}

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return "0";
  const n = Number(num);
  if (n >= 10000000) return (n / 10000000).toFixed(1) + "Cr";
  if (n >= 100000) return (n / 100000).toFixed(1) + "L";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toLocaleString("en-IN");
}

export function formatDate(
  date: string | Date | number | null | undefined,
  fallback = "Not specified",
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return fallback;
  const parsed = typeof date === "number" || typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...options,
  }).format(parsed);
}

export function formatDateTime(
  date: string | Date | number | null | undefined,
  fallback = "-",
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return fallback;
  const parsed = typeof date === "number" || typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...options,
  }).format(parsed);
}

export function formatTime(
  date: string | Date | number | null | undefined,
  fallback = ""
): string {
  if (!date) return fallback;
  const parsed = typeof date === "number" || typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function formatRelativeTime(
  date: string | Date | number | null | undefined,
  fallback = ""
): string {
  if (!date) return fallback;
  const parsed = typeof date === "number" || typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) return fallback;

  const now = Date.now();
  const diffMs = now - parsed.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMs < -1000) {
    const absDiffSec = Math.abs(diffSec);
    const absDiffDays = Math.floor(absDiffSec / 86400);
    if (absDiffDays === 0) return "Today";
    if (absDiffDays === 1) return "Tomorrow";
    return `In ${absDiffDays}d`;
  }

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return formatDate(parsed);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function isExpired(date: Date): boolean {
  return new Date() > date;
}

export function parsePagination(searchParams: URLSearchParams, defaultLimit = 20) {
  const rawPage = Number.parseInt(searchParams.get("page") || "1", 10);
  const page = Math.max(1, Number.isNaN(rawPage) ? 1 : rawPage);
  const rawLimit = Number.parseInt(searchParams.get("limit") || String(defaultLimit), 10);
  const limit = Math.min(Math.max(1, Number.isNaN(rawLimit) ? defaultLimit : rawLimit), 50);
  return { page, limit, skip: (page - 1) * limit };
}

export function roundPaise(amountInPaise: number): number {
  return Math.round(amountInPaise);
}

export function getDealTotalAmount(deal: { totalAmount?: number | null; amount: number }): number {
  return deal.totalAmount ?? deal.amount;
}

export const ACTIVE_DEAL_STATUSES = [
  "PENDING_SIGNATURE",
  "ACTIVE",
  "PAYMENT_PENDING",
  "PAYMENT_HELD",
  "CONTENT_SUBMITTED",
  "REVISION_REQUESTED",
  "CONTENT_APPROVED",
  "POSTED",
  "VERIFICATION_PENDING",
  "VERIFIED",
  "DISPUTED",
];

export const ESCROW_HELD_STATUSES = [
  "PAYMENT_HELD",
  "ACTIVE",
  "CONTENT_SUBMITTED",
  "REVISION_REQUESTED",
  "CONTENT_APPROVED",
  "POSTED",
  "VERIFICATION_PENDING",
  "VERIFIED",
  "DISPUTED",
];

export function assertSufficientBalance(
  wallet: { balance?: number; pendingBalance?: number } | null | undefined,
  required: number,
  field: "balance" | "pendingBalance" = "balance"
): void {
  if (!wallet) throw new AppError("Insufficient wallet balance", 402);
  const balance = wallet[field];
  if (balance === undefined || balance < required) throw new AppError("Insufficient wallet balance", 402);
}

export function getDealParticipantRole(
  deal: { influencer: { userId: string }; brand?: { userId: string } | null },
  userId: string
) {
  return {
    isInfluencer: deal.influencer.userId === userId,
    isBrand: deal.brand?.userId === userId,
    isParticipant: deal.influencer.userId === userId || deal.brand?.userId === userId,
  };
}

export function assertAccountCanTransact(status: string | null | undefined) {
  if (["SUSPENDED", "BANNED", "FLAGGED", "DELETED"].includes(status ?? "")) {
    throw AppError.badRequest("Account suspended, flagged, or deleted. Cannot perform this action.");
  }
}

export function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function toPaise(amountInRupees: number): number {
  return Math.round(amountInRupees * 100);
}

export function normalizeDeliverables(
  value: unknown,
): Array<{ type: string; count: number; specs?: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const parsed = item as { type?: unknown; count?: unknown; specs?: unknown };
      return {
        type: typeof parsed?.type === "string" ? parsed.type.trim() : "",
        count: Math.max(1, Number(parsed?.count || 1)),
        ...(typeof parsed?.specs === "string" ? { specs: parsed.specs } : {}),
      };
    })
    .filter((item) => Boolean(item.type));
}

export function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function cleanUrl(url: string): string {
  return (url.split("?")[0] ?? url)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

type StringablePrimitive = string | number | boolean | bigint | symbol;

export function safeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") {
    return String(value as StringablePrimitive);
  }
  if (value instanceof Error) {
    return formatUserError(value);
  }
  try {
    const json = JSON.stringify(value);
    return json ?? "";
  } catch {
    return "";
  }
}

export function getTrustTierLabel(score: number): string {
  if (score <= 450) return "Flagged";
  if (score <= 600) return "Limited";
  if (score <= 750) return "Normal";
  if (score <= 850) return "Trusted";
  return "Elite";
}

export {
  formatUserError,
  getUserFriendlyErrorMessage,
  USER_SUCCESS_MESSAGES,
  type UserActionType,
  type UserMessageResult,
} from "./user-messages";
