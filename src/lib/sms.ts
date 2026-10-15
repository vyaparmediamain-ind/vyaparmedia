import { AppError } from "@/lib/errors";
/**
* Phone OTP delivery and verification.
*
* WhatsApp is attempted first when configured, then SMS is used as fallback.
* OTP verification is provider-independent: only a keyed hash is stored in Redis.
*/

import { randomInt, timingSafeEqual, createHmac, randomUUID } from "node:crypto";
import { redis } from "./redis";
import { logger } from "./logger";
import { sendSMS } from "./communication";
import { env } from "@/env";
import {
  AUTH_OTP_EXPIRY_SECONDS,
  MAX_OTP_VERIFICATION_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  SMS_GATEWAY_TIMEOUT_MS,
} from "@/constants";

import { isKillSwitchActive } from "./kill-switch";

const OTP_TTL_SECONDS = AUTH_OTP_EXPIRY_SECONDS;
const OTP_MAX_ATTEMPTS = MAX_OTP_VERIFICATION_ATTEMPTS;

type OtpPurpose =
| "registration"
| "phone_verification"
| "login"
| "password_reset"
| (string & {});

type OtpChannel = "whatsapp" | "sms" | "dev";

interface SendOTPOptions {
purpose?: OtpPurpose;
}

interface VerifyOTPOptions {
purpose?: OtpPurpose;
}

interface SendOTPResult {
success: boolean;
requestId?: string;
channel?: OtpChannel;
fallbackUsed?: boolean;
retryAfterSeconds?: number;
error?: string;
otp?: string;
}

interface VerifyOTPResult {
success: boolean;
error?: string;
}

interface StoredOtp {
hash: string;
attempts: number;
createdAt: string;
deliveredVia: OtpChannel;
fallbackUsed: boolean;
}

function otpSecret() {
return (
env.OTP_HASH_SECRET ||
env.NEXTAUTH_SECRET ||
process.env.AUTH_SECRET ||
"local-otp-development-secret"
);
}

function isDevLike() {
return env.NODE_ENV === "development" || env.NODE_ENV === "test";
}

export function normalizeIndianPhone(phone: string): string | null {
  if (!phone || typeof phone !== "string") return null;
  const trimmed = phone.trim();
  // Strictly reject non-Indian country codes (e.g. +1, +44, +86, etc.) to prevent toll fraud
  if (trimmed.startsWith("+") && !trimmed.startsWith("+91")) {
    return null;
  }
  const digits = trimmed.replace(/\D/g, "");
  const withoutCountryCode =
    digits.startsWith("91") && digits.length === 12
      ? digits.slice(2)
      : digits;

  if (!/^[6-9]\d{9}$/.test(withoutCountryCode)) return null;
  return withoutCountryCode;
}

function e164IndianPhone(phone: string) {
const normalized = normalizeIndianPhone(phone);
return normalized ? `+91${normalized}` : null;
}

function otpKey(phone: string, purpose: OtpPurpose) {
const normalized = normalizeIndianPhone(phone);
if (!normalized) throw AppError.badRequest("Invalid Indian phone number");
return `phone-otp:${purpose}:${normalized}`;
}

function hashOtp(phone: string, purpose: OtpPurpose, otp: string) {
const normalized = normalizeIndianPhone(phone);
if (!normalized) throw AppError.badRequest("Invalid Indian phone number");
return createHmac("sha256", otpSecret())
.update(`${purpose}:${normalized}:${otp}`)
.digest("hex");
}

