import { describe, it, expect } from "vitest";
import {
  buildReportMeta,
  buildReportId,
  maskEmail,
  canonicalJson,
  sha256Hex,
  encodeBase32,
  extractBase32ShortCode,
  formatIstDateTime,
  formatIstDateKey,
} from "@/lib/report-meta";

describe("Report Metadata & Integrity Suite (Report Standard v3)", () => {
  const fixedNow = new Date("2026-11-22T10:30:00.000Z"); // 16:00 IST

  describe("maskEmail", () => {
    it("masks standard emails correctly (first char + *** + @domain)", () => {
      expect(maskEmail("rahul.sharma@gmail.com")).toBe("r***@gmail.com");
      expect(maskEmail("ananya@vyaparmedia.in")).toBe("a***@vyaparmedia.in");
    });

    it("handles short usernames and edge cases gracefully", () => {
      expect(maskEmail("x@company.org")).toBe("x***@company.org");
      expect(maskEmail("")).toBe("Protected");
      expect(maskEmail(null)).toBe("Protected");
      expect(maskEmail(undefined)).toBe("Protected");
      expect(maskEmail("not-an-email")).toBe("Protected");
    });
  });

  describe("canonicalJson & sha256Hex determinism", () => {
    it("produces identical JSON strings regardless of key insertion order", () => {
      const objA = { z: 1, a: 2, m: { y: "hello", b: "world" } };
      const objB = { a: 2, m: { b: "world", y: "hello" }, z: 1 };

      const canonA = canonicalJson(objA);
      const canonB = canonicalJson(objB);

      expect(canonA).toBe(canonB);
      expect(sha256Hex(canonA)).toBe(sha256Hex(canonB));
    });

    it("serializes arrays, primitives, nulls and Dates consistently", () => {
      const payload = {
        date: new Date("2026-11-22T00:00:00.000Z"),
        items: [3, 2, 1], // Array order must be preserved
        isNull: null,
        isTrue: true,
        num: 42,
      };
      const canon = canonicalJson(payload);
      expect(canon).toBe(
        '{"date":"2026-11-22T00:00:00.000Z","isNull":null,"isTrue":true,"items":[3,2,1],"num":42}'
      );
    });
  });

  describe("Base32 encoding & Short Code extraction", () => {
    it("encodes byte arrays into uppercase Base32 alphabet", () => {
      const bytes = new Uint8Array([77, 105, 110, 101]);
      const b32 = encodeBase32(bytes);
      expect(b32).toMatch(/^[A-Z2-7]+$/);
    });

    it("extracts a 6-character Base32 short code from hash hex", () => {
      const hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      const code = extractBase32ShortCode(hash, 6);
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[A-Z2-7]{6}$/);
    });
  });

  describe("formatIstDateTime & formatIstDateKey", () => {
    it("formats explicitly in Asia/Kolkata timezone with IST suffix", () => {
      const istStr = formatIstDateTime(fixedNow);
      expect(istStr).toContain("22 Nov 2026");
      expect(istStr).toContain("IST");
    });

    it("generates 8-digit YYYYMMDD date key in Asia/Kolkata", () => {
      const key = formatIstDateKey(fixedNow);
      expect(key).toBe("20261122");
    });
  });

  describe("buildReportId & buildReportMeta", () => {
    it("builds canonical Report ID matching VM-<TYPE>-<YYYYMMDD>-<6 char base32 of hash>", () => {
      const hash = "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0";
      const reportId = buildReportId("ROI", fixedNow, hash);
      expect(reportId).toMatch(/^VM-ROI-20261122-[A-Z2-7]{6}$/);
    });

    it("generates deterministic report metadata across repeated invocations", () => {
      const input = {
        type: "ROI",
        scope: "Campaign: Diwali Boost",
        period: "FY 2025-26",
        user: {
          id: "usr_100",
          name: "Amit Patel",
          email: "amit.patel@brands.in",
          role: "BRAND",
        },
        dataQualitySummary: {
          verifiedPercent: 80,
          estimatedPercent: 20,
          selfReportedPercent: 0,
        },
        payload: {
          spend: 1500000,
          views: 12000,
        },
        now: fixedNow,
      };

      const meta1 = buildReportMeta(input);
      const meta2 = buildReportMeta(input);

      expect(meta1.reportId).toBe(meta2.reportId);
      expect(meta1.integrityCode).toBe(meta2.integrityCode);
      expect(meta1.user.maskedEmail).toBe("a***@brands.in");
      expect(meta1.dataQualitySummary?.text).toBe(
        "Data quality: 80% verified, 20% estimated, 0% self-reported"
      );
    });
  });
});
