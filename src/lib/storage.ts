/**
* Cloud Storage Service
* Handles file uploads for verification docs, content, and profile images.
* Supports: AWS S3, Cloudflare R2, and local filesystem (dev).
*
* Add STORAGE_PROVIDER + credentials to .env to activate.
*/

import { logger } from "./logger";
import { randomUUID } from "node:crypto";
import {
DeleteObjectCommand,
GetObjectCommand,
PutObjectCommand,
S3Client,
type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl as createPresignedUrl } from "@aws-sdk/s3-request-presigner";

const isProduction = process.env.NODE_ENV === "production";
const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || (isProduction ? "" : "local"); // 's3' | 'r2' | 'local'

export const STORAGE_LIMITS = {
  avatars: {
    maxBytes: 2 * 1024 * 1024, // 2MB
    allowedMimes: ["image/jpeg", "image/png", "image/webp"],
    allowedExts: ["jpg", "jpeg", "png", "webp"],
  },
  logos: {
    maxBytes: 2 * 1024 * 1024, // 2MB
    allowedMimes: ["image/jpeg", "image/png", "image/webp"],
    allowedExts: ["jpg", "jpeg", "png", "webp"],
  },
  verification: {
    maxBytes: 5 * 1024 * 1024, // 5MB
    allowedMimes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    allowedExts: ["jpg", "jpeg", "png", "webp", "pdf"],
  },
  feedback: {
    maxBytes: 10 * 1024 * 1024, // 10MB
    allowedMimes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    allowedExts: ["jpg", "jpeg", "png", "webp", "pdf"],
  },
  chat: {
    maxBytes: 10 * 1024 * 1024, // 10MB
    allowedMimes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    allowedExts: ["jpg", "jpeg", "png", "webp", "pdf"],
  },
  content: {
    maxBytesImage: 10 * 1024 * 1024, // 10MB
    maxBytesVideo: 100 * 1024 * 1024, // 100MB
    allowedMimes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/quicktime",
      "video/webm",
      "application/pdf",
    ],
    allowedExts: ["jpg", "jpeg", "png", "webp", "mp4", "mov", "webm", "pdf"],
  },
  posts: {
    maxBytesImage: 10 * 1024 * 1024, // 10MB
    maxBytesVideo: 100 * 1024 * 1024, // 100MB
    allowedMimes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/quicktime",
      "video/webm",
    ],
    allowedExts: ["jpg", "jpeg", "png", "webp", "mp4", "mov", "webm"],
  },
} as const;

