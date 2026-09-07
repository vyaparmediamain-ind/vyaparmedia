/**
* Enterprise Email Service VyaparMedia
*
* Handles all transactional emails via Resend API.
* (3,000 emails/month free tier better than SendGrid's 100/day)
*
* ENTERPRISE FEATURES:
* Retry with exponential backoff (3 attempts)
* Email input sanitization (XSS prevention in templates)
* Structured error logging with correlation IDs
* Configurable timeouts (AbortController)
* Reply-To header support
* Plain-text fallback for every email (accessibility + spam score)
* Consistent branded HTML wrapper (DRY)
* Rate-limit aware error handling (429 from Resend)
* Dev-mode fallback: logs email to console instead of failing
* Tags for analytics and filtering
*
* Required env: RESEND_API_KEY, FROM_EMAIL (optional)
*/

import { logger } from "./logger";
import { escapeHtml, sleep } from "./utils";

import DOMPurify from "isomorphic-dompurify";
import { randomUUID } from "node:crypto";
import { env } from "@/env";

// ==================== CONFIG ====================

const APP_NAME = "VyaparMedia";
const RESEND_API_URL = "https://api.resend.com/emails";
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000; // 1s, 2s, 4s
const REQUEST_TIMEOUT_MS = 15_000; // 15 seconds

function getResendApiKey(): string {
return process.env.RESEND_API_KEY || "";
}

function getFromEmail(): string {
return process.env.FROM_EMAIL || "noreply@vyaparmedia.in";
}

function getReplyToEmail(): string {
return env.REPLY_TO_EMAIL;
}

