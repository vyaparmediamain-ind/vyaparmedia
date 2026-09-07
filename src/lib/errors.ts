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
PAYMENT_ERROR = "PAYMENT_ERROR",
GATEWAY_ERROR = "GATEWAY_ERROR",
CRON_FORBIDDEN = "CRON_FORBIDDEN",
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
}
