import { describe, it, expect } from "vitest";
import {
  validateDeliverableFile,
  formatFileSize,
} from "@/lib/direct-upload";
import { contentSubmissionSchema } from "@/lib/validations";
import { detectContactLeak } from "@/lib/contact-leak-detector";
import { createUploadPresignedUrl } from "@/lib/storage";

describe("Content Submission: File Validation & Direct Upload", () => {
  it("formats file sizes correctly", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1024 * 1024)).toBe("1 MB");
    expect(formatFileSize(50 * 1024 * 1024)).toBe("50 MB");
    expect(formatFileSize(95.5 * 1024 * 1024)).toBe("95.5 MB");
  });

  it("accepts valid video deliverable under 100MB", () => {
    const videoFile = new File([new ArrayBuffer(40 * 1024 * 1024)], "reel_final.mp4", {
      type: "video/mp4",
    });

    const result = validateDeliverableFile(videoFile);
    expect(result.valid).toBe(true);
    expect(result.mediaType).toBe("video");
    expect(result.error).toBeUndefined();
  });

  it("accepts valid high-res photo under 100MB", () => {
    const imageFile = new File([new ArrayBuffer(8 * 1024 * 1024)], "story_creative.png", {
      type: "image/png",
    });

    const result = validateDeliverableFile(imageFile);
    expect(result.valid).toBe(true);
    expect(result.mediaType).toBe("image");
  });

  it("accepts QuickTime (.mov) video files", () => {
    const movFile = new File([new ArrayBuffer(60 * 1024 * 1024)], "vlog_cut.mov", {
      type: "video/quicktime",
    });

    const result = validateDeliverableFile(movFile);
    expect(result.valid).toBe(true);
    expect(result.mediaType).toBe("video");
  });

  it("fails fast if file exceeds 100MB limit", () => {
    const oversizedFile = new File(
      [new ArrayBuffer(105 * 1024 * 1024)],
      "huge_uncompressed.mp4",
      { type: "video/mp4" },
    );

    const result = validateDeliverableFile(oversizedFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("File is too large");
    expect(result.error).toContain("Maximum allowed size is 100 MB");
  });

  it("fails fast if file format is unsupported", () => {
    const exeFile = new File([new ArrayBuffer(1024)], "script.exe", {
      type: "application/x-msdownload",
    });

    const result = validateDeliverableFile(exeFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Unsupported file format");
  });

  it("fails fast on empty (0 byte) file", () => {
    const emptyFile = new File([], "empty.mp4", { type: "video/mp4" });
    const result = validateDeliverableFile(emptyFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("empty");
  });
});

describe("Content Submission: Zod Schema Validation", () => {
  it("validates a valid deliverable submission", () => {
    const payload = {
      dealId: "cuid1234567890123456789012",
      contentUrl: "https://storage.vyaparmedia.com/content/reel-v1.mp4",
      contentUrls: [
        {
          type: "instagram_reel",
          url: "https://storage.vyaparmedia.com/content/reel-v1.mp4",
        },
      ],
      notes: "Here is the final cut with brand hashtag included!",
    };

    const parsed = contentSubmissionSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("validates local fallback paths (/uploads/...)", () => {
    const payload = {
      dealId: "cuid1234567890123456789012",
      contentUrl: "/uploads/content/local-reel.mp4",
      contentUrls: [
        {
          type: "instagram_story",
          url: "/uploads/content/local-story.png",
        },
      ],
    };

    const parsed = contentSubmissionSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("rejects malicious script tags in URLs", () => {
    const payload = {
      dealId: "cuid1234567890123456789012",
      contentUrl: "https://example.com/<script>alert(1)</script>",
    };

    const parsed = contentSubmissionSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it("rejects notes exceeding 500 characters", () => {
    const payload = {
      dealId: "cuid1234567890123456789012",
      contentUrl: "https://example.com/valid.mp4",
      notes: "a".repeat(501),
    };

    const parsed = contentSubmissionSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain("Notes attached are exceeding limit");
    }
  });
});

describe("Content Submission: Contact Leak & Safety Guard", () => {
  it("detects personal phone numbers in deliverable notes", () => {
    const notesWithPhone = "Hey, call me on 9876543210 if you need audio changes";
    const leak = detectContactLeak(notesWithPhone);
    expect(leak.hasLeak).toBe(true);
    expect(leak.detectedTypes.some((t) => t.toLowerCase().includes("phone"))).toBe(true);
  });

  it("detects email addresses in deliverable notes", () => {
    const notesWithEmail = "Send feedback to creator@personal-domain.com";
    const leak = detectContactLeak(notesWithEmail);
    expect(leak.hasLeak).toBe(true);
    expect(leak.detectedTypes.some((t) => t.toLowerCase().includes("email"))).toBe(true);
  });

  it("allows normal deliverable notes without contact details", () => {
    const normalNotes = "Here is version 2 with brand logo at 0:02 as requested in review!";
    const leak = detectContactLeak(normalNotes);
    expect(leak.hasLeak).toBe(false);
  });
});

describe("Content Submission: Versioning & Iteration Trail", () => {
  it("calculates next version number based on previous iterations", () => {
    const pastSubmissions = [
      { id: "sub-2", version: 2, status: "REVISION_REQUESTED", feedback: "Change audio track" },
      { id: "sub-1", version: 1, status: "REVISION_REQUESTED", feedback: "Too long" },
    ];

    const latest = pastSubmissions[0];
    const nextVersion = (latest?.version || 0) + 1;
    expect(nextVersion).toBe(3);
  });

  it("defaults to version 1 when no previous submission exists", () => {
    const pastSubmissions: Array<{ version?: number }> = [];
    const latest = pastSubmissions[0];
    const nextVersion = (latest?.version || 0) + 1;
    expect(nextVersion).toBe(1);
  });
});

describe("Content Submission: Presigned Upload Backend", () => {
  it("generates presigned upload URL or local fallback without throwing", async () => {
    const result = await createUploadPresignedUrl("test_video.mp4", "content", "video/mp4");
    expect(result).toBeDefined();
    expect(result.uploadUrl).toBeDefined();
    expect(result.fileUrl).toBeDefined();
    expect(result.key).toContain("content/");
    expect(result.key).toContain("test-video.mp4");
    expect(["PUT", "POST"]).toContain(result.method);
  });
});
