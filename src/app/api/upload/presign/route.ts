import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { auth } from "@/lib/auth";
import { isInfluencer, isBrand, isAdmin } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { createUploadPresignedUrl, type UploadFolder } from "@/lib/storage";
import { logger } from "@/lib/logger";


export const POST = apiWrapper(async (req) => {
  const session = await auth();
  if (!session?.user?.id) {
    return ApiResponse.unauthorized();
  }

  const rateLimit = await checkRateLimit(session.user.id, "UPLOAD");
  if (!rateLimit.success) {
    return ApiResponse.tooManyRequests("Upload limit reached, please wait a moment.");
  }

  // Daily quota: maximum 50 uploads per user per day
  const dailyUploadKey = `quota:upload:${session.user.id}:${new Date().toISOString().slice(0, 10)}`;
  try {
    const { redis } = await import("@/lib/redis");
    const count = await redis.incr(dailyUploadKey);
    if (count === 1) {
      await redis.expire(dailyUploadKey, 86400);
    }
    if (count > 50) {
      return ApiResponse.tooManyRequests("Daily upload quota of 50 uploads reached. Please resume tomorrow.");
    }
  } catch (quotaErr) {
    logger.warn("Daily upload quota check bypassed due to Redis outage (fail-open)", { error: quotaErr });
  }

  let body: {
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    folder?: UploadFolder;
  };

  try {
    body = await req.json();
  } catch {
    return ApiResponse.error("Invalid request body", 400);
  }

  const { fileName, fileType, fileSize, folder = "content" } = body;

  if (!fileName || typeof fileName !== "string") {
    return ApiResponse.error("fileName is required", 400);
  }

  if (!fileType || typeof fileType !== "string") {
    return ApiResponse.error("fileType is required", 400);
  }

  if (!fileSize || typeof fileSize !== "number" || fileSize <= 0) {
    return ApiResponse.error("fileSize must be a positive number", 400);
  }

  const ext = (fileName.split(".").pop() || "").toLowerCase();

  // Validate folder, MIME, extension, and file size category limits
  try {
    const { validateStorageCategory } = await import("@/lib/storage");
    validateStorageCategory(folder, fileType, ext, fileSize);
  } catch (valError) {
    return ApiResponse.error((valError as Error).message, 400);
  }

  // Authorization check based on folder
  const userType = session.user.userType;
  if (folder === "content" || folder === "posts") {
    if (!isInfluencer(userType) && !isAdmin(userType)) {
      return ApiResponse.forbidden("Only creators can upload deliverable content");
    }
  } else if (folder === "logos") {
    if (!isBrand(userType) && !isAdmin(userType)) {
      return ApiResponse.forbidden("Only brands can upload logos");
    }
  }

  try {
    const result = await createUploadPresignedUrl(fileName, folder, fileType, 900, fileSize, session.user.id);
    logger.info("Generated presigned upload URL", {
      userId: session.user.id,
      folder,
      fileName,
      isDirect: result.isDirect,
    });

    return ApiResponse.success(result, "Presigned upload URL generated successfully");
  } catch (error) {
    logger.error("Failed to generate presigned upload URL", { error, fileName });
    return ApiResponse.error(error instanceof Error ? error.message : "Failed to initialize upload", 500);
  }
});
