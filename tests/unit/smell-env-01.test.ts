import { describe, it, expect } from "vitest";
import { PLATFORM_CONFIG } from "@/lib/platform-config";
import { envSchema } from "@/env";
import fs from "node:fs";
import path from "node:path";

describe("SMELL-ENV-01: Platform Identity & Environment Compliance", () => {
  it("exports PLATFORM_CONFIG wired to environment configuration", () => {
    expect(PLATFORM_CONFIG).toBeDefined();
    expect(PLATFORM_CONFIG.gstin).toBeDefined();
    expect(PLATFORM_CONFIG.cin).toBeDefined();
    expect(PLATFORM_CONFIG.phone).toBeDefined();
    expect(PLATFORM_CONFIG.gstin).not.toContain("XXXX");
    expect(PLATFORM_CONFIG.cin).not.toContain("XXXX");
    expect(PLATFORM_CONFIG.phone).not.toContain("XXXX");
  });

  it("ensures dummy GSTIN 07AABCV1234F1Z5 is eliminated from all UI/route src/ files", () => {
    const srcDir = path.join(process.cwd(), "src");
    const matches: string[] = [];

    function searchDir(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          searchDir(fullPath);
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          // src/env.ts contains the validation check against dummy values
          if (fullPath.endsWith(path.join("src", "env.ts"))) continue;
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.includes("07AABCV1234F1Z5")) {
            matches.push(path.relative(process.cwd(), fullPath));
          }
        }
      }
    }

    searchDir(srcDir);
    expect(
      matches,
      `Found hardcoded dummy GSTIN 07AABCV1234F1Z5 in: ${matches.join(", ")}`,
    ).toEqual([]);
  });

  it("ensures dummy CIN U74999DL2024PTC123456 is eliminated from all UI/route src/ files", () => {
    const srcDir = path.join(process.cwd(), "src");
    const matches: string[] = [];

    function searchDir(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          searchDir(fullPath);
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          if (fullPath.endsWith(path.join("src", "env.ts"))) continue;
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.includes("U74999DL2024PTC123456")) {
            matches.push(path.relative(process.cwd(), fullPath));
          }
        }
      }
    }

    searchDir(srcDir);
    expect(
      matches,
      `Found hardcoded dummy CIN U74999DL2024PTC123456 in: ${matches.join(", ")}`,
    ).toEqual([]);
  });

  it("ensures placeholder phone +91-XXXXXXXXXX is eliminated from UI/route src/ files", () => {
    const srcDir = path.join(process.cwd(), "src");
    const matches: string[] = [];

    function searchDir(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          searchDir(fullPath);
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          if (fullPath.endsWith(path.join("src", "env.ts"))) continue;
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.includes("+91-XXXXXXXXXX")) {
            matches.push(path.relative(process.cwd(), fullPath));
          }
        }
      }
    }

    searchDir(srcDir);
    expect(
      matches,
      `Found placeholder phone +91-XXXXXXXXXX in: ${matches.join(", ")}`,
    ).toEqual([]);
  });

  it("rejects dummy GSTIN, CIN, and phone in envSchema under production NODE_ENV", () => {
    const baseValidProdEnv = {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@host:5432/db",
      DIRECT_URL: "postgresql://user:pass@host:5432/db",
      NEXTAUTH_SECRET: "0123456789abcdef0123456789abcdef",
      NEXTAUTH_URL: "https://vyaparmedia.in",
      NEXT_PUBLIC_APP_URL: "https://vyaparmedia.in",
      REDIS_URL: "redis://localhost:6379",
      CRON_SECRET: "cron_secret_test_32_characters_ok",
      ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      ENCRYPTION_KEYS: "v1:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      HMAC_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      PLATFORM_GSTIN: "07AABCV1234F1Z5", // DUMMY!
      PLATFORM_CIN: "U74999DL2024PTC123456", // DUMMY!
      PLATFORM_PHONE: "+91-XXXXXXXXXX", // DUMMY!
    };

    const result = envSchema.safeParse(baseValidProdEnv);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issuePaths = result.error.issues.map((i) => i.path[0]);
      expect(issuePaths).toContain("PLATFORM_GSTIN");
      expect(issuePaths).toContain("PLATFORM_CIN");
      expect(issuePaths).toContain("PLATFORM_PHONE");
    }
  });
});