function getAppUrl(): string {
return process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

// ==================== TYPES ====================

interface EmailParams {
to: string;
subject: string;
html: string;
text?: string;
replyTo?: string;
tags?: Array<{ name: string; value: string }>;
}

interface EmailResult {
success: boolean;
messageId?: string;
error?: string;
correlationId: string;
}

// ==================== BRANDED HTML WRAPPER ====================

/**
* Wraps email body content in a consistent, branded HTML shell.
* Includes preheader text for email client preview, responsive container,
* footer with unsubscribe hint, and dark-mode friendly styles.
*/
function wrapInBrandedTemplate(bodyHtml: string, preheaderText?: string): string {
return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${APP_NAME}</title>
<!--[if mso]>
<style>
table { border-collapse: collapse; }
.fallback-font { font-family: Arial, sans-serif; }
</style>
<![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
${preheaderText ? `<div style="display:none;font-size:1px;color:#f4f4f7;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${escapeHtml(preheaderText)}</div>` : ""}

<!-- Email Container -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f7;">
<tr>
<td align="center" style="padding: 40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: #ffffff; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); overflow: hidden;">

<!-- Header -->
<tr>
<td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 28px 32px; text-align: center;">
<h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 0;">
${APP_NAME}
</h1>
<p style="margin: 4px 0 0; color: rgba(255,255,255,0.8); font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase;">
Where Brands & Creators Build Trusted Business.
</p>
</td>
</tr>

<!-- Body -->
<tr>
<td style="padding: 32px; color: #333333; font-size: 15px; line-height: 1.7;">
${bodyHtml}
</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding: 20px 32px; background: #fafafa; border-t border-card: 1px solid #eee; text-align: center;">
<p style="margin: 0; color: #999; font-size: 12px; line-height: 1.6;">
 ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.<br>
This is an automated message. Please do not reply directly.
</p>
<p style="margin: 8px 0 0; color: #bbb; font-size: 11px;">
<a href="${getAppUrl()}/privacy" style="color: #6366f1; text-decoration: none;">Privacy Policy</a>
&nbsp;&nbsp;
<a href="${getAppUrl()}/terms" style="color: #6366f1; text-decoration: none;">Terms of Service</a>
</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`.trim();
}

// ==================== CORE SEND (with retry + timeout) ====================

/**
* Core email sender with enterprise guarantees:
* - Exponential backoff retry (up to 3 attempts)
* - AbortController timeout (15s per attempt)
* - Structured logging with correlation ID
* - Dev-mode fallback (logs instead of sending)
*
* Resend API Docs: https://resend.com/docs/api-reference/emails/send-email
*/
function stripHtmlTags(html: string): string {
let result = "";
let inTag = false;
for (const char of html) {
if (char === "<") {
inTag = true;
} else if (char === ">") {
inTag = false;
} else if (!inTag) {
result += char;
}
}
return result;
}

function buildEmailPayload(params: EmailParams): Record<string, unknown> {
const payload: Record<string, unknown> = {
from: `${APP_NAME} <${getFromEmail()}>`,
to: [params.to],
subject: params.subject,
html: params.html,
reply_to: params.replyTo || getReplyToEmail(),
};

// Always include plain-text (improves deliverability + spam score)
if (params.text) {
payload.text = params.text;
} else {
payload.text = stripHtmlTags(params.html).replace(/\s+/g, " ").trim();
}

// Resend supports tags for analytics
if (params.tags?.length) {
payload.tags = params.tags;
}

return payload;
}

async function performSendAttempt(
payload: Record<string, unknown>,
attempt: number,
log: ReturnType<typeof logger.withContext>,
): Promise<{ success: boolean; retry?: boolean; retryAfter?: number; error?: string; messageId?: string | undefined }> {
try {
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

const res = await fetch(RESEND_API_URL, {
method: "POST",
headers: {
Authorization: `Bearer ${getResendApiKey()}`,
"Content-Type": "application/json",
},
body: JSON.stringify(payload),
signal: controller.signal,
});

clearTimeout(timeoutId);

// Resend returns 200 with { id: "..." } on success
if (res.ok) {
const data = (await res.json()) as { id?: string };
log.info("Email sent successfully via Resend", {
attempt,
messageId: data.id,
});
return { success: true, messageId: data.id };
}

// 429 = Rate limited by Resend
if (res.status === 429) {
const retryAfter = Number.parseInt(res.headers.get("retry-after") || "5", 10);
log.warn(`Resend rate limit hit (429). Waiting ${retryAfter}s before retry.`, {
attempt,
});
return { success: false, retry: true, retryAfter };
}

// 4xx (except 429) = client error, don't retry
if (res.status >= 400 && res.status < 500) {
const errorBody = await res.json().catch(() => ({})) as { message?: string };
log.error("Resend rejected email (4xx not retryable)", {
status: res.status,
error: errorBody.message || "Unknown error",
attempt,
});
return {
success: false,
retry: false,
error: `Resend error ${res.status}: ${errorBody.message || "Unknown"}`,
};
}

// 5xx = server error, retry
const errorBody = await res.text();
log.warn(`Resend server error (${res.status}). Attempt ${attempt}/${MAX_RETRIES}`, {
error: errorBody,
});
return { success: false, retry: true };
} catch (err: unknown) {
const errName = err instanceof Error ? err.name : "Error";
if (errName === "AbortError") {
log.warn(`Email send timed out after ${REQUEST_TIMEOUT_MS}ms. Attempt ${attempt}/${MAX_RETRIES}`);
} else {
log.error(`Network error sending email. Attempt ${attempt}/${MAX_RETRIES}`, err);
}
return { success: false, retry: true };
}
}

async function sendEmail(params: EmailParams): Promise<EmailResult> {
const correlationId = randomUUID().slice(0, 8);
const log = logger.withContext({ correlationId, emailTo: params.to });

// Dev fallback
if (!getResendApiKey()) {
if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
log.info("DEV EMAIL Resend key not set, logging instead", {
subject: params.subject,
to: params.to,
});
log.debug("Email text body (for Dev Mock review)", {
textBody: params.text || "No text body provided",
});
return { success: true, correlationId };
}
log.error(
"CRITICAL: RESEND_API_KEY is not configured. Transactional emails CANNOT be delivered in production.",
);
return {
success: false,
error: "Email service not configured",
correlationId,
};
}

// Build Resend payload
const payload = buildEmailPayload(params);

// Retry loop with exponential backoff
for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
const attemptResult = await performSendAttempt(payload, attempt, log);

if (attemptResult.success) {
return {
success: true,
...(attemptResult.messageId ? { messageId: attemptResult.messageId } : {}),
correlationId,
};
}

if (attemptResult.retry === false) {
return {
success: false,
error: attemptResult.error || "Email delivery failed (non-retryable error)",
correlationId,
};
}

if (attemptResult.retryAfter) {
await sleep(attemptResult.retryAfter * 1000);
continue;
}

// Exponential backoff: 1s, 2s, 4s
if (attempt < MAX_RETRIES) {
const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
await sleep(delay);
}
}

log.error("Email delivery FAILED after all retries", {
subject: params.subject,
maxRetries: MAX_RETRIES,
});
return {
success: false,
error: "Email delivery failed after retries",
correlationId,
};
}

// ==================== EMAIL TEMPLATES ====================

/**
* OTP Verification Email
*/
export async function sendVerificationEmail(
to: string,
otp: string,
): Promise<boolean> {
const safeOtp = escapeHtml(otp);
const result = await sendEmail({
to,
subject: `${APP_NAME} Verify Your Email`,
html: wrapInBrandedTemplate(
`
<h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #1f2937;">Verify Your Email</h2>
<p style="color: #666; margin: 0 0 24px;">Enter this code to complete your verification:</p>

<div style="background: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px; border: 2px dashed #d1d5db;">
<span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1f2937; font-family: 'Courier New', monospace;">${safeOtp}</span>
</div>

<div style="background: #fef3c7; border-radius: 8px; padding: 12px 16px; margin: 0 0 16px; border-l: 4px solid #f59e0b;">
<p style="margin: 0; font-size: 13px; color: #92400e;">
This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
</p>
</div>

<p style="color: #999; font-size: 12px; margin: 0;">
If you didn't request this code, you can safely ignore this email. Your account is secure.
</p>
`,
`Your ${APP_NAME} verification code is: ${safeOtp}`,
),
text: `Your ${APP_NAME} verification code is: ${otp}. This code expires in 10 minutes. Do not share it with anyone.`,
tags: [
{ name: "category", value: "verification" },
{ name: "type", value: "otp" },
],
});
return result.success;
}

/**
* Password Reset Email
*/
export async function sendPasswordResetEmail(
to: string,
resetToken: string,
): Promise<boolean> {
const resetUrl = `${getAppUrl()}/reset-password?token=${resetToken}`;
const result = await sendEmail({
to,
subject: `${APP_NAME} Reset Your Password`,
html: wrapInBrandedTemplate(
`
<h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #1f2937;">Password Reset</h2>
<p style="color: #666; margin: 0 0 24px;">We received a request to reset your password. Click the button below to set a new one:</p>

<div style="text-align: center; margin: 0 0 24px;">
<a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #10b981 100%); color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
Reset Password
</a>
</div>

<div style="background: #fef2f2; border-radius: 8px; padding: 12px 16px; margin: 0 0 16px; border-l: 4px solid #ef4444;">
<p style="margin: 0; font-size: 13px; color: #991b1b;">
This link expires in <strong>1 hour</strong>. If you didn't request this reset, please ignore this email or contact support immediately.
</p>
</div>

<p style="color: #999; font-size: 12px; margin: 0; word-break: break-all;">
Can't click the button? Copy this link:<br>
<a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
</p>
`,
"Reset your password link expires in 1 hour",
),
text: `You requested a password reset for your ${APP_NAME} account. Visit this link to reset your password: ${resetUrl} This link expires in 1 hour. If you didn't request this, please ignore this email.`,
tags: [
{ name: "category", value: "auth" },
{ name: "type", value: "password-reset" },
],
});
return result.success;
}

