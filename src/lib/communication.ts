/**
* Unified Communication Layer VyaparMedia
*
* Single entry point for SMS delivery.
* Used by API routes for ad-hoc SMS (OTP, notifications, etc.)
*
* ARCHITECTURE NOTE:
* - `@/lib/email.ts` Structured template emails (OTP, welcome, deal updates)
* - `@/lib/communication.ts` (THIS FILE) Raw SMS sending for custom content
* - `@/lib/sms.ts` MSG91 OTP service (dedicated OTP flow)
*
* ENTERPRISE FEATURES:
* Retry with exponential backoff (SMS: 2 attempts)
* Request timeout via AbortController
* Input validation (phone format)
* Structured error logging with correlation IDs
* Dev-mode fallback (logs instead of sending)
*
* SMS Provider: MSG91
*/

import { logger } from "./logger";
import { randomUUID } from "node:crypto";
import { sleep } from "./utils";
import { env } from "@/env";
import { withCircuitBreaker } from "./circuit-breaker";
import { AppError } from "./errors";

const SMS_MAX_RETRIES = 2;
const BASE_RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 15_000;

export type DltCategory = "otp" | "transactional" | "fulfillment" | "notification";

export interface SendSmsOptions {
  category?: DltCategory | string;
  templateId?: string;
  variables?: Record<string, string>;
}

export function resolveDltTemplateId(category?: DltCategory | string, message?: string): string {
  const getEnv = (key: string) => {
    if (typeof process !== "undefined" && process.env[key] !== undefined) {
      return process.env[key] || "";
    }
    return (env as Record<string, unknown>)[key] as string || "";
  };

  if (category === "otp" || (!category && message && /\b\d{6}\b/.test(message))) {
    return getEnv("MSG91_OTP_TEMPLATE_ID") || getEnv("MSG91_TEMPLATE_ID");
  }
  if (category === "fulfillment" || category === "shipping") {
    return (
      getEnv("MSG91_FULFILLMENT_TEMPLATE_ID") ||
      getEnv("MSG91_TRANSACTIONAL_TEMPLATE_ID")
    );
  }
  if (category === "transactional" || category === "deal") {
    return getEnv("MSG91_TRANSACTIONAL_TEMPLATE_ID");
  }
  if (category === "notification") {
    return getEnv("MSG91_NOTIFICATION_TEMPLATE_ID");
  }
  return getEnv("MSG91_TEMPLATE_ID");
}

async function performSmsPost(
  apiKey: string,
  senderId: string,
  phone: string,
  message: string,
  attempt: number,
  log: ReturnType<typeof logger.withContext>,
  templateId: string,
  customVariables?: Record<string, string>,
): Promise<boolean> {
  try {
    return await withCircuitBreaker("msg91:api", async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const res = await fetch("https://api.msg91.com/api/v5/flow/", {
          method: "POST",
          headers: {
            authkey: apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            template_id: templateId,
            short_url: "0",
            recipients: (() => {
              // Extract the 6-digit OTP from the message body for MSG91 template variables
              const otpMatch = /\b(\d{6})\b/.exec(message);
              const otp = otpMatch ? otpMatch[1] : undefined;
              const recipient: Record<string, string> = {
                mobiles: phone.replace(/^\+/, ""),
                message,
                msg: message,
                sms: message,
                text: message,
                body: message,
                ...(customVariables || {}),
              };
              if (otp) {
                // MSG91 DLT templates use ##otp## / ##code## placeholders
                recipient.otp = otp;
                recipient.code = otp;
                recipient.var1 = otp;
                recipient.var2 = otp;
                recipient.var = otp;
                recipient.otp_code = otp;
              }
              return [recipient];
            })(),
            sender: senderId,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          log.info("SMS sent via MSG91", { phone, attempt, templateId });
          return true;
        }

        const errorText = await res.text().catch(() => "");

        if (res.status >= 500) {
          log.warn(`MSG91 server error (${res.status}). Attempt ${attempt}/${SMS_MAX_RETRIES}`, {
            error: errorText,
          });
          throw new Error(`MSG91 server error (${res.status}): ${errorText}`);
        }

        log.warn(`MSG91 client error (${res.status}). Attempt ${attempt}/${SMS_MAX_RETRIES}`, {
          error: errorText,
        });
        return false;
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        throw err;
      }
    });
  } catch (err: unknown) {
    if (err instanceof AppError && err.message.includes("Circuit is OPEN")) {
      log.warn(`MSG91 circuit breaker is OPEN. Fast-failing attempt ${attempt}/${SMS_MAX_RETRIES}.`);
      return false;
    }

    const errName = err instanceof Error ? err.name : "Error";
    if (errName === "AbortError") {
      log.warn(`SMS send timed out. Attempt ${attempt}/${SMS_MAX_RETRIES}`);
    } else {
      log.error(`Network or server error sending SMS. Attempt ${attempt}/${SMS_MAX_RETRIES}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return false;
  }
}

/**
 * Send an SMS message via MSG91 Flow API.
 * Includes retry, timeout, Indian phone number validation, circuit breaker, and TRAI DLT template resolution.
 */
export async function sendSMS(
  phone: string,
  message: string,
  options?: SendSmsOptions | DltCategory,
): Promise<boolean> {
  const correlationId = randomUUID().slice(0, 8);
  const log = logger.withContext({ correlationId, service: "sms" });

  // Input validation
  if (!phone || !/^[6-9]\d{9}$/.test(phone.replace(/^\+?91/, ""))) {
    log.error("Invalid Indian phone number: " + phone);
    return false;
  }

  if (!message) {
    log.error("SMS message body is required");
    return false;
  }

  const isProd = env.NODE_ENV === "production" || process.env.NODE_ENV === "production";
  const apiKey = process.env.MSG91_AUTH_KEY || env.MSG91_AUTH_KEY || env.SMS_API_KEY;
  const senderId =
    process.env.MSG91_SENDER_ID || env.MSG91_SENDER_ID || env.SMS_SENDER_ID || "DCSNL";

  // Dev fallback
  if (!apiKey) {
    if (!isProd) {
      log.info("DEV SMS no API key set, logging instead", {
        phone,
        message: message.slice(0, 50),
      });
      return true;
    }
    log.error("CRITICAL: MSG91_AUTH_KEY not configured in production. SMS cannot be delivered.");
    return false;
  }

  // Resolve DLT template
  const opts: SendSmsOptions = typeof options === "string" ? { category: options } : options || {};
  const isOtp = opts.category === "otp" || (!opts.category && /\b\d{6}\b/.test(message));
  const templateId = opts.templateId || resolveDltTemplateId(opts.category, message);

  if (!templateId) {
    if (isOtp) {
      if (isProd) {
        log.error("CRITICAL: DLT template ID is required for OTP SMS in production but not configured.");
        return false;
      }
    } else {
      // Non-OTP SMS: skip silently with metric/warning to avoid TRAI DLT penalty
      if (isProd) {
        log.warn("Skipping non-OTP SMS delivery: DLT template ID not configured in production", {
          category: opts.category,
          phone,
        });
        return false;
      }
    }
  }

  // Retry loop
  for (let attempt = 1; attempt <= SMS_MAX_RETRIES; attempt++) {
    const success = await performSmsPost(
      apiKey,
      senderId,
      phone,
      message,
      attempt,
      log,
      templateId,
      opts.variables,
    );
    if (success) return true;

    if (attempt < SMS_MAX_RETRIES) {
      await sleep(BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1));
    }
  }

  log.error("SMS delivery FAILED after all retries", { phone });
  return false;
}
