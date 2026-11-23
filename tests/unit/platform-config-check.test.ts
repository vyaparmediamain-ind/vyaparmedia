import { describe, it, expect } from "vitest";
import {
  getPlatformConfigStatus,
  getMissingPlatformConfigFields,
  validateTaxReportPrerequisites,
  isConfigValuePresent,
} from "@/lib/platform-config-check";

describe("Platform Configuration Check Suite (Report Standard v3)", () => {
  describe("isConfigValuePresent", () => {
    it("identifies valid configured values correctly", () => {
      expect(isConfigValuePresent("VyaparMedia Technologies Pvt Ltd")).toBe(true);
      expect(isConfigValuePresent("29ABCDE1234F1Z5")).toBe(true);
      expect(isConfigValuePresent("https://vyaparmedia.in")).toBe(true);
    });

    it("flags empty, placeholder, or masked values as not present", () => {
      expect(isConfigValuePresent("")).toBe(false);
      expect(isConfigValuePresent("   ")).toBe(false);
      expect(isConfigValuePresent(null)).toBe(false);
      expect(isConfigValuePresent(undefined)).toBe(false);
      expect(isConfigValuePresent("[Not configured]")).toBe(false);
      expect(isConfigValuePresent("29XXXXX1234F1Z5")).toBe(false);
      expect(isConfigValuePresent("XXXXCD1234F")).toBe(false);
    });
  });

  describe("getPlatformConfigStatus & validateTaxReportPrerequisites", () => {
    it("returns comprehensive field status including tax-required flags", () => {
      const status = getPlatformConfigStatus();
      expect(status.length).toBeGreaterThanOrEqual(10);

      const legalNameField = status.find((f) => f.key === "legalName");
      const gstinField = status.find((f) => f.key === "gstin");
      const addressField = status.find((f) => f.key === "address");

      expect(legalNameField?.isTaxRequired).toBe(true);
      expect(gstinField?.isTaxRequired).toBe(true);
      expect(addressField?.isTaxRequired).toBe(true);
    });

    it("validates tax report prerequisites and provides informative error message when fields are missing", () => {
      const check = validateTaxReportPrerequisites();
      if (!check.valid) {
        expect(check.errorMessage).toContain("Platform configuration incomplete");
        expect(check.missingFields.length).toBeGreaterThan(0);
      } else {
        expect(check.missingFields).toHaveLength(0);
        expect(check.errorMessage).toBe("");
      }
    });
  });
});
