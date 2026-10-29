/**
 * File Upload Size & Storage Constants (in Bytes)
 */

export const BYTES_PER_KB = 1024;
export const BYTES_PER_MB = 1024 * 1024;

// Specific File Size Limits
export const MAX_IMAGE_SIZE_BYTES = 5 * BYTES_PER_MB; // 5 MB
export const MAX_DOCUMENT_SIZE_BYTES = 10 * BYTES_PER_MB; // 10 MB (KYC documents, PDF statements)
export const MAX_VIDEO_SIZE_BYTES = 50 * BYTES_PER_MB; // 50 MB (Chat video attachments)
export const MAX_DELIVERABLE_SIZE_BYTES = 100 * BYTES_PER_MB; // 100 MB (Full content deliverables)

// Default API Payload Limits
export const DEFAULT_MAX_API_BODY_BYTES = 2 * BYTES_PER_MB; // 2 MB
export const MULTIPART_UPLOAD_MAX_BYTES = 50 * BYTES_PER_MB; // 50 MB
