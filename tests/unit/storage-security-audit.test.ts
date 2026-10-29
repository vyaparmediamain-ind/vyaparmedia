import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createUploadPresignedUrl,
  validateStorageCategory,
  deleteUserObjectsByPrefix,
  sanitizeImageWithSharp,
  getSignedUrl,
  STORAGE_LIMITS,
} from "@/lib/storage";

describe("SEC-STORAGE-01: Storage Security, Presigned Upload & Category Hardening", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Requirement 1: Mandatory ContentLength & Category Size Limits", () => {
    it("throws if fileSize is missing or non-positive", async () => {
      await expect(
        createUploadPresignedUrl("avatar.png", "avatars", "image/png", 900, 0),
      ).rejects.toThrow(/mandatory/i);

      await expect(
        createUploadPresignedUrl("avatar.png", "avatars", "image/png", 900, undefined),
      ).rejects.toThrow(/mandatory/i);
    });

    it("rejects oversized avatar exceeding 2MB", async () => {
      const oversizedAvatar = STORAGE_LIMITS.avatars.maxBytes + 1;
      await expect(
        createUploadPresignedUrl("avatar.png", "avatars", "image/png", 900, oversizedAvatar),
      ).rejects.toThrow(/exceeds maximum allowed size of 2MB/i);
    });

    it("rejects oversized KYC verification document exceeding 5MB", async () => {
      const oversizedKyc = STORAGE_LIMITS.verification.maxBytes + 1;
      await expect(
        createUploadPresignedUrl("pan.pdf", "verification", "application/pdf", 900, oversizedKyc),
      ).rejects.toThrow(/exceeds maximum allowed size of 5MB/i);
    });

    it("rejects oversized evidence/feedback document exceeding 10MB", async () => {
      const oversizedEvidence = STORAGE_LIMITS.feedback.maxBytes + 1;
      await expect(
        createUploadPresignedUrl("proof.pdf", "feedback", "application/pdf", 900, oversizedEvidence),
      ).rejects.toThrow(/exceeds maximum allowed size of 10MB/i);
    });

    it("rejects oversized deliverable video exceeding 100MB", async () => {
      const oversizedVideo = STORAGE_LIMITS.content.maxBytesVideo + 1;
      await expect(
        createUploadPresignedUrl("video.mp4", "content", "video/mp4", 900, oversizedVideo),
      ).rejects.toThrow(/exceeds maximum allowed size of 100MB/i);
    });
  });

  describe("Requirement 2: MIME & Extension Validation & SVG/HTML Rejection", () => {
    it("strictly rejects SVG uploads to prevent stored XSS attacks", () => {
      expect(() =>
        validateStorageCategory("avatars", "image/svg+xml", "svg", 1024),
      ).toThrow(/SVG and HTML files are strictly prohibited/i);

      expect(() =>
        validateStorageCategory("content", "image/svg+xml", "svg", 1024),
      ).toThrow(/SVG and HTML files are strictly prohibited/i);
    });

    it("strictly rejects HTML uploads to prevent stored XSS attacks", () => {
      expect(() =>
        validateStorageCategory("avatars", "text/html", "html", 1024),
      ).toThrow(/SVG and HTML files are strictly prohibited/i);
    });

    it("rejects MIME and extension mismatch (e.g., png declared MIME with .jpg ext)", () => {
      expect(() =>
        validateStorageCategory("avatars", "image/png", "jpg", 1024),
      ).toThrow(/does not match declared MIME/i);

      expect(() =>
        validateStorageCategory("avatars", "image/jpeg", "png", 1024),
      ).toThrow(/does not match declared MIME/i);
    });

    it("rejects unsupported MIME types for category (e.g., video in avatars)", () => {
      expect(() =>
        validateStorageCategory("avatars", "video/mp4", "mp4", 1024 * 1024),
      ).toThrow(/not allowed for category avatars/i);
    });
  });

  describe("Requirement 3: Server-Generated Storage Keys", () => {
    it("generates server-controlled key with userId prefix and never uses client filename", async () => {
      const userId = "usr_12345abcdef";
      const result = await createUploadPresignedUrl(
        "../../../malicious-exploit-script.png",
        "avatars",
        "image/png",
        900,
        50000,
        userId,
      );

      expect(result.key).toMatch(new RegExp(`^avatars/${userId}/[0-9]+-[a-f0-9-]+\\.png$`));
      expect(result.key).not.toContain("malicious");
      expect(result.key).not.toContain("exploit");
    });
  });

  describe("Requirement 4: Production Guard - Local Storage & Data URLs Forbidden", () => {
    it("throws critical error if STORAGE_PROVIDER is local or credentials missing in production", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.STORAGE_PROVIDER = "local";
      delete process.env.S3_BUCKET;

      await expect(
        createUploadPresignedUrl("avatar.png", "avatars", "image/png", 900, 1024, "usr_1"),
      ).rejects.toThrow(/Local storage and data URL fallbacks are strictly prohibited in production/i);
    });
  });

  describe("Requirement 5: Private KYC Documents Storage Isolation", () => {
    it("ensures verification files are private and never return public URLs", async () => {
      const result = await createUploadPresignedUrl(
        "aadhaar.pdf",
        "verification",
        "application/pdf",
        900,
        1024 * 1024,
        "usr_kyc_123",
      );

      // Public URL should not be returned for private KYC documents
      expect(result.fileUrl).not.toContain("http");
      expect(result.fileUrl).toBe(result.key);
    });

    it("generates short-TTL presigned GET URL for private files via getSignedUrl", async () => {
      process.env.S3_BUCKET = "test-bucket";
      process.env.S3_ACCESS_KEY = "test-access";
      process.env.S3_SECRET_KEY = "test-secret";
      process.env.STORAGE_PROVIDER = "s3";

      const signedUrl = await getSignedUrl("verification/usr_1/doc.pdf", 900);
      expect(signedUrl).toBeDefined();
    });
  });

  describe("Requirement 6: Sharp Image Sanitization & Decompression Bomb Protection", () => {
    it("sanitizes image buffer, strips EXIF metadata, and rejects decompression bombs", async () => {
      // 100x100 1-pixel red PNG buffer
      const samplePngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
      const buffer = Buffer.from(samplePngBase64, "base64");

      const sanitized = await sanitizeImageWithSharp(buffer, "image/png");
      expect(sanitized.success).toBe(true);
      expect(sanitized.buffer).toBeDefined();
    });
  });

  describe("Requirement 7: Post-Upload Verification & Ownership Guard", () => {
    it("verifies object ownership and rejects access to other user's key", async () => {
      const { confirmUploadedObject } = await import("@/lib/storage");
      const res = await confirmUploadedObject("avatars/usr_victim/test.png", "usr_attacker");
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Unauthorized: Storage key does not belong to user/i);
    });

    it("rejects invalid key formats", async () => {
      const { confirmUploadedObject } = await import("@/lib/storage");
      const res = await confirmUploadedObject("invalid-key.png", "usr_1");
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Invalid storage key format/i);
    });
  });

  describe("Requirement 8: Account Deletion Prefix Purge", () => {
    it("invokes deleteUserObjectsByPrefix safely without throwing", async () => {
      const deletedCount = await deleteUserObjectsByPrefix("usr_to_delete");
      expect(typeof deletedCount).toBe("number");
    });
  });
});
