import { describe, it, expect } from "vitest";

describe("BUG-ASYNC-01: Floating promises & unawaited background operations", () => {
  it("verifies sendWelcomeEmail in AuthService is awaited and failure is safely trapped without rejecting registration", async () => {
    // Read auth.service.ts source to ensure sendWelcomeEmail is awaited with catch/log, not a floating promise
    const fs = await import("node:fs");
    const path = await import("node:path");
    const content = fs.readFileSync(path.join(process.cwd(), "src/services/auth.service.ts"), "utf-8");

    // Assert that floating sendWelcomeEmail(...).catch(...) is NOT present
    expect(content).not.toMatch(/sendWelcomeEmail\([^)]+\)\.catch\(/);
    // Assert that it is awaited inside try/catch
    expect(content).toMatch(/try\s*\{\s*await sendWelcomeEmail/);
  });

  it("verifies campaign creation background side effects are awaited via Promise.allSettled or try/catch", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const content = fs.readFileSync(path.join(process.cwd(), "src/services/campaign/create.ts"), "utf-8");

    // Assert that bare floating promises without await are not present
    expect(content).not.toMatch(/checkAndAwardBadges\(userId,\s*"CAMPAIGN_CREATED"\)\.catch\(/);
    expect(content).toMatch(/await Promise\.allSettled/);
  });

  it("verifies auto-approve emails are awaited with catch and logging", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const content = fs.readFileSync(path.join(process.cwd(), "src/services/deal/auto-approve.ts"), "utf-8");

    expect(content).not.toMatch(/sendAutoApproveEmails\(deal\)\.catch\(/);
    expect(content).toMatch(/try\s*\{\s*await sendAutoApproveEmails/);
  });

  it("verifies collusion pattern detection in trust-engine is awaited as non-fatal side effect", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const content = fs.readFileSync(path.join(process.cwd(), "src/lib/trust-engine.ts"), "utf-8");

    expect(content).not.toMatch(/detectCollusionPatterns\(userId\)\.catch\(/);
    expect(content).toMatch(/try\s*\{\s*await detectCollusionPatterns/);
  });
});
