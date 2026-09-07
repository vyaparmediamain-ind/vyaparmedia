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

const OTP_TTL_SECONDS = 10 * 60;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

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
process.env.OTP_HASH_SECRET ||
process.env.NEXTAUTH_SECRET ||
process.env.AUTH_SECRET ||
"local-otp-development-secret"
);
}

function isDevLike() {
return process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
}

export function normalizeIndianPhone(phone: string): string | null {
const digits = phone.replace(/\D/g, "");
const withoutCountryCode = digits.startsWith("91") && digits.length === 12
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

async function sendViaTwilioWhatsApp(phone: string, message: string) {
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_WHATSAPP_FROM;
const to = e164IndianPhone(phone);

if (!accountSid || !authToken || !from || !to) return false;

const body = new URLSearchParams({
From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
To: `whatsapp:${to}`,
Body: message,
});

const credentials = `${accountSid}:${authToken}`;
const authHeader = `Basic ${Buffer.from(credentials).toString("base64")}`;

const response = await fetch(
`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
{
method: "POST",
headers: {
Authorization: authHeader,
"Content-Type": "application/x-www-form-urlencoded",
},
body,
},
);

if (!response.ok) {
logger.warn("Twilio WhatsApp OTP delivery failed", {
status: response.status,
response: await response.text().catch(() => ""),
});
}

return response.ok;
}

async function sendViaMetaWhatsApp(phone: string, otp: string) {
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME;
const languageCode = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US";
const to = e164IndianPhone(phone)?.replace("+", "");

if (!phoneNumberId || !accessToken || !templateName || !to) return false;

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
},
);

if (!response.ok) {
logger.warn("Meta WhatsApp OTP delivery failed", {
status: response.status,
response: await response.text().catch(() => ""),
});
}

return response.ok;
}

async function sendWhatsAppOtp(phone: string, otp: string) {
const message = otpMessage(otp);
const provider = (process.env.WHATSAPP_PROVIDER || "auto").toLowerCase();

if (provider === "twilio" || provider === "auto") {
if (await sendViaTwilioWhatsApp(phone, message)) return true;
}

if (provider === "meta" || provider === "auto") {
if (await sendViaMetaWhatsApp(phone, otp)) return true;
}

if (isDevLike()) {
logger.info("DEV WhatsApp OTP", { phone, otp });
return true;
}

return false;
}

async function sendSmsOtp(phone: string, otp: string) {
const sent = await sendSMS(phone, otpMessage(otp));
if (sent) return true;

if (isDevLike()) {
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
channel = isDevLike() && !process.env.MSG91_AUTH_KEY ? "dev" : "sms";
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

const key = otpKey(normalized, purpose);
const ttl = await redis.ttl(key);
if (ttl > OTP_TTL_SECONDS - OTP_RESEND_COOLDOWN_SECONDS) {
return {
success: false,
retryAfterSeconds: ttl - (OTP_TTL_SECONDS - OTP_RESEND_COOLDOWN_SECONDS),
error: "OTP recently sent. Please wait before requesting another code.",
};
}

const otp = randomInt(100000, 999999).toString();
const preferWhatsApp = process.env.OTP_PRIMARY_CHANNEL !== "sms";
const allowSmsFallback = process.env.OTP_SMS_FALLBACK !== "false";

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
error: "OTP delivery service unavailable",
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
return { success: false, error: "OTP delivery service unavailable" };
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

if (stored.attempts >= OTP_MAX_ATTEMPTS) {
await redis.del(key);
return { success: false, error: "Maximum attempts exceeded" };
}

  const cleanOtp = String(otp ?? "").trim();
  const submittedHash = hashOtp(normalized, purpose, cleanOtp);
  const isValid = safeEqualHex(stored.hash, submittedHash);
if (!isValid) {
const ttl = await redis.ttl(key);
if (ttl > 0) {
await redis.setex(
key,
ttl,
JSON.stringify({ ...stored, attempts: stored.attempts + 1 }),
);
}
return { success: false, error: "Invalid OTP" };
}

await redis.del(key);
logger.info("Phone OTP verified", {
phone: normalized,
purpose,
deliveredVia: stored.deliveredVia,
fallbackUsed: stored.fallbackUsed,
});

return { success: true };
}