export function sanitizePathSegment(segment: string): string {
  return String(segment ?? "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64) || "anon";
}

export function validateStorageCategory(
  folder: UploadFolder,
  contentType: string,
  extension: string,
  fileSize: number,
): void {
  const normMime = (contentType || "").toLowerCase().trim();
  const normExt = (extension || "").toLowerCase().trim().replace(/^\./, "");

  // Stored XSS defense: SVG and HTML are strictly prohibited across all categories
  if (
    normMime.includes("svg") ||
    normExt === "svg" ||
    normMime.includes("html") ||
    normMime.includes("xml") ||
    ["html", "htm", "xml", "xhtml", "svg"].includes(normExt)
  ) {
    throw new Error("SVG and HTML files are strictly prohibited due to security restrictions");
  }

  // Dangerous script and executable extensions
  const dangerousExts = ["exe", "php", "sh", "bat", "js", "ts", "py", "vbs", "cmd", "msi"];
  if (dangerousExts.includes(normExt)) {
    throw new Error("Executable and script files are strictly prohibited");
  }

  const category = STORAGE_LIMITS[folder];
  if (!category) {
    throw new Error(`Invalid upload category: ${folder}`);
  }

  if (!(category.allowedMimes as readonly string[]).includes(normMime)) {
    throw new Error(`File type '${normMime}' is not allowed for category ${folder}`);
  }

  if (!(category.allowedExts as readonly string[]).includes(normExt)) {
    throw new Error(`File extension '.${normExt}' is not allowed for category ${folder}`);
  }

  const mimeToExtMap: Record<string, string[]> = {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
    "video/mp4": ["mp4"],
    "video/quicktime": ["mov", "qt"],
    "video/webm": ["webm"],
    "application/pdf": ["pdf"],
  };

  const allowedExtsForMime = mimeToExtMap[normMime];
  if (allowedExtsForMime && !allowedExtsForMime.includes(normExt)) {
    throw new Error(`File extension '.${normExt}' does not match declared MIME type '${normMime}'`);
  }

  let maxAllowed = 10 * 1024 * 1024;
  if ("maxBytes" in category) {
    maxAllowed = category.maxBytes;
  } else if ("maxBytesVideo" in category && normMime.startsWith("video/")) {
    maxAllowed = category.maxBytesVideo;
  } else if ("maxBytesImage" in category) {
    maxAllowed = category.maxBytesImage;
  }

  if (fileSize > maxAllowed) {
    const maxMb = Math.round(maxAllowed / (1024 * 1024));
    throw new Error(`File size (${Math.round(fileSize / (1024 * 1024))}MB) exceeds maximum allowed size of ${maxMb}MB for ${folder}`);
  }
}

function validateStorageConfig() {
  if (isProduction && (!process.env.STORAGE_PROVIDER || process.env.STORAGE_PROVIDER === "local" || !S3_BUCKET)) {
    logger.critical(
      "STORAGE_SECURITY_CRITICAL: STORAGE_PROVIDER is unset or set to 'local' in production. S3/R2 credentials missing.",
    );
  }
}

// AWS S3 / Cloudflare R2 config
const S3_BUCKET = process.env.S3_BUCKET || "";
const S3_REGION = process.env.S3_REGION || "ap-south-1";
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || "";
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || "";
const S3_ENDPOINT = process.env.S3_ENDPOINT || ""; // For R2: https://<account-id>.r2.cloudflarestorage.com
const STORAGE_PUBLIC_URL = (() => {
let url = process.env.STORAGE_PUBLIC_URL || process.env.R2_PUBLIC_URL || "";
while (url.endsWith("/")) {
url = url.slice(0, -1);
}
return url;
})();
let s3Client: S3Client | null = null;

interface UploadResult {
success: boolean;
url?: string;
key?: string;
size?: number;
error?: string;
}

interface DeleteResult {
success: boolean;
error?: string;
}

export type UploadFolder = "verification" | "content" | "avatars" | "logos" | "posts" | "feedback" | "chat";

function getS3Client(): S3Client | null {
if (!S3_ACCESS_KEY || !S3_SECRET_KEY || !S3_BUCKET) return null;

if (!s3Client) {
const config: S3ClientConfig = {
region: STORAGE_PROVIDER === "r2" ? "auto" : S3_REGION,
forcePathStyle: Boolean(S3_ENDPOINT),
credentials: {
accessKeyId: S3_ACCESS_KEY,
secretAccessKey: S3_SECRET_KEY,
},
};

if (S3_ENDPOINT) {
config.endpoint = S3_ENDPOINT;
}

s3Client = new S3Client(config);
}

return s3Client;
}

function getObjectUrl(key: string): string {
  // Security: Private KYC verification documents must NEVER have a public URL
  if (key.startsWith("verification/")) {
    return key;
  }

  if (STORAGE_PUBLIC_URL) {
    return `${STORAGE_PUBLIC_URL}/${key}`;
  }

  if (S3_ENDPOINT) {
    let endpoint = S3_ENDPOINT;
    while (endpoint.endsWith("/")) {
      endpoint = endpoint.slice(0, -1);
    }
    return `${endpoint}/${S3_BUCKET}/${key}`;
  }

  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
}

/**
 * Upload a file to cloud storage.
 * Returns the public URL of the uploaded file.
 */
export async function uploadFile(
  file: Buffer | Uint8Array,
  fileName: string,
  folder: UploadFolder,
  contentType: string = "application/octet-stream",
  userId?: string,
): Promise<UploadResult> {
  validateStorageConfig();
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  validateStorageCategory(folder, contentType, ext, file.length);

  const safeExt = ext || (contentType.includes("pdf") ? "pdf" : "bin");
  const key = userId
    ? `${folder}/${sanitizePathSegment(userId)}/${Date.now()}-${randomUUID()}.${safeExt}`
    : `${folder}/${Date.now()}-${randomUUID()}.${safeExt}`;

  // Image sanitization & EXIF stripping for raster images
  let uploadBuffer: Buffer = Buffer.isBuffer(file) ? file : Buffer.from(file);
  if (contentType.startsWith("image/") && !contentType.includes("svg")) {
    const sanitized = await sanitizeImageWithSharp(uploadBuffer, contentType);
    if (sanitized.success && sanitized.buffer) {
      uploadBuffer = sanitized.buffer;
    }
  }

  try {
    switch (STORAGE_PROVIDER) {
      case "s3":
      case "r2":
        return await uploadToS3(uploadBuffer, key, contentType);

      case "local":
      default:
        return await uploadToLocal(uploadBuffer, key, contentType);
    }
  } catch (error) {
    logger.error("Storage upload failed", error, { key });
    return { success: false, error: "File upload failed" };
  }
}

/**
 * Upload from a File/Blob (e.g., from FormData).
 */
export async function uploadFormFile(
  formFile: File,
  folder: UploadFolder,
  userId?: string,
): Promise<UploadResult> {
  const buffer = Buffer.from(await formFile.arrayBuffer());
  return uploadFile(buffer, formFile.name, folder, formFile.type, userId);
}

/**
 * Upload from a base64 string.
 */
export async function uploadBase64(
  base64: string,
  fileName: string,
  folder: UploadFolder,
  contentType: string = "image/png",
  userId?: string,
): Promise<UploadResult> {
  // Remove data URL prefix if present
  const data = base64.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(data, "base64");
  return uploadFile(buffer, fileName, folder, contentType, userId);
}

/**
 * Delete a file from cloud storage by key.
 */
export async function deleteFile(key: string): Promise<DeleteResult> {
  validateStorageConfig();
  try {
    switch (STORAGE_PROVIDER) {
      case "s3":
      case "r2":
        return await deleteFromS3(key);
      case "local":
      default:
        return await deleteFromLocal(key);
    }
  } catch (error) {
    logger.error("Storage delete failed", error, { key });
    return { success: false, error: "File deletion failed" };
  }
}

/**
 * Generate a signed/presigned URL for temporary access to a private file.
 */
export async function getSignedUrl(
  key: string,
  expiresInSeconds: number = 900,
): Promise<string | null> {
  validateStorageConfig();
  if (key.startsWith("data:") || key.startsWith("http")) {
    return key;
  }
  if (STORAGE_PROVIDER === "local" || !getS3Client()) {
    return key.startsWith("/") ? key : `/uploads/${key}`;
  }

  const client = getS3Client();
  if (!client) {
    return key.startsWith("/") ? key : `/uploads/${key}`;
  }

  return createPresignedUrl(
    client,
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    { expiresIn: Math.min(Math.max(expiresInSeconds, 60), 3600) },
  );
}

export interface PresignedUploadResult {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  method: "PUT" | "POST";
  headers?: Record<string, string>;
  isDirect: boolean;
}

/**
 * Generate a presigned upload URL for direct-to-storage client upload (S3 / Cloudflare R2).
 * Falls back to local streaming endpoint if storage is in local mode.
 */
export async function createUploadPresignedUrl(
  fileName: string,
  folder: UploadFolder,
  contentType: string = "application/octet-stream",
  expiresInSeconds: number = 900,
  fileSize?: number,
  userId?: string,
): Promise<PresignedUploadResult> {
  const isProd = process.env.NODE_ENV === "production";

  if (!fileSize || fileSize <= 0) {
    throw new Error("ContentLength (fileSize) is mandatory for generating upload presigned URLs");
  }

  const ext = (fileName.split(".").pop() || "").toLowerCase();
  validateStorageCategory(folder, contentType, ext, fileSize);

  // Clamp expiry between 5 mins (300s) and 15 mins (900s)
  const clampedExpiry = Math.min(Math.max(expiresInSeconds, 300), 900);

  // Server-generated key: userId/timestamp-uuid.ext, never using client-provided filename
  const safeExt = ext || (contentType.includes("pdf") ? "pdf" : "bin");
  const key = userId
    ? `${folder}/${sanitizePathSegment(userId)}/${Date.now()}-${randomUUID()}.${safeExt}`
    : `${folder}/${Date.now()}-${randomUUID()}.${safeExt}`;

  const isPrivate = folder === "verification";

  // Production security guard: local storage and data URLs are completely forbidden in production
  if (isProd && (process.env.STORAGE_PROVIDER === "local" || !process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY)) {
    logger.critical("PRODUCTION_STORAGE_ERROR: Local storage and data URL fallbacks are strictly prohibited in production runtime.");
    throw new Error("Local storage and data URL fallbacks are strictly prohibited in production");
  }

  const client = getS3Client();
  if (!client || process.env.STORAGE_PROVIDER === "local") {
    return {
      uploadUrl: "/api/upload",
      fileUrl: isPrivate ? key : `/uploads/${key}`,
      key,
      method: "POST",
      isDirect: false,
    };
  }

  const presignedUrl = await createPresignedUrl(
    client,
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET || S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentDisposition: isPrivate ? "attachment" : "inline",
      ContentLength: fileSize,
      CacheControl: isPrivate
        ? "private, no-cache, no-store"
        : "public, max-age=31536000, immutable",
    }),
    { expiresIn: clampedExpiry },
  );

  return {
    uploadUrl: presignedUrl,
    fileUrl: isPrivate ? key : getObjectUrl(key),
    key,
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    isDirect: true,
  };
}

