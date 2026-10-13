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

function validateStorageConfig() {
  if (isProduction && (!process.env.STORAGE_PROVIDER || process.env.STORAGE_PROVIDER === "local") && !S3_BUCKET) {
    logger.warn(
      "STORAGE_PROVIDER is unset or set to 'local' in production. S3/R2 credentials missing. Using data URL fallback for serverless compatibility.",
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
): Promise<UploadResult> {
validateStorageConfig();
const key = `${folder}/${Date.now()}-${randomUUID()}-${sanitizeFileName(fileName)}`;

try {
    switch (STORAGE_PROVIDER) {
      case "s3":
      case "r2":
        return await uploadToS3(file, key, contentType);

      case "local":
      default:
        return await uploadToLocal(file, key, contentType);
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
): Promise<UploadResult> {
const buffer = Buffer.from(await formFile.arrayBuffer());
return uploadFile(buffer, formFile.name, folder, formFile.type);
}

/**
* Upload from a base64 string.
*/
export async function uploadBase64(
base64: string,
fileName: string,
folder: UploadFolder,
contentType: string = "image/png",
): Promise<UploadResult> {
// Remove data URL prefix if present
const data = base64.replace(/^data:[^;]+;base64,/, "");
const buffer = Buffer.from(data, "base64");
return uploadFile(buffer, fileName, folder, contentType);
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
  expiresInSeconds: number = 3600,
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
    { expiresIn: expiresInSeconds },
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
): Promise<PresignedUploadResult> {
  validateStorageConfig();
  const key = `${folder}/${Date.now()}-${randomUUID()}-${sanitizeFileName(fileName)}`;

  if (STORAGE_PROVIDER === "local" || !S3_ACCESS_KEY || !S3_SECRET_KEY || !S3_BUCKET) {
    return {
      uploadUrl: "/api/upload",
      fileUrl: `/uploads/${key}`,
      key,
      method: "POST",
      isDirect: false,
    };
  }

  const client = getS3Client();
  if (!client) {
    return {
      uploadUrl: "/api/upload",
      fileUrl: `/uploads/${key}`,
      key,
      method: "POST",
      isDirect: false,
    };
  }

  const presignedUrl = await createPresignedUrl(
    client,
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentDisposition: key.startsWith("verification/") ? "attachment" : "inline",
      ...(fileSize && fileSize > 0 ? { ContentLength: fileSize } : {}),
      CacheControl: key.startsWith("verification/")
        ? "private, no-cache, no-store"
        : "public, max-age=31536000, immutable",
    }),
    { expiresIn: expiresInSeconds },
  );

  return {
    uploadUrl: presignedUrl,
    fileUrl: getObjectUrl(key),
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
      return { success: false, error: "Cloud storage is not configured for production environment" };
    }
    const error = "S3/R2 credentials are not fully configured";
    logger.warn(`${error} - falling back to local/data-URL storage in non-production mode`);
    return uploadToLocal(file, key, contentType);
  }

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: file,
        ContentType: contentType,
        ContentDisposition: key.startsWith("verification/") ? "attachment" : "inline",
        CacheControl: key.startsWith("verification/")
          ? "private, no-cache, no-store"
          : "public, max-age=31536000, immutable",
      }),
    );

    return {
      success: true,
      url: getObjectUrl(key),
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
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const MAX_INLINE_FALLBACK_BYTES = 512 * 1024; // 512 KB safeguard

  if (isServerless && !S3_BUCKET) {
    if (isProduction) {
      logger.critical("PRODUCTION_STORAGE_ERROR: Serverless production cannot write local files without S3 bucket.");
      return { success: false, error: "Cloud storage bucket required in production serverless environment" };
    }
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

    const url = `/uploads/${key}`;
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
    if (isProduction || file.length > MAX_INLINE_FALLBACK_BYTES) {
      logger.critical("Local storage write failed and inline data URL is prohibited due to size or production safety", {
        isProduction,
        size: file.length,
      });
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

function sanitizeFileName(name: string): string {
  const sanitized = String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/^[.-]+/, "")
    .replace(/-+/g, "-")
    .slice(0, 100);
  return sanitized || "file";
}


