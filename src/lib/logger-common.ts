export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";

export interface LogContext {
userId?: string;
requestId?: string;
dealId?: string;
action?: string;
[key: string]: unknown;
}

type StringablePrimitive = string | number | boolean | bigint | symbol;

export function safeStringCommon(message: unknown, fallbackInspect?: (obj: unknown) => string): string {
if (typeof message === "string") return message;
if (message === null) return "null";
if (message === undefined) return "undefined";
if (message instanceof Error) return message.stack || message.message;
if (typeof message !== "object") {
return String(message as StringablePrimitive);
}
try {
return JSON.stringify(message);
} catch {
if (fallbackInspect) {
return fallbackInspect(message);
}
return "[Complex Object]";
}
}

export function buildWithContext(
  loggerObj: {
    debug: (message: unknown, data?: Record<string, unknown>, context?: LogContext) => void;
    info: (message: unknown, data?: Record<string, unknown>, context?: LogContext) => void;
    warn: (message: unknown, data?: Record<string, unknown>, context?: LogContext) => void;
    error: (message: unknown, error?: unknown, context?: LogContext) => void;
    critical: (message: unknown, error?: unknown, context?: LogContext) => void;
  },
  baseContext: LogContext,
) {
  return {
    debug: (msg: string, data?: Record<string, unknown>) =>
      loggerObj.debug(msg, data, baseContext),
    info: (msg: string, data?: Record<string, unknown>) =>
      loggerObj.info(msg, data, baseContext),
    warn: (msg: string, data?: Record<string, unknown>) =>
      loggerObj.warn(msg, data, baseContext),
    error: (msg: string, err?: unknown) =>
      loggerObj.error(msg, err, baseContext),
    critical: (msg: string, err?: unknown) =>
      loggerObj.critical(msg, err, baseContext),
  };
}

/**
 * PII Masking utility for Enterprise-grade logging
 * Automatically redacts sensitive patterns before they reach storage/sinks
 */
export function maskPIIPrimitive(data: string): string {
  let masked = data;
  // Mask Indian PAN (5 letters, 4 digits, 1 letter)
  masked = masked.replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi, "[REDACTED_PAN]");
  // Mask 12-digit Indian Aadhaar (continuous, space-separated, or hyphenated)
  masked = masked.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[REDACTED_AADHAAR]");
  // Mask Indian IFSC code (4 alphabetic + 0 + 6 alphanumeric)
  masked = masked.replace(/\b[A-Z]{4}0[A-Z0-9]{6}\b/gi, "[REDACTED_IFSC]");
  // Mask Email (unanchored, anywhere in string)
  masked = masked.replace(/([a-zA-Z0-9._%+-]{2})[a-zA-Z0-9._%+-]*(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, "$1***$2");
  // Mask Phone numbers (10-digit Indian numbers with optional country code)
  masked = masked.replace(/(?:\+?91[\s-]?)?[6-9]\d{9}\b/g, (match) => {
    const clean = match.replace(/[\s+-]/g, "");
    return clean.slice(0, 3) + "****" + clean.slice(-3);
  });
  return masked;
}

export function maskPII(data: unknown): unknown {
  if (typeof data !== "object" || data === null) {
    if (typeof data === "string") {
      return maskPIIPrimitive(data);
    }
    return data;
  }

  const masked: Record<string, unknown> = Array.isArray(data) ? ([] as unknown as Record<string, unknown>) : {};
  const sensitiveKeys = [
    "password",
    "token",
    "secret",
    "cvv",
    "card",
    "pin",
    "otp",
    "pan",
    "aadhaar",
    "documentnumber",
    "documentnumberhash",
    "accountnumber",
    "bankaccount",
    "upi",
    "gstin",
    "ifsc",
    "account",
  ];

  for (const key in data) {
    const value = (data as Record<string, unknown>)[key];

    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
      masked[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      masked[key] = maskPII(value);
    } else if (typeof value === "string") {
      masked[key] = maskPIIPrimitive(value);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}