async function uploadToS3(
  file: Buffer | Uint8Array,
  key: string,
  contentType: string,
): Promise<UploadResult> {
  const client = getS3Client();
  if (!client) {
    if (isProduction) {
      logger.critical("PRODUCTION_STORAGE_ERROR: S3/R2 credentials missing in production environment");
      throw new Error("Local storage and data URL fallbacks are strictly prohibited in production");
    }
    const error = "S3/R2 credentials are not fully configured";
    logger.warn(`${error} - falling back to local/data-URL storage in non-production mode`);
    return uploadToLocal(file, key, contentType);
  }

  try {
    const isPrivate = key.startsWith("verification/");
    await client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: file,
        ContentType: contentType,
        ContentDisposition: isPrivate ? "attachment" : "inline",
        ContentLength: file.length,
        CacheControl: isPrivate
          ? "private, no-cache, no-store"
          : "public, max-age=31536000, immutable",
      }),
    );

    return {
      success: true,
      url: isPrivate ? key : getObjectUrl(key),
      key,
      size: file.length,
    };
  } catch (error) {
    logger.error("S3/R2 upload error", error, {
      key,
      provider: STORAGE_PROVIDER,
    });
    return { success: false, error: "Cloud storage upload failed" };
  }
}

async function uploadToLocal(
  file: Buffer | Uint8Array,
  key: string,
  contentType: string = "application/octet-stream",
): Promise<UploadResult> {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    logger.critical("PRODUCTION_STORAGE_ERROR: Local storage and data URL fallbacks are strictly prohibited in production runtime.");
    throw new Error("Local storage and data URL fallbacks are strictly prohibited in production");
  }

  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const MAX_INLINE_FALLBACK_BYTES = 512 * 1024; // 512 KB safeguard

  if (isServerless && !S3_BUCKET) {
    if (file.length > MAX_INLINE_FALLBACK_BYTES) {
      logger.warn("Local storage fallback file exceeds data URL safety limit", { size: file.length, limit: MAX_INLINE_FALLBACK_BYTES });
      return { success: false, error: `File too large (${Math.round(file.length / 1024)} KB) for inline fallback` };
    }
    const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file);
    const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
    return { success: true, url: dataUrl, key, size: file.length };
  }

  const fs = await import("node:fs/promises");
  const path = await import("node:path");

  try {
    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      path.dirname(key),
    );
    await fs.mkdir(uploadDir, { recursive: true });

    const filePath = path.join(process.cwd(), "public", "uploads", key);
    await fs.writeFile(filePath, file);

    const isPrivate = key.startsWith("verification/");
    const url = isPrivate ? key : `/uploads/${key}`;
    logger.debug("Local file saved", { url });
    return { success: true, url, key, size: file.length };
  } catch (fsError) {
    logger.warn(
      "Local filesystem write failed (likely read-only serverless environment). Evaluating inline fallback.",
      {
        error: fsError instanceof Error ? fsError.message : String(fsError),
        key,
      },
    );
    if (file.length > MAX_INLINE_FALLBACK_BYTES) {
      return { success: false, error: "Storage destination is unwritable" };
    }
    const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file);
    const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
    return { success: true, url: dataUrl, key, size: file.length };
  }
}

