import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { confirmUploadedObject } from "@/lib/storage";
import { logger } from "@/lib/logger";

interface ConfirmUploadBody {
  key?: string;
}

/**
 * POST /api/upload/confirm
 * Verifies that a direct client upload to S3/R2 completed, conforms to category constraints,
 * and contains clean magic bytes without embedded SVG/XSS/HTML payloads.
 * Automatically deletes the object if non-compliant.
 */
export const POST = apiWrapper(async (req) => {
  const session = await auth();
  if (!session?.user?.id) {
    return ApiResponse.unauthorized();
  }

  const rateLimit = await checkRateLimit(session.user.id, "UPLOAD");
  if (!rateLimit.success) {
    return ApiResponse.tooManyRequests("Rate limit reached. Please wait.");
  }

  let body: ConfirmUploadBody;
  try {
    body = await req.json();
  } catch {
    return ApiResponse.error("Invalid JSON body", 400);
  }

  const { key } = body;
  if (!key || typeof key !== "string") {
    return ApiResponse.error("Storage key is required", 400);
  }

  logger.info("Confirming uploaded storage object", {
    userId: session.user.id,
    key,
  });

  const verification = await confirmUploadedObject(key, session.user.id);
  if (!verification.success) {
    logger.warn("Uploaded storage object failed security verification; deleted", {
      userId: session.user.id,
      key,
      error: verification.error,
    });
    return ApiResponse.error(verification.error || "Uploaded object verification failed", 400);
  }

  return ApiResponse.success(
    {
      verified: true,
      key,
      size: verification.size,
      contentType: verification.contentType,
    },
    "File verified and confirmed in storage",
  );
});
