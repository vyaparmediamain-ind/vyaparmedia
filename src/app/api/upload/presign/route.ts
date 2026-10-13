import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { auth } from "@/lib/auth";
import { isInfluencer, isBrand, isAdmin } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { createUploadPresignedUrl, type UploadFolder } from "@/lib/storage";
import { logger } from "@/lib/logger";

const MAX_CONTENT_FILE_SIZE = 100 * 1024 * 1024; // 100 MB max for deliverable video/photo

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
]);

export const POST = apiWrapper(async (req) => {
  const session = await auth();
  if (!session?.user?.id) {
    return ApiResponse.unauthorized();
  }

  const rateLimit = await checkRateLimit(session.user.id, "DEAL_UPDATES");
  if (!rateLimit.success) {
    return ApiResponse.tooManyRequests("Upload limit reached, please wait a moment.");
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

  if (fileSize > MAX_CONTENT_FILE_SIZE) {
    return ApiResponse.error(`File exceeds maximum size of 100MB (${Math.round(fileSize / (1024 * 1024))}MB uploaded)`, 400);
  }

  if (!ALLOWED_MIME_TYPES.has(fileType)) {
    return ApiResponse.error(`File type '${fileType}' is not supported. Please upload MP4, MOV, WEBM, JPG, PNG, or WEBP.`, 400);
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
    const result = await createUploadPresignedUrl(fileName, folder, fileType, 900, fileSize);
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
