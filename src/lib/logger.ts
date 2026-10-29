import "server-only";
import { inspect } from "node:util";

import {
createLogger,
format,
transports,
Logger as WinstonLogger,
} from "winston";

const { combine, timestamp, json, printf, colorize, errors, metadata } = format;

// Custom format for local development
const prettyPrint = printf(({ level, message, timestamp, stack, ...meta }) => {
// Clean up metadata to avoid duplicate timestamp/level inside meta
const { service: _service, ...restMeta } = meta;
const metaStr = Object.keys(restMeta).length ? JSON.stringify(restMeta) : "";
return `${timestamp} [${level}]: ${stack || message} ${metaStr}`;
});

const isDevelopment = process.env.NODE_ENV === "development";

import { maskPII, maskPIIPrimitive } from "./logger-common";
export { maskPII, maskPIIPrimitive };

const winstonLogger: WinstonLogger = createLogger({
level: process.env.LOG_LEVEL || "info",
format: combine(
timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
errors({ stack: true }), // Include stack trace
metadata({ fillExcept: ["timestamp", "level", "message", "stack"] }),
format((info) => {
if (typeof info.message === "string") {
info.message = maskPIIPrimitive(info.message);
}
if (info.metadata) {
info.metadata = maskPII(info.metadata);
}
return info;
})(),
json(),
),
defaultMeta: { service: "influencer-marketplace" },
transports: [
new transports.Console({
format: isDevelopment
? combine(colorize(), timestamp({ format: "HH:mm:ss" }), prettyPrint)
: json(),
}),
],
});

import { safeStringCommon, buildWithContext } from "./logger-common";
import type { LogContext } from "./logger-common";
export type { LogLevel, LogContext } from "./logger-common";

function safeString(message: unknown): string {
return safeStringCommon(message, (obj) => inspect(obj));
}

// Wrapper to match existing interface
export const logger = {
debug(message: unknown, data?: Record<string, unknown>, context?: LogContext) {
winstonLogger.debug(safeString(message), { ...data, ...context });
},

info(message: unknown, data?: Record<string, unknown>, context?: LogContext) {
winstonLogger.info(safeString(message), { ...data, ...context });
},

warn(message: unknown, data?: Record<string, unknown>, context?: LogContext) {
winstonLogger.warn(safeString(message), { ...data, ...context });
},

error(message: unknown, error?: unknown, context?: LogContext) {
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
winstonLogger.error(safeString(message), meta);
},

critical(message: unknown, error?: unknown, context?: LogContext) {
const meta: Record<string, unknown> = { ...context, level: "crit" }; // tag it
if (error instanceof Error) {
meta.error = {
name: error.name,
message: error.message,
stack: error.stack,
};
} else if (error !== undefined && error !== null) {
meta.error = safeString(error);
}
// Log as error but with critical tag (Winston default levels don't have crit)
winstonLogger.error(`[CRITICAL] ${safeString(message)}`, meta);
},

withContext(baseContext: LogContext) {
return buildWithContext(this, baseContext);
},
};

// Stream for external tools if needed
export const stream = {
write: (message: string) => {
logger.info(message.trim());
},
};
