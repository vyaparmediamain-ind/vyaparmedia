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
