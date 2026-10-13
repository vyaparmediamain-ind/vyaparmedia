import { AppError } from "@/lib/errors";
import { logger } from "./logger";

export function getConfiguredAppUrl(requestOrigin?: string): string {
const configured =
process.env.NEXTAUTH_URL ||
process.env.NEXT_PUBLIC_APP_URL ||
process.env.APP_BASE_URL ||
"";
let normalized = configured;
while (normalized.endsWith("/")) {
normalized = normalized.slice(0, -1);
}

if (normalized) return normalized;

if (process.env.NODE_ENV !== "production" && requestOrigin) {
let origin = requestOrigin;
while (origin.endsWith("/")) {
origin = origin.slice(0, -1);
}
return origin;
}

logger.error("Application base URL is not configured");
throw AppError.badRequest("APP_URL_NOT_CONFIGURED");
}

export function appUrl(path: string, requestOrigin?: string): string {
const prefix = path.startsWith("/") ? "" : "/";
return `${getConfiguredAppUrl(requestOrigin)}${prefix}${path}`;
}
