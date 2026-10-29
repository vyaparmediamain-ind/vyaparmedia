import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("DEAD-SCHEMA-01: Deprecation of Unused Prisma Enum Values", () => {
  const schemaPath = path.join(process.cwd(), "prisma/schema.prisma");
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");

  it("marks ViolationAction.TRUST_SCORE_LOG as @deprecated in prisma/schema.prisma", () => {
    // Verifies that TRUST_SCORE_LOG is commented as deprecated for future contract migration
    expect(schemaContent).toMatch(
      /TRUST_SCORE_LOG\s*\/\/\s*@deprecated/,
    );
  });

  it("marks OtpTokenType.LOGIN_OTP as @deprecated in prisma/schema.prisma", () => {
    // Verifies that LOGIN_OTP is commented as deprecated for future contract migration
    expect(schemaContent).toMatch(
      /LOGIN_OTP\s*\/\/\s*@deprecated/,
    );
  });
});