function safeEqualHex(a: string, b: string) {
  if (!a || !b) return false;
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function otpMessage(otp: string) {
return `${otp} is your VyaparMedia verification code. It expires in 10 minutes. Do not share it with anyone.`;
}

import { withCircuitBreaker } from "./circuit-breaker";

async function sendViaTwilioWhatsApp(phone: string, message: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN || env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM || env.TWILIO_WHATSAPP_FROM;
  const to = e164IndianPhone(phone);

  if (!accountSid || !authToken || !from || !to) return false;

  const body = new URLSearchParams({
    From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    To: `whatsapp:${to}`,
    Body: message,
  });

  const credentials = `${accountSid}:${authToken}`;
  const authHeader = `Basic ${Buffer.from(credentials).toString("base64")}`;

  try {
    return await withCircuitBreaker("twilio:whatsapp", async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SMS_GATEWAY_TIMEOUT_MS);

      try {
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body,
            signal: controller.signal,
          },
        );
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          logger.warn("Twilio WhatsApp OTP delivery failed", {
            status: response.status,
            response: errText,
          });
          if (response.status >= 500) {
            throw new Error(`Twilio server error (${response.status}): ${errText}`);
          }
          return false;
        }

        return true;
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        throw fetchErr;
      }
    });
  } catch (err: unknown) {
    if (err instanceof AppError && err.message.includes("Circuit is OPEN")) {
      logger.warn("[CircuitBreaker] Twilio WhatsApp circuit is OPEN. Fast failing.");
      return false;
    }
    logger.warn("Twilio WhatsApp OTP request failed or timed out", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

async function sendViaMetaWhatsApp(phone: string, otp: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || env.WHATSAPP_ACCESS_TOKEN;
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME || env.WHATSAPP_OTP_TEMPLATE_NAME;
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANGUAGE || env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US";
  const to = e164IndianPhone(phone)?.replace("+", "");

  if (!phoneNumberId || !accessToken || !templateName || !to) return false;

  try {
    return await withCircuitBreaker("meta:whatsapp", async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SMS_GATEWAY_TIMEOUT_MS);

      try {
        const response = await fetch(
          `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to,
              type: "template",
              template: {
                name: templateName,
                language: { code: languageCode },
                components: [
                  {
                    type: "body",
                    parameters: [{ type: "text", text: otp }],
                  },
                ],
              },
            }),
            signal: controller.signal,
          },
        );
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          logger.warn("Meta WhatsApp OTP delivery failed", {
            status: response.status,
            response: errText,
          });
          if (response.status >= 500) {
            throw new Error(`Meta WhatsApp server error (${response.status}): ${errText}`);
          }
          return false;
        }

        return true;
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        throw fetchErr;
      }
    });
  } catch (err: unknown) {
    if (err instanceof AppError && err.message.includes("Circuit is OPEN")) {
      logger.warn("[CircuitBreaker] Meta WhatsApp circuit is OPEN. Fast failing.");
      return false;
    }
    logger.warn("Meta WhatsApp OTP request failed or timed out", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

async function sendWhatsAppOtp(phone: string, otp: string) {
  const message = otpMessage(otp);
  const provider = (process.env.WHATSAPP_PROVIDER || env.WHATSAPP_PROVIDER || "auto").toLowerCase();

  // Primary: Meta Cloud API
  if (provider === "meta" || provider === "auto") {
    if (await sendViaMetaWhatsApp(phone, otp)) return true;
  }

  // Secondary Fallback: Twilio WhatsApp
  if (provider === "twilio" || provider === "auto") {
    if (await sendViaTwilioWhatsApp(phone, message)) return true;
  }

  // Dev fallback only when no live provider configured
  const hasMetaConfig = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID || env.WHATSAPP_PHONE_NUMBER_ID);
  const hasTwilioConfig = Boolean(process.env.TWILIO_ACCOUNT_SID || env.TWILIO_ACCOUNT_SID);
  if (!hasMetaConfig && !hasTwilioConfig && isDevLike()) {
    logger.info("DEV WhatsApp OTP", { phone, otp });
    return true;
  }

  return false;
}

const DEFAULT_DAILY_SMS_CAP = 1000;

export async function checkAndIncrementDailySmsCap(maxLimit = DEFAULT_DAILY_SMS_CAP): Promise<boolean> {
  const dateStr = new Date().toISOString().slice(0, 10);
  const key = `sms:daily_cap:${dateStr}`;

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, 86400 * 2);
    }

    if (current > maxLimit) {
      logger.error("[SMS ABUSE GUARD] Daily SMS limit exceeded! Potential toll-fraud pumping attack blocked.", {
        current,
        maxLimit,
        date: dateStr,
      });
      return false;
    }

    if (current >= Math.floor(maxLimit * 0.8)) {
      logger.warn("[SMS USAGE WARNING] Daily SMS volume reached 80% threshold.", {
        current,
        maxLimit,
        date: dateStr,
      });
    }

    return true;
  } catch (err) {
    logger.warn("[SMS ABUSE GUARD] Failed to check daily SMS cap in Redis, failing open.", {
      error: err instanceof Error ? err.message : String(err),
    });
    return true;
  }
}

async function sendSmsOtp(phone: string, otp: string) {
  const withinCap = await checkAndIncrementDailySmsCap();
  if (!withinCap) {
    logger.warn("Daily SMS cap reached. Rejecting SMS OTP delivery to prevent toll fraud.");
    return false;
  }

  const hasSmsConfig = Boolean(process.env.MSG91_AUTH_KEY || env.MSG91_AUTH_KEY || env.SMS_API_KEY);
  if (hasSmsConfig) {
    return await sendSMS(phone, otpMessage(otp));
  }

  const sent = await sendSMS(phone, otpMessage(otp));
  if (sent) return true;

  if (isDevLike() && !hasSmsConfig) {
    logger.info("DEV SMS OTP", { phone, otp });
    return true;
  }

  return false;
}

async function storeOtp(
phone: string,
purpose: OtpPurpose,
otp: string,
deliveredVia: OtpChannel,
fallbackUsed: boolean,
) {
const payload: StoredOtp = {
hash: hashOtp(phone, purpose, otp),
attempts: 0,
createdAt: new Date().toISOString(),
deliveredVia,
fallbackUsed,
};

await redis.setex(otpKey(phone, purpose), OTP_TTL_SECONDS, JSON.stringify(payload));
}

/**
* Send OTP via WhatsApp first and SMS fallback second.
*/
type SendOtpOptionsParam = SendOTPOptions | OtpPurpose;
type VerifyOtpOptionsParam = VerifyOTPOptions | OtpPurpose;

async function deliverOtpInternal(
normalized: string,
otp: string,
preferWhatsApp: boolean,
allowSmsFallback: boolean
): Promise<{ channel: OtpChannel | null; fallbackUsed: boolean }> {
let channel: OtpChannel | null = null;
let fallbackUsed = false;

if (preferWhatsApp) {
const whatsappSent = await sendWhatsAppOtp(normalized, otp);
if (whatsappSent) {
channel = "whatsapp";
}
}

if (!channel && allowSmsFallback) {
const smsSent = await sendSmsOtp(normalized, otp);
if (smsSent) {
channel = isDevLike() && !env.MSG91_AUTH_KEY ? "dev" : "sms";
fallbackUsed = preferWhatsApp;
}
}

return { channel, fallbackUsed };
}

/**
* Send OTP via WhatsApp first and SMS fallback second.
*/
export async function sendOTP(
phone: string,
options: SendOtpOptionsParam = {},
): Promise<SendOTPResult> {
const purpose =
typeof options === "string" ? options : options.purpose || "phone_verification";
const normalized = normalizeIndianPhone(phone);
if (!normalized) {
return { success: false, error: "Invalid Indian phone number" };
}

// Operational Kill Switch check for emergency toll fraud / spam shutdown
if (await isKillSwitchActive("killswitch:otp")) {
  logger.warn("OTP delivery blocked by operational kill switch: killswitch:otp");
  return {
    success: false,
    error: "OTP bhejne me dikkat aayi. 60 second baad dobara try karein",
  };
}

const key = otpKey(normalized, purpose);
const ttl = await redis.ttl(key);
if (ttl > OTP_TTL_SECONDS - OTP_RESEND_COOLDOWN_SECONDS) {
return {
success: false,
retryAfterSeconds: ttl - (OTP_TTL_SECONDS - OTP_RESEND_COOLDOWN_SECONDS),
error: "OTP recently sent. Please wait before requesting another code.",
};
}

const otp = randomInt(100000, 1000000).toString();
const preferWhatsApp = env.OTP_PRIMARY_CHANNEL !== "sms";
const allowSmsFallback = env.OTP_SMS_FALLBACK;

try {
const { channel, fallbackUsed } = await deliverOtpInternal(
normalized,
otp,
preferWhatsApp,
allowSmsFallback
);

if (!channel) {
return {
success: false,
error: "OTP bhejne me dikkat aayi. 60 second baad dobara try karein",
};
}

await storeOtp(normalized, purpose, otp, channel, fallbackUsed);
return {
success: true,
requestId: randomUUID(),
channel,
fallbackUsed,
...(isDevLike() ? { otp } : {}),
};
} catch (error) {
logger.error("Phone OTP delivery failed", error, { phone: normalized, purpose });
return { success: false, error: "OTP bhejne me dikkat aayi. 60 second baad dobara try karein" };
}
}

/**
* Verify the provider-independent Redis OTP hash.
*/
export async function verifyOTP(
phone: string,
otp: string,
options: VerifyOtpOptionsParam = {},
): Promise<VerifyOTPResult> {
const purpose =
typeof options === "string" ? options : options.purpose || "phone_verification";
const normalized = normalizeIndianPhone(phone);
if (!normalized || !/^\d{6}$/.test(otp)) {
return { success: false, error: "Invalid OTP" };
}

const key = otpKey(normalized, purpose);
const raw = await redis.get(key);
if (!raw) {
return { success: false, error: "OTP not found or expired" };
}

let stored: StoredOtp;
try {
stored = JSON.parse(raw) as StoredOtp;
} catch {
await redis.del(key);
return { success: false, error: "OTP not found or expired" };
}

  const attemptsKey = `${key}:attempts`;
  const attempts = await redis.incr(attemptsKey);
  if (attempts === 1) {
    await redis.expire(attemptsKey, OTP_TTL_SECONDS);
  }

  if (attempts > OTP_MAX_ATTEMPTS) {
    await redis.del(key);
    await redis.del(attemptsKey);
    return { success: false, error: "Maximum attempts exceeded" };
  }

  const cleanOtp = String(otp ?? "").trim();
  const submittedHash = hashOtp(normalized, purpose, cleanOtp);
  const isValid = safeEqualHex(stored.hash, submittedHash);
  if (!isValid) {
    return { success: false, error: "Invalid OTP" };
  }

  await Promise.allSettled([
    redis.del(key),
    redis.del(attemptsKey),
  ]);
  logger.info("Phone OTP verified", {
    phone: normalized,
    purpose,
    deliveredVia: stored.deliveredVia,
    fallbackUsed: stored.fallbackUsed,
  });

  return { success: true };
}
