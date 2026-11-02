import * as Sentry from "@sentry/nextjs";

import { safeStringCommon, buildWithContext, maskPII, maskPIIPrimitive } from "./logger-common";
import type { LogContext } from "./logger-common";
export type { LogLevel, LogContext } from "./logger-common";

function safeString(message: unknown): string {
  return maskPIIPrimitive(safeStringCommon(message));
}

function safeMeta(data?: Record<string, unknown>, context?: LogContext): Record<string, unknown> {
  return maskPII({ ...data, ...context }) as Record<string, unknown>;
}

export const logger = {
  debug(message: unknown, data?: Record<string, unknown>, context?: LogContext) {
    const msg = safeString(message);
    const meta = safeMeta(data, context);
    console.debug(`[VyaparMedia] [DEBUG] ${msg}`, meta);
  },

  info(message: unknown, data?: Record<string, unknown>, context?: LogContext) {
    const msg = safeString(message);
    const meta = safeMeta(data, context);
    console.info(`[VyaparMedia] [INFO] ${msg}`, meta);
  },

  warn(message: unknown, data?: Record<string, unknown>, context?: LogContext) {
    const msg = safeString(message);
    const meta = safeMeta(data, context);
    console.warn(`[VyaparMedia] [WARN] ${msg}`, meta);

    // Capture warning in Sentry
    Sentry.captureMessage(msg, {
      level: "warning",
      extra: meta,
    });
  },

  error(message: unknown, error?: unknown, context?: LogContext) {
    const msg = safeString(message);
    const meta: Record<string, unknown> = safeMeta(undefined, context);

    const isErr =
      error instanceof Error ||
      (typeof error === "object" &&
        error !== null &&
        ("message" in error || "stack" in error || "name" in error || "digest" in error));

    if (isErr) {
      const errObj = error as Record<string, unknown>;
      meta.error = {
        name: errObj.name ? String(errObj.name) : "Error",
        message: errObj.message ? maskPIIPrimitive(String(errObj.message)) : "",
        stack: errObj.stack ? maskPIIPrimitive(String(errObj.stack)) : undefined,
        digest: errObj.digest ? String(errObj.digest) : undefined,
      };
    } else if (error !== undefined && error !== null) {
      meta.error = safeString(error);
    }

    console.error(`[VyaparMedia] [ERROR] ${msg}`, meta);

    // Capture exception or message in Sentry
    if (error instanceof Error) {
      Sentry.captureException(error, {
        extra: { message: msg, ...meta },
      });
    } else {
      Sentry.captureMessage(`${msg} - Error detail: ${safeString(error)}`, {
        level: "error",
        extra: meta,
      });
    }
  },

  critical(message: unknown, error?: unknown, context?: LogContext) {
    const msg = safeString(message);
    const meta: Record<string, unknown> = { ...safeMeta(undefined, context), level: "crit" };

    const isErr =
      error instanceof Error ||
      (typeof error === "object" &&
        error !== null &&
        ("message" in error || "stack" in error || "name" in error || "digest" in error));

    if (isErr) {
      const errObj = error as Record<string, unknown>;
      meta.error = {
        name: errObj.name ? String(errObj.name) : "Error",
        message: errObj.message ? maskPIIPrimitive(String(errObj.message)) : "",
        stack: errObj.stack ? maskPIIPrimitive(String(errObj.stack)) : undefined,
        digest: errObj.digest ? String(errObj.digest) : undefined,
      };
    } else if (error !== undefined && error !== null) {
      meta.error = safeString(error);
    }

    console.error(`[VyaparMedia] [CRITICAL] ${msg}`, meta);

    // Capture critical issue in Sentry
    if (error instanceof Error) {
      Sentry.captureException(error, {
        level: "fatal",
        extra: { message: msg, ...meta },
      });
    } else {
      Sentry.captureMessage(`[CRITICAL] ${msg} - Error detail: ${safeString(error)}`, {
        level: "fatal",
        extra: meta,
      });
    }
  },

  withContext(baseContext: LogContext) {
    return buildWithContext(this, baseContext);
  },
};
