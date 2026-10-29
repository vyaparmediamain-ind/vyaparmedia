/**
 * ApiClientError — structured error thrown by the api-client HTTP layer.
 *
 * Every non-ok response from the backend (or a Zod parse failure) is converted
 * into an ApiClientError so consumers deal with one shape, not raw Response objects.
 *
 * Usage:
 *   try { await apiClient.wallet.getSummary() }
 *   catch (err) {
 *     if (err instanceof ApiClientError && err.isForbidden) { ... }
 *   }
 */
export class ApiClientError extends Error {
  readonly status: number;
  /** Mirrors backend ApiErrorCode enum values where available */
  readonly code: string;
  /** Raw parsed JSON from the error response (if any) */
  readonly raw: unknown;

  constructor(message: string, status: number, code = "UNKNOWN", raw?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.raw = raw;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isRateLimit(): boolean {
    return this.status === 429;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}