/**
* Welcome Email
*/
export async function sendWelcomeEmail(
to: string,
name: string,
): Promise<boolean> {
const safeName = escapeHtml(name);
const result = await sendEmail({
to,
subject: `Welcome to ${APP_NAME}! `,
html: wrapInBrandedTemplate(
`
<h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #1f2937;">Welcome, ${safeName}! </h2>
<p style="color: #666; margin: 0 0 24px;">Your account has been created successfully. Here's how to get started:</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
${[
{ icon: "👤", step: "Complete your profile" },
{ icon: "📝", step: "Upload verification documents" },
{ icon: "💡", step: "Start exploring campaigns" },
]
.map(
(s) => `
<tr>
<td style="padding: 10px 0; border-b: 1px solid #f3f4f6;">
<span style="font-size: 16px; margin-right: 12px;">${s.icon}</span>
<span style="color: #374151; font-size: 14px;">${s.step}</span>
</td>
</tr>`,
)
.join("")}
</table>

<div style="text-align: center; margin: 0 0 16px;">
<a href="${getAppUrl()}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(99,102,241,0.3);">
Go to Dashboard
</a>
</div>
`,
`Welcome to ${APP_NAME}, ${safeName}! Get started now.`,
),
text: `Welcome to ${APP_NAME}, ${name}! Your account is ready. Visit ${getAppUrl()}/dashboard to get started. Steps: 1) Complete your profile, 2) Upload verification documents, 3) Start exploring campaigns.`,
tags: [
{ name: "category", value: "onboarding" },
{ name: "type", value: "welcome" },
],
});
return result.success;
}

