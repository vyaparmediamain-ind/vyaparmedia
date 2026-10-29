import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Standard WCAG relative luminance calculation
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
function getRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return (
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  );
}

/**
 * WCAG 2.1 Contrast Ratio
 * (L1 + 0.05) / (L2 + 0.05) where L1 is the lighter color
 */
function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Design System & Accessibility Verification", () => {
  describe("WCAG AA Contrast Ratios (Minimum 4.5:1)", () => {
    // Verified KYC colors
    it("should exceed 4.5:1 contrast for 'verified' token in Light mode", () => {
      const text = "#074526"; // deep green
      const bg = "#E6F8EE"; // mint ice
      const ratio = getContrastRatio(text, bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("should exceed 4.5:1 contrast for 'verified' token in Dark mode", () => {
      const text = "#86EFAC"; // mint light
      const bg = "#072C19"; // deep pine
      const ratio = getContrastRatio(text, bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    // Escrow-Locked colors
    it("should exceed 4.5:1 contrast for 'escrow' token in Light mode", () => {
      const text = "#082F6B"; // midnight blue
      const bg = "#EBF3FE"; // ice blue
      const ratio = getContrastRatio(text, bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("should exceed 4.5:1 contrast for 'escrow' token in Dark mode", () => {
      const text = "#93C5FD"; // soft azure
      const bg = "#091E44"; // abyss blue
      const ratio = getContrastRatio(text, bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    // Pending Review colors
    it("should exceed 4.5:1 contrast for 'pending' token in Light mode", () => {
      const text = "#573402"; // dark amber/chestnut
      const bg = "#FEF6D9"; // light amber cream
      const ratio = getContrastRatio(text, bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("should exceed 4.5:1 contrast for 'pending' token in Dark mode", () => {
      const text = "#FDE68A"; // pale gold
      const bg = "#372004"; // dark amber pit
      const ratio = getContrastRatio(text, bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    // Disputed colors
    it("should exceed 4.5:1 contrast for 'disputed' token in Light mode", () => {
      const text = "#610B13"; // dark carmine
      const bg = "#FDEBED"; // soft blush
      const ratio = getContrastRatio(text, bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("should exceed 4.5:1 contrast for 'disputed' token in Dark mode", () => {
      const text = "#FCA5A5"; // soft rose
      const bg = "#3F080E"; // deep wine
      const ratio = getContrastRatio(text, bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    // Neutral foreground on background
    it("should exceed 4.5:1 contrast for standard text on background in Light mode", () => {
      const text = "#1B1B22";
      const bg = "#FAFAFA";
      const ratio = getContrastRatio(text, bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("should exceed 4.5:1 contrast for standard text on background in Dark mode", () => {
      const text = "#F3F4F6";
      const bg = "#0B0D12";
      const ratio = getContrastRatio(text, bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe("globals.css Token & Utility Configuration", () => {
    const globalsCssPath = path.resolve(__dirname, "../../src/app/globals.css");
    const cssContent = fs.readFileSync(globalsCssPath, "utf-8");

    it("should contain definitions for all semantic trust tokens", () => {
      expect(cssContent).toContain("--escrow:");
      expect(cssContent).toContain("--escrow-foreground:");
      expect(cssContent).toContain("--escrow-muted:");
      expect(cssContent).toContain("--escrow-border:");

      expect(cssContent).toContain("--verified:");
      expect(cssContent).toContain("--verified-foreground:");
      expect(cssContent).toContain("--verified-muted:");
      expect(cssContent).toContain("--verified-border:");

      expect(cssContent).toContain("--pending:");
      expect(cssContent).toContain("--pending-foreground:");
      expect(cssContent).toContain("--pending-muted:");
      expect(cssContent).toContain("--pending-border:");

      expect(cssContent).toContain("--disputed:");
      expect(cssContent).toContain("--disputed-foreground:");
      expect(cssContent).toContain("--disputed-muted:");
      expect(cssContent).toContain("--disputed-border:");
    });

    it("should define dark mode variables under .dark", () => {
      expect(cssContent).toContain(".dark {");
      expect(cssContent).toContain("--background: 224 25% 6%;"); // OLED near-black
    });

    it("should include .tabular-nums utility to avoid wallet counter jitter", () => {
      expect(cssContent).toContain(".tabular-nums");
      expect(cssContent).toContain("tabular-nums");
      expect(cssContent).toContain('"tnum" 1');
    });
  });

  describe("Base UI & Tailwind Configuration", () => {
    it("should configure components.json for Base UI primitive", () => {
      const componentsJsonPath = path.resolve(__dirname, "../../components.json");
      const config = JSON.parse(fs.readFileSync(componentsJsonPath, "utf-8"));
      expect(config.style).toBe("default");
      expect(config.tailwind.cssVariables).toBe(true);
      expect(config.tailwind.baseColor).toBe("neutral");
    });

    it("should define radius and trust tokens in tailwind.config.ts", () => {
      const tailwindConfigPath = path.resolve(__dirname, "../../tailwind.config.ts");
      const content = fs.readFileSync(tailwindConfigPath, "utf-8");
      expect(content).toContain("escrow:");
      expect(content).toContain("verified:");
      expect(content).toContain("pending:");
      expect(content).toContain("disputed:");
      expect(content).toContain("darkMode: [\"class\"]");
    });
  });
});
