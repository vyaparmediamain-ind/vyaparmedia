/**
 * http — Core transport for the api-client layer.
 *
 * Features:
 * - Automatic `Content-Type: application/json` for JSON bodies
 * - Retry on network failures with exponential backoff (configurable per-call)
 * - Global 401 handler → signOut + redirect to /login
 * - Global 403 handler → throws ApiClientError without redirect
 * - All non-ok responses → throws ApiClientError with { status, code, message }
 * - Optional Zod schema validation on success responses
 * - Per-call AbortSignal support
 *
 * Usage:
 *   const data = await http<MyType>('/api/wallet', { method: 'GET' }, { schema: walletSchema });
 */
import { z, ZodError } from "zod";
import { signOut } from "next-auth/react";
import { ApiClientError } from "./errors";
import { logger } from "@/lib/logger-client";

export interface RetryConfig {
  /** Number of retries on network error (not on HTTP errors). Default: 2 */
  retries?: number;
  /** Base delay in ms before first retry. Doubles each attempt. Default: 500 */
  baseDelayMs?: number;
}

export interface HttpOptions extends RequestInit {
  /** If provided, validates parsed JSON through schema.parse() */
  schema?: z.ZodTypeAny;
  /** Per-call retry config overrides */
  retry?: RetryConfig;
  /**
   * Expected response format: "json" (default), "blob" (e.g. file/CSV downloads), or "text".
   */
  responseType?: "json" | "blob" | "text";
  /**
   * If true, 401 will NOT trigger signOut/redirect.
   * Used by auth flows (login, register) that run before a session exists.
   */
  skipAuthRedirect?: boolean;
}

const DEFAULT_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 500;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parses the backend error response JSON into a user-readable message + code */
async function parseErrorBody(
  res: Response,
): Promise<{ message: string; code: string; raw: unknown }> {
  try {
    const raw = await res.json();
    const message: string =
      raw?.message || raw?.error || `Request failed with status ${res.status}`;
    const code: string = raw?.code || raw?.errorCode || String(res.status);
    return { message, code, raw };
  } catch {
    return {
      message: `Request failed with status ${res.status}`,
      code: String(res.status),
      raw: null,
    };
  }
}

export async function http<T = unknown>(
  url: string,
  options: HttpOptions = {},
): Promise<T> {
  const {
    schema,
    retry: retryOverride,
    skipAuthRedirect = false,
    headers: optHeaders,
    body,
    ...fetchOptions
  } = options;

  const maxRetries = retryOverride?.retries ?? DEFAULT_RETRIES;
  const baseDelay = retryOverride?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;

  // Build headers — automatically set Content-Type for JSON bodies
  const headers = new Headers(optHeaders as HeadersInit | undefined);
  if (
    body &&
    typeof body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const fetchInit: RequestInit = {
        cache: "no-store",
        ...fetchOptions,
        headers,
      };
      if (body !== undefined && body !== null) {
        fetchInit.body = body;
      }

      const res = await fetch(url, fetchInit);

      if (res.status === 401) {
        const { message, code, raw } = await parseErrorBody(res);
        const isCredentialOrOtpError =
          code === "INVALID_CREDENTIALS" ||
          code === "INVALID_OTP" ||
          /\b(?:invalid|incorrect|wrong)\s+(?:email|password|credentials|login)\b/i.test(message);

        if (!skipAuthRedirect && !isCredentialOrOtpError && typeof window !== "undefined") {
          signOut({ callbackUrl: "/login" });
        }
        throw new ApiClientError(message, 401, code, raw);
      }

      if (!res.ok) {
        const { message, code, raw } = await parseErrorBody(res);
        throw new ApiClientError(message, res.status, code, raw);
      }

      if (res.status === 204) return undefined as T;

      if (options.responseType === "blob") {
        return (await res.blob()) as T;
      }
      if (options.responseType === "text") {
        return (await res.text()) as T;
      }

      const json = await res.json();

      if (schema) {
        try {
          return schema.parse(json) as T;
        } catch (zodErr) {
          if (zodErr instanceof ZodError) {
            logger.warn(`[api-client] Schema validation failed for ${url}`, {
              issues: zodErr.issues,
            });
          }
          throw zodErr;
        }
      }

      return json as T;
    } catch (err) {
      // Do not retry HTTP or schema validation errors
      if (err instanceof ApiClientError || err instanceof ZodError) {
        throw err;
      }

      lastError = err;

      // Network error — retry with exponential backoff
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        logger.warn(`[api-client] Network error on ${url}, retrying in ${delay}ms`, {
          attempt: attempt + 1,
          maxRetries,
        });
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  throw new ApiClientError(
    lastError instanceof Error ? lastError.message : "Network request failed",
    0,
    "NETWORK_ERROR",
    lastError,
  );
}

function serializeBody(data?: unknown): BodyInit | undefined {
  if (data === undefined) return undefined;
  if (
    typeof data === "string" ||
    (typeof FormData !== "undefined" && data instanceof FormData) ||
    (typeof Blob !== "undefined" && data instanceof Blob) ||
    (typeof URLSearchParams !== "undefined" && data instanceof URLSearchParams)
  ) {
    return data as BodyInit;
  }
  return JSON.stringify(data);
}

export function get<T = unknown>(url: string, options?: HttpOptions): Promise<T> {
  return http<T>(url, { method: "GET", ...options });
}

export function post<T = unknown>(
  url: string,
  data?: unknown,
  options?: HttpOptions,
): Promise<T> {
  const opts: HttpOptions = { method: "POST", ...options };
  if (data !== undefined) {
    const s = serializeBody(data);
    if (s !== undefined) opts.body = s;
  }
  return http<T>(url, opts);
}

export function put<T = unknown>(
  url: string,
  data?: unknown,
  options?: HttpOptions,
): Promise<T> {
  const opts: HttpOptions = { method: "PUT", ...options };
  if (data !== undefined) {
    const s = serializeBody(data);
    if (s !== undefined) opts.body = s;
  }
  return http<T>(url, opts);
}

export function patch<T = unknown>(
  url: string,
  data?: unknown,
  options?: HttpOptions,
): Promise<T> {
  const opts: HttpOptions = { method: "PATCH", ...options };
  if (data !== undefined) {
    const s = serializeBody(data);
    if (s !== undefined) opts.body = s;
  }
  return http<T>(url, opts);
}


export function del<T = unknown>(url: string, options?: HttpOptions): Promise<T> {
  return http<T>(url, { method: "DELETE", ...options });
}