/**
* Deal Notification Email
*/
export async function sendDealNotificationEmail(
to: string,
dealTitle: string,
message: string,
): Promise<boolean> {
const safeTitle = escapeHtml(dealTitle);
const safeMessage = escapeHtml(message);
const result = await sendEmail({
to,
subject: `${APP_NAME} Deal Update: ${dealTitle}`,
html: wrapInBrandedTemplate(
`
<h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #1f2937;">Deal Update</h2>

<div style="background: #f3f4f6; border-radius: 12px; padding: 16px 20px; margin: 0 0 16px; border-l: 4px solid #6366f1;">
<p style="margin: 0 0 4px; font-weight: 700; color: #1f2937; font-size: 16px;">${safeTitle}</p>
<p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6;">${safeMessage}</p>
</div>

<div style="text-align: center; margin: 24px 0 0;">
<a href="${getAppUrl()}/dashboard/deals" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #10b981 100%); color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
View Deal
</a>
</div>
`,
`Deal update for "${dealTitle}": ${message}`,
),
text: `Deal Update "${dealTitle}": ${message}. View your deal at ${getAppUrl()}/dashboard/deals`,
tags: [
{ name: "category", value: "deals" },
{ name: "type", value: "notification" },
],
});
return result.success;
}

/**
* Withdrawal Status Email
*/
export async function sendWithdrawalEmail(
to: string,
amount: number,
status: "success" | "failed",
): Promise<boolean> {
const amountStr = `${(amount / 100).toLocaleString("en-IN")}`;
const isSuccess = status === "success";

const result = await sendEmail({
to,
subject: `${APP_NAME} Withdrawal ${isSuccess ? "Successful " : "Failed "}`,
html: wrapInBrandedTemplate(
`
<h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #1f2937;">
Withdrawal ${isSuccess ? "Successful " : "Failed "}
</h2>

<div style="background: ${isSuccess ? "#ecfdf5" : "#fef2f2"}; border-radius: 12px; padding: 20px; margin: 0 0 16px; border-l: 4px solid ${isSuccess ? "#10b981" : "#ef4444"}; text-align: center;">
<p style="margin: 0 0 4px; font-size: 28px; font-weight: 800; color: ${isSuccess ? "#065f46" : "#991b1b"};">
${amountStr}
</p>
<p style="margin: 0; color: ${isSuccess ? "#047857" : "#b91c1c"}; font-size: 14px;">
${isSuccess ? "Processed funds will reach your bank within 24 hours." : "Could not be processed. Amount has been refunded to your wallet."}
</p>
</div>

<div style="text-align: center; margin: 16px 0 0;">
<a href="${getAppUrl()}/dashboard/wallet" style="display: inline-block; background: #f3f4f6; color: #374151; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; border: 1px solid #d1d5db;">
View Wallet
</a>
</div>
`,
`Withdrawal of ${amountStr} ${isSuccess ? "was successful" : "has failed"}`,
),
text: `Your withdrawal of ${amountStr} ${isSuccess ? "has been processed and will reach your bank within 24 hours." : "could not be processed. The amount has been refunded to your wallet."} View your wallet at ${getAppUrl()}/dashboard/wallet`,
tags: [
{ name: "category", value: "payments" },
{ name: "type", value: "withdrawal" },
],
});
return result.success;
}

