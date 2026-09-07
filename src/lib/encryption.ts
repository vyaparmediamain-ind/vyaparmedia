import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
/**
* Encryption utilities for sensitive data (bank account numbers, etc.)
* Uses AES-256-GCM with per-record random IVs.
*
* Support for key rotation:
* - Encryption always uses the LATEST version.
* - Decryption checks the version prefix (e.g., "v1:") and selects the appropriate key.
*
* Required env: ENCRYPTION_KEYS (map of version:key, e.g., "v1:64hex,v2:64hex")
*/

import { createCipheriv, createDecipheriv, randomBytes, createHmac } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard
const ENCODING_HEX = "hex";

/**
* Get all available keys from environment.
* Format: "v1:hex,v2:hex"
*/
function getAllKeys(): Map<string, Buffer> {
const keysStr = process.env.ENCRYPTION_KEYS;
if (!keysStr) {
// Fallback if only single key exists for backward compatibility
const singleKey = process.env.ENCRYPTION_KEY;
if (singleKey?.length === 64) {
return new Map([["v1", Buffer.from(singleKey, ENCODING_HEX)]]);
}
throw AppError.internal("ENCRYPTION_KEYS or ENCRYPTION_KEY env var is required.");
}

const keysMap = new Map<string, Buffer>();
keysStr.split(",").forEach((pair) => {
const [ver, keyHex] = pair.split(":");
if (ver && keyHex?.length === 64) {
keysMap.set(ver, Buffer.from(keyHex, ENCODING_HEX));
}
});

if (keysMap.size === 0) {
throw AppError.internal("No valid keys found in ENCRYPTION_KEYS.");
}

return keysMap;
}

/**
* Get the latest key version and its buffer.
*/
function getLatestKey(): { version: string; key: Buffer } {
const keys = getAllKeys();
const versions = Array.from(keys.keys()).sort((a, b) =>
b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' })
);

const latestVersion = versions[0];
if (!latestVersion) {
throw AppError.internal("CRITICAL: No versioned encryption keys found in ENCRYPTION_KEYS mapping.");
}

const key = keys.get(latestVersion);
if (!key) {
throw AppError.internal(`CRITICAL: Key buffer missing for version ${latestVersion}`);
}

return { version: latestVersion, key };
}

/**
* Encrypt a plaintext value.
* Returns format: {version}:{iv}:{authTag}:{ciphertext}
*/
export function encrypt(plaintext: string): string {
if (typeof plaintext !== "string" || !plaintext) {
return plaintext;
}
const { version, key } = getLatestKey();
const iv = randomBytes(IV_LENGTH);
const cipher = createCipheriv(ALGORITHM, key, iv);

let encrypted = cipher.update(plaintext, "utf8", ENCODING_HEX);
encrypted += cipher.final(ENCODING_HEX);

const authTag = cipher.getAuthTag();

// New persistent format: version:iv:authTag:ciphertext
return `${version}:${iv.toString(ENCODING_HEX)}:${authTag.toString(ENCODING_HEX)}:${encrypted}`;
}

/**
* Decrypt a value previously encrypted.
* Detects version from prefix or attempts legacy v1 if no prefix.
*/
export function decrypt(encryptedData: string): string {
if (typeof encryptedData !== "string" || !encryptedData) return encryptedData;
const parts = encryptedData.split(":");
const looksEncrypted =
(parts.length === 4 && /^v\d+$/i.test(parts[0] || "") && parts[1]?.length === 24 && parts[2]?.length === 32) ||
(parts.length === 3 && parts[0]?.length === 24 && parts[1]?.length === 32);

if (!looksEncrypted) {
return encryptedData;
}

let version = "v1";
let ivHex: string, authTagHex: string, ciphertext: string;

if (parts.length === 4) {
// Current versioned format: vN:iv:authTag:ciphertext
version = parts[0]!;
ivHex = parts[1]!;
authTagHex = parts[2]!;
ciphertext = parts[3]!;
} else {
// Legacy format (no version prefix, assume v1)
ivHex = parts[0]!;
authTagHex = parts[1]!;
ciphertext = parts[2]!;
}


const keys = getAllKeys();
const key = keys.get(version);

if (!key) {
throw AppError.internal(`Encryption key version ${version} not found in environment.`);
}

const iv = Buffer.from(ivHex, ENCODING_HEX);
const authTag = Buffer.from(authTagHex, ENCODING_HEX);

const decipher = createDecipheriv(ALGORITHM, key, iv);
decipher.setAuthTag(authTag);

let decrypted = decipher.update(ciphertext, ENCODING_HEX, "utf8");
decrypted += decipher.final("utf8");

return decrypted;
}

/**
 * Safely attempt decryption, returning the raw value if not encrypted or if decryption fails.
 */
export function tryDecrypt(value?: string | null): string {
  if (!value) return "";
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}




/**
* Mask a bank account number, showing only the last 4 digits.
* Works on both plain and encrypted values (decrypts first if encrypted).
*/
export function maskAccountNumber(value: string): string {
  if (!value) return "";
  let plaintext = tryDecrypt(value);
  if (!plaintext || plaintext.includes(":")) {
    plaintext = value;
  }
  const digits = plaintext.replace(/\D/g, "");
  const last4 = digits.length >= 4 ? digits.slice(-4) : (plaintext.slice(-4) || "XXXX");
  return `•••• •••• ${last4}`;
}

/**
* Mask a UPI ID, showing only the first 2 characters of the local part.
* Works on both plain and encrypted values (decrypts first if encrypted).
*/
export function maskUpiId(value: string): string {
let plaintext: string;

const parts = value.split(":");
const looksEncrypted =
(parts.length === 4 && /^v\d+$/i.test(parts[0] || "")) ||
parts.length === 3;

if (looksEncrypted) {
try {
plaintext = decrypt(value);
} catch (e) {
logger.warn("maskUpiId decryption failed, falling back to plaintext", { error: e });
plaintext = value;
}
} else {
plaintext = value;
}

const [local, domain] = plaintext.split("@");
if (!local || !domain) return "Configured";
return `${local.slice(0, 2)}***@${domain}`;
}

/**
* Generate a deterministic HMAC-SHA256 hash for duplicate detection.
* Uses a separate HMAC key from ENCRYPTION_KEYS for security.
* This allows efficient indexed lookups without decrypting all records.
*/
export function hashForDuplicateDetection(value: string): string {
  const hmacKey = process.env.HMAC_KEY;
  if (!hmacKey) {
    throw AppError.badRequest("HMAC_KEY env var is required for duplicate detection hashing.");
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  const key = Buffer.from(hmacKey, "hex");
  const hmac = createHmac("sha256", key);
  hmac.update(normalized);
  return hmac.digest("hex");
}