async function deleteFromLocal(key: string): Promise<DeleteResult> {
  if (key.startsWith("data:")) return { success: true };
  const fs = await import("node:fs/promises");
  const path = await import("node:path");

  // SECURITY: Resolve and strictly verify path stays within uploadsRoot.
  // path.join alone does not prevent traversal (e.g. key = "../../.env").
  const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
  const filePath = path.resolve(uploadsRoot, key);
  if (!filePath.startsWith(uploadsRoot + path.sep) && filePath !== uploadsRoot) {
    logger.error("Path traversal attempt blocked in deleteFromLocal", { key, filePath });
    return { success: false, error: "Invalid storage key" };
  }

  try {
    await fs.unlink(filePath);
    logger.debug("Local file deleted", { filePath });
    return { success: true };
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      // File already gone treat as success
      return { success: true };
    }
    logger.error("Local file delete failed", err, { filePath });
    return { success: false, error: "Local file deletion failed" };
  }
}

async function deleteFromS3(key: string): Promise<DeleteResult> {
  const client = getS3Client();
  if (!client) {
    return { success: false, error: "S3 not configured" };
  }

  await client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  return { success: true };
}

/**
 * Sanitize raster image buffers with Sharp:
 * - Strip EXIF / GPS metadata to prevent geolocation leaks
 * - Limit input pixels (25 megapixels) to prevent decompression bomb attacks
 * - Normalize and re-encode
 */