/**
* Send Blog Verification Email
*/
export async function sendBlogVerificationEmail(
to: string,
token: string,
): Promise<boolean> {
const appUrl = getAppUrl();
const verifyUrl = `${appUrl}/api/blog/verify?token=${encodeURIComponent(token)}`;
const unsubscribeUrl = `${appUrl}/api/blog/unsubscribe?token=${encodeURIComponent(token)}`;

const result = await sendEmail({
to,
subject: `Confirm Your Subscription to ${APP_NAME} Blog`,
html: wrapInBrandedTemplate(
`
<h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #1f2937;">Confirm Your Subscription</h2>
<p style="color: #666; margin: 0 0 24px;">Thank you for subscribing to our blog! Click the button below to confirm your subscription:</p>

<div style="text-align: center; margin: 0 0 24px;">
<a href="${verifyUrl}" style="background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Confirm Subscription</a>
</div>

<p style="color: #999; font-size: 12px; margin: 0 0 16px;">
If the button doesn't work, copy and paste this URL into your browser: <br/>
<a href="${verifyUrl}" style="color: #4f46e5;">${verifyUrl}</a>
</p>

<hr style="border: 0; border-t border-card: 1px solid #e5e7eb; margin: 24px 0;" />

<p style="color: #999; font-size: 11px; margin: 0; text-align: center;">
If you didn't subscribe, you can ignore this email. Or you can <a href="${unsubscribeUrl}" style="color: #999; text-decoration: underline;">unsubscribe here</a>.
</p>
`,
`Confirm subscription by visiting: ${verifyUrl}`,
),
text: `Confirm your subscription to ${APP_NAME} Blog by visiting: ${verifyUrl}`,
tags: [
{ name: "category", value: "blog" },
{ name: "type", value: "subscribe" },
],
});
return result.success;
}

/**
* Send Blog Newsletter Email
*/
export async function sendBlogNewsletterEmail(
to: string,
subject: string,
content: string,
unsubscribeToken: string,
): Promise<boolean> {
const appUrl = getAppUrl();
const unsubscribeUrl = `${appUrl}/api/blog/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;

// Sanitize admin input to prevent HTML injection attacks
// Use DOMPurify to allow safe HTML (formatting) but strip dangerous tags/scripts
const sanitizedSubject = DOMPurify.sanitize(subject, {
ALLOWED_TAGS: [],
ALLOWED_ATTR: [],
KEEP_CONTENT: true,
});

const sanitizedContent = DOMPurify.sanitize(content, {
ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 'a', 'h1', 'h2', 'h3'],
ALLOWED_ATTR: ['href', 'target'],
KEEP_CONTENT: true,
});

const result = await sendEmail({
to,
subject: `${APP_NAME} Blog: ${sanitizedSubject}`,
html: wrapInBrandedTemplate(
`
<h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #1f2937;">${sanitizedSubject}</h2>
<div style="color: #666; margin: 0 0 24px; line-height: 1.6;">
${sanitizedContent}
</div>

<hr style="border: 0; border-t border-card: 1px solid #e5e7eb; margin: 24px 0;" />

<p style="color: #999; font-size: 11px; margin: 0; text-align: center;">
You're receiving this because you subscribed to the ${APP_NAME} Blog. <a href="${unsubscribeUrl}" style="color: #999; text-decoration: underline;">Unsubscribe here</a>.
</p>
`,
      `${sanitizedSubject.replace(/\s+/g, " ").trim()}`,
    ),
    text: `${sanitizedSubject}\n\n${stripHtmlTags(sanitizedContent)}\n\nUnsubscribe: ${unsubscribeUrl}`,
tags: [
{ name: "category", value: "blog" },
{ name: "type", value: "newsletter" },
],
});
return result.success;
}
