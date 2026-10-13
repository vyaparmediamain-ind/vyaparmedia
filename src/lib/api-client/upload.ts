/**
 * apiClient.upload — File upload API call.
 *
 * Uses FormData (multipart), so Content-Type is NOT set manually
 * (the browser sets it with the correct boundary).
 */
import { http, post } from "./http";
import type { HttpOptions } from "./http";

export interface UploadResponse {
  success: boolean;
  data?: { url: string; key?: string };
  url?: string;
  message?: string;
  error?: string;
}

/**
 * POST /api/upload
 * @param file  The File object from an <input type="file">
 * @param folder  Optional upload folder/category (e.g. "content", "avatar")
 */
export async function file(
  fileObj: File,
  folder?: string,
  options?: HttpOptions,
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", fileObj);
  formData.append("folder", folder || "content");

  // Do NOT set Content-Type — browser sets it with multipart boundary
  return http<UploadResponse>("/api/upload", {
    method: "POST",
    body: formData,
    ...options,
  });
}

/**
 * POST /api/upload/presign — generate presigned upload URL for direct storage uploads
 */
export function presign(
  data: {
    fileName: string;
    fileType: string;
    fileSize: number;
    folder?: string;
    [key: string]: unknown;
  },
  options?: HttpOptions,
) {
  return post<{
    success: boolean;
    data: {
      uploadUrl: string;
      fileUrl: string;
      key: string;
      method: string;
      isDirect: boolean;
      headers?: Record<string, string>;
    };
  }>("/api/upload/presign", data, options);
}