export async function sanitizeImageWithSharp(
  buffer: Buffer,
  mimeType: string,
): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  try {
    const sharpModule = await import("sharp");
    const sharp = sharpModule.default;

    // Limit input pixels to 25 megapixels (e.g. 5000x5000) to protect against decompression bombs
    const image = sharp(buffer, { limitInputPixels: 25000000 });
    const metadata = await image.metadata();

    if (!metadata.format) {
      return { success: false, error: "Unrecognized or corrupted image format" };
    }

    let processed: Buffer;
    if (metadata.format === "jpeg") {
      processed = await image.rotate().jpeg({ quality: 85 }).toBuffer();
    } else if (metadata.format === "png") {
      processed = await image.rotate().png({ compressionLevel: 8 }).toBuffer();
    } else if (metadata.format === "webp") {
      processed = await image.rotate().webp({ quality: 85 }).toBuffer();
    } else {
      processed = await image.toBuffer();
    }

    return { success: true, buffer: processed };
  } catch (error) {
    logger.warn("Sharp image sanitization failed", { error, mimeType });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Image processing failed",
    };
  }
}

/**
 * Delete all storage objects under a user's prefix across all categories.
 * Ensures complete GDPR/DPDP file deletion during user account removal.
 */
export async function deleteUserObjectsByPrefix(userId: string): Promise<number> {
  const client = getS3Client();
  const bucket = process.env.S3_BUCKET || S3_BUCKET;
  if (!client || !bucket || !userId) {
    return 0;
  }

  const { ListObjectsV2Command, DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
  const folders: UploadFolder[] = ["verification", "content", "avatars", "logos", "posts", "feedback", "chat"];
  let totalDeleted = 0;
  const safeUserId = sanitizePathSegment(userId);

  for (const folder of folders) {
    const prefix = `${folder}/${safeUserId}/`;
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 1000,
      });

      const response = await client.send(listCommand);
      if (response.Contents && response.Contents.length > 0) {
        const objectsToDelete = response.Contents.filter((obj) => obj.Key).map((obj) => ({ Key: obj.Key! }));
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: objectsToDelete },
          }),
        );
        totalDeleted += objectsToDelete.length;
        logger.info(`Deleted ${objectsToDelete.length} storage objects for user prefix ${prefix}`);
      }
    } catch (err) {
      logger.error(`Error deleting storage prefix ${prefix}`, err);
    }
  }

  return totalDeleted;
}

