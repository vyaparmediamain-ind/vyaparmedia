import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Phase 4 Bugs Remediation (BUG-RATE-01, BUG-SQL-01, BUG-IDEMP-01, BUG-REACT-01, BUG-REACT-02)", () => {
  it("BUG-RATE-01: ensures withdrawal route rate limit error explains 24-hour rolling window with exact hours remaining", () => {
    const filePath = path.join(process.cwd(), "src/app/api/payments/withdraw/route.ts");
    const content = fs.readFileSync(filePath, "utf-8");

    // Must not have misleading "tomorrow" message
    expect(content).not.toMatch(/Please try again tomorrow/);
    // Must have per 24 hours and remaining hours calculation
    expect(content).toMatch(/per 24 hours for your tier/);
    expect(content).toMatch(/hoursRemaining/);
  });

  it("BUG-SQL-01: ensures campaign and creator keyset cursor queries cast ISO strings to timestamptz", () => {
    const campaignSearchPath = path.join(process.cwd(), "src/lib/search/campaign-search.ts");
    const campaignContent = fs.readFileSync(campaignSearchPath, "utf-8");
    expect(campaignContent).toContain("::timestamptz");
    expect(campaignContent).not.toMatch(/c\."createdAt"\s*\$\{op\}\s*\$\$\{sortValIdx\}::timestamp\)/);

    const creatorSearchPath = path.join(process.cwd(), "src/lib/search/creator-search.ts");
    const creatorContent = fs.readFileSync(creatorSearchPath, "utf-8");
    expect(creatorContent).toContain("::timestamptz");
    expect(creatorContent).not.toMatch(/ip\."createdAt"\s*\$\{op\}\s*\$\$\{sortValIdx\}::timestamp\)/);
  });

  it("BUG-IDEMP-01: ensures wallet top-up and withdrawal flows do not use Math.random for idempotency keys", () => {
    const walletPagePath = path.join(process.cwd(), "src/app/dashboard/wallet/page.tsx");
    const walletPageContent = fs.readFileSync(walletPagePath, "utf-8");
    expect(walletPageContent).not.toMatch(/topup_\$\{Date\.now\(\)\}_\$\{Math\.random/);
    expect(walletPageContent).toMatch(/crypto\.randomUUID/);

    const withdrawFlowPath = path.join(process.cwd(), "src/components/dashboard/wallet/FullScreenWithdrawFlow.tsx");
    const withdrawFlowContent = fs.readFileSync(withdrawFlowPath, "utf-8");
    expect(withdrawFlowContent).not.toMatch(/Math\.random/);
  });

  it("BUG-REACT-01: ensures settings page includes user.name in useMemo dependencies", () => {
    const settingsPath = path.join(process.cwd(), "src/app/dashboard/settings/page.tsx");
    const content = fs.readFileSync(settingsPath, "utf-8");
    expect(content).toMatch(/\[user\?\.userType,\s*session\?\.user\?\.userType,\s*user\?\.id,\s*session\?\.user\?\.id,\s*profile,\s*user\?\.name\]/);
  });

  it("BUG-REACT-02: ensures ShipmentTrackingModal includes deal.shippingTrackingHistory in useEffect dependencies", () => {
    const modalPath = path.join(process.cwd(), "src/components/dashboard/deals/ShipmentTrackingModal.tsx");
    const content = fs.readFileSync(modalPath, "utf-8");
    expect(content).toMatch(/deal\?\.shippingTrackingHistory/);
  });
});
