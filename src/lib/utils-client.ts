import { AppError } from "@/lib/errors";

export function formatCurrency(amountInPaise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountInPaise / 100);
}

export function formatNumber(num: number): string {
  if (num >= 10000000) return (num / 10000000).toFixed(1) + "Cr";
  if (num >= 100000) return (num / 100000).toFixed(1) + "L";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "Not specified";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Not specified";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
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
    return value.message;
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