/**
 * Post-upload verification confirming an object exists in storage, matches size/MIME rules,
 * and contains clean magic bytes (sniffing for embedded XSS/SVG/HTML).
 * If invalid, automatically deletes the malicious object from storage.
 */
export async function confirmUploadedObject(
  key: string,
  userId: string,
): Promise<{ success: boolean; size?: number; contentType?: string; error?: string }> {
  const client = getS3Client();
  const bucket = process.env.S3_BUCKET || S3_BUCKET;

  const parts = key.split("/");
  if (parts.length < 3) {
    return { success: false, error: "Invalid storage key format" };
  }

  const folder = parts[0] as UploadFolder;
  const keyUserId = parts[1];

  if (!Object.keys(STORAGE_LIMITS).includes(folder)) {
    return { success: false, error: "Invalid storage category" };
  }

  if (keyUserId !== sanitizePathSegment(userId)) {
    return { success: false, error: "Unauthorized: Storage key does not belong to user" };
  }

  if (!client || !bucket) {
    return { success: true, size: 1024, contentType: "application/octet-stream" };
  }

  const { HeadObjectCommand, GetObjectCommand } = await import("@aws-sdk/client-s3");

  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    const size = head.ContentLength || 0;
    const contentType = head.ContentType || "application/octet-stream";
    const ext = key.split(".").pop() || "";

    try {
      validateStorageCategory(folder, contentType, ext, size);
    } catch (valErr) {
      await deleteFile(key);
      return { success: false, error: (valErr as Error).message };
    }

    // Sniff first 4KB for magic bytes and XSS/SVG payloads
    const getObj = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        Range: "bytes=0-4095",
      }),
    );

    if (getObj.Body) {
      const bytes = new Uint8Array(await getObj.Body.transformToByteArray());
      const textHeader = new TextDecoder().decode(bytes.slice(0, 256)).toLowerCase();

      if (
        textHeader.includes("<svg") ||
        textHeader.includes("<?xml") ||
        textHeader.includes("<!doctype html") ||
        textHeader.includes("<html") ||
        textHeader.includes("<script")
      ) {
        await deleteFile(key);
        return { success: false, error: "Malicious script or SVG content detected. Object deleted." };
      }
    }

    return { success: true, size, contentType };
  } catch (err) {
    logger.error("Error confirming uploaded object", err, { key });
    return { success: false, error: "Uploaded object verification failed" };
  }
}

export function sanitizeFileName(name: string): string {
  const sanitized = String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/^[.-]+/, "")
    .replace(/-+/g, "-")
    .slice(0, 100);
  return sanitized || "file";
}


