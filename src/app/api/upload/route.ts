import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isBrand, isInfluencer } from "@/lib/rbac";
type UploadSession = {
user: {
id: string;
userType: string;
status: string;
email?: string | null;
name?: string | null;
image?: string | null;
};
};
import { uploadFormFile, uploadBase64, type UploadFolder } from "@/lib/storage";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { bytesToAscii, matchesHeader } from "@/lib/utils";

function detectMimeFromMagicBytes(bytes: Uint8Array): string | null {
if (bytes.length < 12) return null;

if (matchesHeader(bytes, [0x25, 0x50, 0x44, 0x46])) return "application/pdf";
if (matchesHeader(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
if (matchesHeader(bytes, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
if (matchesHeader(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";

// WEBP: RIFF....WEBP
if (
bytesToAscii(bytes.slice(0, 4)) === "RIFF" &&
bytesToAscii(bytes.slice(8, 12)) === "WEBP"
) {
return "image/webp";
}

// WEBM (EBML)
if (matchesHeader(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";

// MP4 / MOV / HEIC (ftyp box at offset 4)
if (bytesToAscii(bytes.slice(4, 8)) === "ftyp") {
const brand = bytesToAscii(bytes.slice(8, 12)).toLowerCase();

if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
return "image/heic";
}
if (brand === "qt ") {
return "video/quicktime";
}
if (
["isom", "iso2", "avc1", "mp41", "mp42", "3gp4", "3gp5"].includes(brand)
) {
return "video/mp4";
}
}

return null;
}

function isExtensionCompatible(mimeType: string, extension: string): boolean {
const map: Record<string, string[]> = {
"image/jpeg": ["jpg", "jpeg"],
"image/png": ["png"],
"image/webp": ["webp"],
"image/gif": ["gif"],
"image/heic": ["heic", "heif"],
"video/mp4": ["mp4"],
"video/webm": ["webm"],
"video/quicktime": ["mov", "qt"],
"application/pdf": ["pdf"],
};

return (map[mimeType] || []).includes(extension);
}

function isImageMime(mimeType: string) {
return mimeType.startsWith("image/");
}

function isContentMime(mimeType: string) {
return mimeType.startsWith("image/") || mimeType.startsWith("video/");
}

function canUploadToFolder(
userType: string | null | undefined,
folder: string,
mimeType: string,
) {
if (folder === "chat") return true;
if (folder === "avatars") return isImageMime(mimeType);
if (folder === "logos") return isBrand(userType) && isImageMime(mimeType);
if (folder === "content" || folder === "posts") {
return isInfluencer(userType) && isContentMime(mimeType);
}
if (folder === "feedback") return isImageMime(mimeType);
return false;
}

async function _handler_POST(req: NextRequest) {
try {
const session = await auth();
if (!session?.user) {
return ApiResponse.unauthorized();
}

// Upload rate limit: max 10 uploads per hour per user
const rateLimit = await checkRateLimit(session.user.id, "UPLOAD");
if (!rateLimit.success) {
const retryAfter = Math.ceil(
rateLimit.reset - Date.now() / 1000,
);
return ApiResponse.tooManyRequests(
"Upload rate limit exceeded. Maximum 10 uploads per hour.",
retryAfter,
);
}

const contentType = req.headers.get("content-type");

// Handle base64 JSON upload
if (contentType?.includes("application/json")) {
return await handleBase64Upload(req, session);
}

// Handle multipart/form-data upload
return await handleFormDataUpload(req, session);
} catch (error) {
logger.error("Upload API error", error);
return ApiResponse.error("Internal Server Error", 500);
}
}

type Base64InputResult =
| { success: false; errorResponse: NextResponse }
| { success: true; base64: string; fileName: string; uploadFolder: string };

function parseAndValidateBase64Input(body: unknown): Base64InputResult {
const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
const { base64, fileName, folder } = record;

if (typeof base64 !== "string" || !base64) {
return { success: false, errorResponse: ApiResponse.error("Base64 data is required") };
}
if (typeof fileName !== "string" || !fileName) {
return { success: false, errorResponse: ApiResponse.error("File name is required") };
}

const uploadFolder = typeof folder === "string" ? folder : "misc";
const allowedFolders = ["avatars", "logos", "content", "posts", "feedback", "chat"];
if (!allowedFolders.includes(uploadFolder)) {
return { success: false, errorResponse: ApiResponse.error("Invalid upload folder") };
}

return { success: true, base64, fileName, uploadFolder };
}

type ConstraintsResult =
| { success: false; errorResponse: NextResponse }
| { success: true; fileExt: string; isVideo: boolean; estimatedBinarySize: number };

function validateBase64Constraints(base64: string, fileName: string): ConstraintsResult {
const base64Size = Buffer.byteLength(base64, "utf8");
const estimatedBinarySize = Math.floor(base64Size * 0.75);

const fileExt = fileName.split('.').pop()?.toLowerCase() || "";
const badExts = ["exe", "php", "sh", "bat", "js", "html"];
if (badExts.includes(fileExt)) {
return { success: false, errorResponse: ApiResponse.error("Executable/script files are strictly prohibited") };
}

const isVideo = ["mp4", "webm", "mov", "qt"].includes(fileExt);
const MAX_SIZE = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;

if (estimatedBinarySize > MAX_SIZE) {
return {
success: false,
errorResponse: ApiResponse.error(`File too large. Max size: ${isVideo ? "50MB" : "5MB"}`),
};
}

return { success: true, fileExt, isVideo, estimatedBinarySize };
}

type SignatureResult =
| { success: false; errorResponse: NextResponse }
| { success: true; mimeType: string; decodedBuffer: Buffer };

function validateBase64MimeSignature(
base64: string,
fileExt: string,
userId: string,
fileName: string
): SignatureResult {
let mimeType = "image/png";
const dataUrlMatch = /^data:([^;]+);base64,/.exec(base64);
if (dataUrlMatch?.[1]) {
mimeType = dataUrlMatch[1];
}

const rawBase64 = base64.replace(/^data:[^;]+;base64,/, "");
let decodedBuffer: Buffer;
try {
decodedBuffer = Buffer.from(rawBase64, "base64");
} catch {
return { success: false, errorResponse: ApiResponse.error("Invalid base64 encoding") };
}

const bytes = new Uint8Array(decodedBuffer.slice(0, 16));
const detectedMime = detectMimeFromMagicBytes(bytes);

if (!detectedMime) {
return { success: false, errorResponse: ApiResponse.error("Unrecognized or unsafe file signature") };
}

if (detectedMime !== mimeType) {
logger.warn("Blocked base64 MIME mismatch upload", {
userId,
declaredMime: mimeType,
detectedMime,
fileName,
});
return { success: false, errorResponse: ApiResponse.error("File type mismatch detected. Upload rejected.") };
}

if (fileExt && !isExtensionCompatible(detectedMime, fileExt)) {
return { success: false, errorResponse: ApiResponse.error("File extension does not match file content.") };
}

const ALLOWED_MIME_TYPES = [
"image/jpeg",
"image/png",
"image/webp",
"image/gif",
"image/heic",
"video/mp4",
"video/webm",
"video/quicktime",
];

if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
return {
success: false,
errorResponse: ApiResponse.error(`File type '${mimeType}' is not allowed. Only images and videos are permitted.`),
};
}

return { success: true, mimeType, decodedBuffer };
}

async function handleBase64Upload(req: NextRequest, session: UploadSession) {
try {
const body = await req.json();

const inputValidation = parseAndValidateBase64Input(body);
if (!inputValidation.success) return inputValidation.errorResponse;
const { base64, fileName, uploadFolder } = inputValidation;

const constraintsCheck = validateBase64Constraints(base64, fileName);
if (!constraintsCheck.success) return constraintsCheck.errorResponse;
const { fileExt } = constraintsCheck;

const signatureCheck = validateBase64MimeSignature(base64, fileExt, session.user.id, fileName);
if (!signatureCheck.success) return signatureCheck.errorResponse;
const { mimeType } = signatureCheck;

if (!canUploadToFolder(session.user.userType, uploadFolder, mimeType)) {
logger.warn("Blocked unauthorized base64 upload folder or MIME combination", {
userId: session.user.id,
userType: session.user.userType,
folder: uploadFolder,
mimeType,
});
return ApiResponse.forbidden(
"This account cannot upload that file type to the selected folder.",
);
}

const result = await uploadBase64(base64, fileName, uploadFolder as UploadFolder, mimeType);

if (!result.success) {
return ApiResponse.error(result.error || "Upload failed", 500);
}

return ApiResponse.success(
{ url: result.url, key: result.key },
"Upload successful",
);
} catch (error) {
logger.error("Base64 upload error", error);
return ApiResponse.error("Invalid JSON payload");
}
}

function validateUploadFile(file: File, folder: string, session: UploadSession): string | null {
if (file.size === 0) {
return "Empty file provided";
}

const fileExt = file.name.split('.').pop()?.toLowerCase();
const badExts = ["exe", "php", "sh", "bat", "js", "html"];
if (fileExt && badExts.includes(fileExt)) {
return "Executable files are strictly prohibited";
}

const ALLOWED_MIME_TYPES = [
"image/jpeg",
"image/png",
"image/webp",
"image/gif",
"image/heic",
"video/mp4",
"video/webm",
"video/quicktime",
"application/pdf",
];

if (!ALLOWED_MIME_TYPES.includes(file.type)) {
logger.warn("Blocked disallowed file type upload", {
userId: session.user.id,
mimeType: file.type,
});
return `File type '${file.type}' is not allowed. Only images, videos and PDFs are permitted.`;
}

if (file.type === "application/pdf" && folder !== "chat") {
return "PDF uploads must use the verification document flow.";
}

const MAX_SIZE = file.type.startsWith("video/")
? 50 * 1024 * 1024
: 5 * 1024 * 1024;
if (file.size > MAX_SIZE) {
return `File too large. Max size: ${file.type.startsWith("video/") ? "50MB" : "5MB"}`;
}

return null;
}

async function validateFileContentAsync(file: File, session: UploadSession): Promise<string | null> {
const arrayBuffer = await file.arrayBuffer();
const bytes = new Uint8Array(arrayBuffer.slice(0, 16));
const detectedMime = detectMimeFromMagicBytes(bytes);
if (!detectedMime) {
return "Unrecognized or unsafe file signature";
}

if (detectedMime !== file.type) {
logger.warn("Blocked MIME mismatch upload", {
userId: session.user.id,
declaredMime: file.type,
detectedMime,
fileName: file.name,
});
return "File type mismatch detected. Upload rejected.";
}

const fileExt = file.name.split('.').pop()?.toLowerCase();
if (fileExt && !isExtensionCompatible(detectedMime, fileExt)) {
return "File extension does not match file content.";
}

return null;
}

async function handleFormDataUpload(req: NextRequest, session: UploadSession) {
try {
let formData: FormData;
try {
formData = await req.formData();
} catch (error) {
logger.warn("Failed to parse form data in upload API", { error });
return ApiResponse.error("Invalid multipart payload");
}

if (!formData.has("file")) {
return ApiResponse.error("Empty multipart body");
}

const rawFile = formData.get("file");
const folder = (formData.get("folder") as string) || "misc";

const allowedFolders = ["avatars", "logos", "content", "posts", "feedback", "chat"];
if (!allowedFolders.includes(folder)) {
return ApiResponse.error("Invalid upload folder");
}

if (!(rawFile instanceof File)) {
return ApiResponse.error("No file provided or invalid file field");
}

const file = rawFile;

if (!canUploadToFolder(session.user.userType, folder, file.type)) {
logger.warn("Blocked unauthorized upload folder or MIME combination", {
userId: session.user.id,
userType: session.user.userType,
folder,
mimeType: file.type,
});
return ApiResponse.forbidden(
"This account cannot upload that file type to the selected folder.",
);
}

const fileValidationError = validateUploadFile(file, folder, session);
if (fileValidationError) {
return ApiResponse.error(fileValidationError);
}

const contentValidationError = await validateFileContentAsync(file, session);
if (contentValidationError) {
return ApiResponse.error(contentValidationError);
}

const result = await uploadFormFile(file, folder as UploadFolder);

if (!result.success) {
return ApiResponse.error(result.error || "Upload failed", 500);
}

return ApiResponse.success(
{ url: result.url, key: result.key },
"Upload successful",
);
} catch (error) {
logger.error("Form data upload error", error);
return ApiResponse.error("Internal Server Error", 500);
}
}


// Wrapped handlers via apiWrapper
export const POST = apiWrapper(_handler_POST);
