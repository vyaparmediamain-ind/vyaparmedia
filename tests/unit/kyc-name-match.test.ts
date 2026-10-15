import { describe, it, expect, vi, beforeEach } from "vitest";
import { hasMatchingNameTokens } from "@/lib/kyc";

describe("KYC-NAME-01: Name Matching Matrix & False-Reject Manual Fallback", () => {
  describe("hasMatchingNameTokens matrix", () => {
    it("matches identical names case-insensitively with punctuation removed", () => {
      expect(hasMatchingNameTokens("Priya Sharma", "priya sharma")).toBe(true);
      expect(hasMatchingNameTokens("Dr. Priya Sharma", "Priya Sharma")).toBe(true);
    });

    it("matches substring expansions for Indian names", () => {
      expect(hasMatchingNameTokens("Priya Ramesh Sharma", "Priya Sharma")).toBe(true);
      expect(hasMatchingNameTokens("Mohammad Asif Khan", "Mohd Asif Khan")).toBe(true);
    });

    it("matches reordered tokens (Surname First vs Surname Last)", () => {
      expect(hasMatchingNameTokens("Sharma Priya", "Priya Sharma")).toBe(true);
      expect(hasMatchingNameTokens("Reddy Venkat Ramana", "Venkat Ramana Reddy")).toBe(true);
    });

    it("detects genuine mismatches correctly", () => {
      expect(hasMatchingNameTokens("Priya Sharma", "Rahul Verma")).toBe(false);
      expect(hasMatchingNameTokens("Acme Tech Private Limited", "Sun Pharma")).toBe(false);
    });

    it("handles null and empty values safely without throwing", () => {
      expect(hasMatchingNameTokens(null, "Priya")).toBe(false);
      expect(hasMatchingNameTokens("Priya", undefined)).toBe(false);
      expect(hasMatchingNameTokens("", "")).toBe(false);
    });
  });
});
