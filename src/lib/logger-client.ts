import * as Sentry from "@sentry/nextjs";

import { safeStringCommon, buildWithContext } from "./logger-common";
import type { LogContext } from "./logger-common";
export type { LogLevel, LogContext } from "./logger-common";

function safeString(message: unknown): string {
return safeStringCommon(message);
}

export const logger = {
debug(message: unknown, data?: Record<string, unknown>, context?: LogContext) {
const msg = safeString(message);
console.debug(`[VyaparMedia] [DEBUG] ${msg}`, { ...data, ...context });
},

info(message: unknown, data?: Record<string, unknown>, context?: LogContext) {
const msg = safeString(message);
console.info(`[VyaparMedia] [INFO] ${msg}`, { ...data, ...context });
},

warn(message: unknown, data?: Record<string, unknown>, context?: LogContext) {
const msg = safeString(message);
console.warn(`[VyaparMedia] [WARN] ${msg}`, { ...data, ...context });

// Capture warning in Sentry
Sentry.captureMessage(msg, {
level: "warning",
extra: { ...data, ...context },
});
},

error(message: unknown, error?: unknown, context?: LogContext) {
const msg = safeString(message);
const meta: Record<string, unknown> = { ...context };

if (error instanceof Error) {
meta.error = {
name: error.name,
message: error.message,
stack: error.stack,
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
const meta: Record<string, unknown> = { ...context, level: "crit" };

if (error instanceof Error) {
meta.error = {
name: error.name,
message: error.message,
stack: error.stack,
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
