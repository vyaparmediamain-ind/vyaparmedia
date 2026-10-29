/**
 * Direct-to-Storage Client Upload Utility
 * Handles fail-fast client-side validation and non-blocking background uploads
 * directly to S3 / Cloudflare R2 presigned URLs with smooth progress reporting.
 */
import { apiClient } from "@/lib/api-client";


export const MAX_DELIVERABLE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

export const SUPPORTED_MIME_TYPES: Record<string, "image" | "video" | "document"> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "video/quicktime": "video",
  "video/webm": "video",
  "application/pdf": "document",
};

export const SUPPORTED_EXTENSIONS: Record<string, "image" | "video" | "document"> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  webp: "image",
  mp4: "video",
  mov: "video",
  webm: "video",
  pdf: "document",
};

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mediaType?: "image" | "video" | "document";
}

/**
 * Format bytes into human-readable representation (e.g., "45.2 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Client-side validation: fail fast BEFORE any network upload starts.
 */
export function validateDeliverableFile(file: File): FileValidationResult {
  if (!file) {
    return { valid: false, error: "No file selected." };
  }

  // 1. File size check (100MB limit)
  if (file.size > MAX_DELIVERABLE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File is too large (${formatFileSize(file.size)}). Maximum allowed size is 100 MB.`,
    };
  }

  if (file.size === 0) {
    return { valid: false, error: "The selected file is empty." };
  }

  // 2. MIME type & extension check
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const mediaTypeByExt = SUPPORTED_EXTENSIONS[ext];
  const mediaTypeByMime = SUPPORTED_MIME_TYPES[file.type];

  const mediaType = mediaTypeByMime || mediaTypeByExt;

  if (!mediaType) {
    return {
      valid: false,
      error: `Unsupported file format (.${ext || "unknown"}). Supported formats are MP4, MOV, WEBM, JPG, PNG, and WEBP.`,
    };
  }

  return { valid: true, mediaType };
}

export interface DirectUploadOptions {
  folder?: "content" | "posts";
  onProgress?: (percent: number, loaded: number, total: number) => void;
  signal?: AbortSignal;
}

export interface DirectUploadResult {
  fileUrl: string;
  key: string;
  fileName: string;
  fileSize: number;
  mediaType: "image" | "video" | "document";
}

/**
 * Perform a direct-to-storage upload with XMLHttpRequest to keep the UI
 * completely responsive and report real-time upload progress.
 */
export async function uploadFileDirectly(
  file: File,
  options: DirectUploadOptions = {},
): Promise<DirectUploadResult> {
  // 1. Fail fast client-side check
  const validation = validateDeliverableFile(file);
  if (!validation.valid || !validation.mediaType) {
    throw new Error(validation.error || "File validation failed");
  }

  const { folder = "content", onProgress, signal } = options;

  // 2. Request presigned upload credentials from backend
  const presignData = await apiClient.upload.presign(
    {
      fileName: file.name,
      fileType: file.type || `video/${file.name.split(".").pop() || "mp4"}`,
      fileSize: file.size,
      folder,
    },
    signal ? { signal } : undefined,
  );

  const { uploadUrl, fileUrl, key, method, isDirect, headers } = presignData.data || {};

  if (!uploadUrl) {
    throw new Error("Invalid presigned upload response from server");
  }


  // 3. Upload file bytes via XMLHttpRequest for non-blocking stream & progress events
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Abort listener
    if (signal) {
      signal.addEventListener("abort", () => {
        xhr.abort();
        reject(new DOMException("Upload cancelled by user", "AbortError"));
      });
    }

    // Real-time progress updates (runs without blocking main UI loop)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        onProgress(percent, event.loaded, event.total);
      }
    };

    xhr.onload = () => {
      // Direct S3/R2 PUT returns 200 or 204
      // Fallback local POST returns 200 with json
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(100, file.size, file.size);

        let finalUrl = fileUrl;
        if (!isDirect) {
          try {
            const parsed = JSON.parse(xhr.responseText);
            if (parsed.data?.url) {
              finalUrl = parsed.data.url;
            }
          } catch {
            // Keep fallback fileUrl
          }
        }

        resolve({
          fileUrl: finalUrl,
          key,
          fileName: file.name,
          fileSize: file.size,
          mediaType: validation.mediaType!,
        });
      } else {
        reject(new Error(`Storage upload failed (HTTP ${xhr.status}): ${xhr.statusText || "Server error"}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error during file upload. Please check your internet connection and retry."));
    };

    xhr.ontimeout = () => {
      reject(new Error("Upload timed out. Please retry with a stable connection."));
    };

    // Initialize request
    if (isDirect && method === "PUT") {
      xhr.open("PUT", uploadUrl, true);
      // Set headers from presigned URL config
      if (headers) {
        Object.entries(headers).forEach(([headerKey, headerVal]) => {
          xhr.setRequestHeader(headerKey, String(headerVal));
        });
      }
      xhr.send(file);
    } else {
      // Local development fallback via FormData
      xhr.open("POST", uploadUrl, true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);
      xhr.send(formData);
    }
  });
}
