/**
* Application Error Classes
*
* Use `AppError` to throw typed, HTTP-aware errors from anywhere in the codebase.
* The `apiWrapper` catch block handles `instanceof AppError` directly no
* string-matching on messages required.
*
* Usage:
* throw new AppError("Campaign not found", 404);
* throw AppError.notFound("Campaign not found");
* throw AppError.forbidden("Only brands may create campaigns.");
*/

/** Semantic error codes carried on AppError for structured logging and routing. */
export enum ApiErrorCode {
  BAD_REQUEST = "BAD_REQUEST",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS",
  RATE_LIMIT = "RATE_LIMIT",
  GATEWAY_TIMEOUT = "GATEWAY_TIMEOUT",
  GATEWAY_AMBIGUOUS = "GATEWAY_AMBIGUOUS",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  PAYMENT_ERROR = "PAYMENT_ERROR",
  GATEWAY_ERROR = "GATEWAY_ERROR",
  CRON_FORBIDDEN = "CRON_FORBIDDEN",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  SHIPPING_NON_SERVICEABLE = "SHIPPING_NON_SERVICEABLE",
  SHIPPING_ADDRESS_REQUIRED = "SHIPPING_ADDRESS_REQUIRED",
  INTERNAL = "INTERNAL",
}

export class AppError extends Error {
readonly statusCode: number;
readonly errorCode: ApiErrorCode;

constructor(
message: string,
statusCode: number,
errorCode: ApiErrorCode = ApiErrorCode.BAD_REQUEST,
) {
super(message);
this.name = "AppError";
this.statusCode = statusCode;
this.errorCode = errorCode;
}

// Typed factory helpers

static badRequest(message: string): AppError {
return new AppError(message, 400, ApiErrorCode.BAD_REQUEST);
}

static unauthorized(message = "Authentication required."): AppError {
return new AppError(message, 401, ApiErrorCode.UNAUTHORIZED);
}

static forbidden(message = "You do not have permission to perform this action."): AppError {
return new AppError(message, 403, ApiErrorCode.FORBIDDEN);
}

static notFound(message = "The requested resource was not found."): AppError {
return new AppError(message, 404, ApiErrorCode.NOT_FOUND);
}

static conflict(message = "Resource already exists."): AppError {
return new AppError(message, 409, ApiErrorCode.CONFLICT);
}

static tooManyRequests(message = "Too many requests. Please try again later."): AppError {
return new AppError(message, 429, ApiErrorCode.TOO_MANY_REQUESTS);
}

static gatewayError(message = "Payment gateway authentication failed."): AppError {
return new AppError(message, 500, ApiErrorCode.GATEWAY_ERROR);
}

static cronForbidden(message = "Invalid cron secret."): AppError {
return new AppError(message, 403, ApiErrorCode.CRON_FORBIDDEN);
}

  static internal(message = "An unexpected error occurred."): AppError {
    return new AppError(message, 500, ApiErrorCode.INTERNAL);
  }

  static rateLimit(message = "Too many requests. Please wait a moment before trying again."): AppError {
    return new AppError(message, 429, ApiErrorCode.RATE_LIMIT);
  }

  static gatewayTimeout(message = "Gateway timeout. Please check your transaction history."): AppError {
    return new AppError(message, 504, ApiErrorCode.GATEWAY_TIMEOUT);
  }

  static gatewayAmbiguous(message = "Gateway response ambiguous. Transaction awaiting webhook reconciliation."): AppError {
    return new AppError(message, 502, ApiErrorCode.GATEWAY_AMBIGUOUS);
  }

  static fileTooLarge(message = "File exceeds maximum allowed upload size."): AppError {
    return new AppError(message, 413, ApiErrorCode.FILE_TOO_LARGE);
  }

  static serviceUnavailable(message = "Security verification service temporarily unavailable. Please try again shortly."): AppError {
    return new AppError(message, 503, ApiErrorCode.SERVICE_UNAVAILABLE);
  }

  static shippingNonServiceable(message = "The selected courier cannot service this destination pincode. Please update the delivery address."): AppError {
    return new AppError(message, 400, ApiErrorCode.SHIPPING_NON_SERVICEABLE);
  }

  static shippingAddressRequired(message = "Creator shipping address must be submitted before product sample dispatch."): AppError {
    return new AppError(message, 400, ApiErrorCode.SHIPPING_ADDRESS_REQUIRED);
  }
}

/**
 * Type-safe error narrowing helpers
 * Converts unknown catch variables to standard Error instances or message strings
 * without using `any` or `@ts-ignore`.
 */
export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === "string") {
    return new Error(error);
  }
  return new Error(String(error));
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}
