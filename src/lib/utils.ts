import { AppError } from "@/lib/errors";
import "server-only";

import { randomInt } from "node:crypto";
import { env } from "@/env";
import prisma from "@/lib/db";
import { z } from "zod";

export * from "@/lib/utils-client";

export function generateOTP(): string {
return randomInt(100000, 999999).toString();
}

export function generateReferralCode(prefix: string = ""): string {
const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const cleanPrefix = prefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2);
const suffixLength = 10 - cleanPrefix.length;
let suffix = "";
for (let i = 0; i < suffixLength; i++) {
suffix += chars.charAt(randomInt(0, chars.length));
}
return `${cleanPrefix}${suffix}`;
}

export function calculateProductHandlingFee(
productValue: number | null,
requiresProduct: boolean,
isProductOnly: boolean,
platformFeePercent?: number,
) {
if (!requiresProduct || !productValue) return 0;
if (isProductOnly) {
const feePercent = platformFeePercent ?? env.PLATFORM_FEE_PERCENTAGE;
return Math.max(0, Math.round((productValue * feePercent) / 100));
}
return Math.max(0, Math.round(productValue * 0.02));
}

export async function getDealAndVerifyParticipant(dealId: string, userId: string) {
const deal = await prisma.deal.findUnique({
where: { id: dealId },
include: {
influencer: { select: { userId: true } },
brand: { select: { userId: true } },
},
});
if (!deal) throw AppError.notFound("Deal not found");
const participants = [deal.influencer.userId, deal.brand?.userId].filter(Boolean) as string[];
if (!participants.includes(userId)) throw AppError.forbidden("Unauthorized");
return deal;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof (error as Record<string, unknown>).message === "string") {
      return (error as Record<string, unknown>).message as string;
    }
  }
  try {
    const str = JSON.stringify(error);
    return str === "{}" ? String(error) : str;
  } catch {
    return String(error);
  }
}

export const notificationPreferencesSchema = z.object({
email: z.object({
marketing: z.boolean().default(true),
updates: z.boolean().default(true),
security: z.boolean().default(true),
}).default({ marketing: true, updates: true, security: true }),
push: z.object({
marketing: z.boolean().default(true),
updates: z.boolean().default(true),
security: z.boolean().default(true),
}).default({ marketing: true, updates: true, security: true }),
}).default({
email: { marketing: true, updates: true, security: true },
push: { marketing: true, updates: true, security: true },
});

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export function parseNotificationPreferences(prefs: unknown): NotificationPreferences {
if (!prefs) {
return {
email: { marketing: true, updates: true, security: true },
push: { marketing: true, updates: true, security: true },
};
}
let parsed = prefs;
if (typeof prefs === "string") {
try {
parsed = JSON.parse(prefs);
} catch {
// ignore
}
}
const result = notificationPreferencesSchema.safeParse(parsed);
if (result.success) {
return result.data;
}
  return {
    email: { marketing: true, updates: true, security: true },
    push: { marketing: true, updates: true, security: true },
  };
}

export function bytesToAscii(bytes: Uint8Array): string {
  return String.fromCodePoint(...bytes);
}

export function matchesHeader(bytes: Uint8Array, pattern: number[]): boolean {
  if (bytes.length < pattern.length) return false;
  return pattern.every((val, i) => bytes[i] === val);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

