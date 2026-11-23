import { describe, it, expect } from "vitest";
import { buildBrandedCsv, buildReportFilename } from "@/lib/csv-export";
import { buildReportMeta } from "@/lib/report-meta";

describe("Branded CSV Export Suite (Report Standard v3)", () => {
  const fixedNow = new Date("2026-11-22T10:00:00.000Z");

  const meta = buildReportMeta({
    type: "SPEND",
    scope: "Brand Client X",
    period: "FY 2025-26",
    user: {
      name: "Rohit Verma",
      email: "rohit@clientx.com",
      role: "BRAND",
    },
    dataQualitySummary: {
      verifiedPercent: 100,
      estimatedPercent: 0,
      selfReportedPercent: 0,
    },
    now: fixedNow,
  });

  const columns = [
    { key: "id", label: "Deal ID" },
    { key: "creator", label: "Influencer" },
    { key: "amount", label: "Amount (INR)" },
    { key: "quality", label: "Data Quality" },
  ];

  const rows = [
    { id: "deal_001", creator: "Kavita Rao", amount: "15,000.00", quality: "VERIFIED" },
    { id: "deal_002", creator: "Aman Gupta", amount: "25,000.00", quality: "VERIFIED" },
  ];

  it("builds standard branded CSV with # prefixed corporate header, blank line, table, and footer", () => {
    const csv = buildBrandedCsv({
      meta,
      columns,
      rows,
    });

    const lines = csv.split("\r\n");

    // 1. First line begins with # Platform:
    expect(lines[0]).toMatch(/^# Platform:/);

    // 2. Report ID and meta appear in header with # prefix
    expect(lines.some((l) => l.startsWith("# Report ID: VM-SPEND-20261122-"))).toBe(true);
    expect(lines.some((l) => l.startsWith("# Generated For: Rohit Verma (BRAND) <r***@clientx.com>"))).toBe(true);
    expect(lines.some((l) => l.startsWith("# Data quality: 100% verified"))).toBe(true);
    expect(lines.some((l) => l.startsWith("# SHA-256 Integrity:"))).toBe(true);

    // 3. Blank line exists before data table
    const tableHeaderIdx = lines.indexOf("Deal ID,Influencer,Amount (INR),Data Quality");
    expect(tableHeaderIdx).toBeGreaterThan(5);
    expect(lines[tableHeaderIdx - 1]).toBe("");

    // 4. Data rows are formatted cleanly without # prefix
    expect(lines).toContain('deal_001,Kavita Rao,"15,000.00",VERIFIED');
    expect(lines).toContain('deal_002,Aman Gupta,"25,000.00",VERIFIED');

    // 5. Blank line before footer
    const footerHeaderIdx = lines.findIndex((l) => l === "# --- End of Report ---");
    expect(footerHeaderIdx).toBeGreaterThan(tableHeaderIdx);
    expect(lines[footerHeaderIdx - 1]).toBe("");

    // 6. Footer has disclaimer
    expect(lines.some((l) => l.includes("Estimated figures are indicative"))).toBe(true);
  });

  it("neutralizes potential formula injection in branded CSV table values", () => {
    const maliciousRows = [
      { id: "=SUM(A1:A10)", creator: "+cmd|' /C calc'!A0", amount: "@dangerous", quality: "-hyphen" },
    ];

    const csv = buildBrandedCsv({
      meta,
      columns,
      rows: maliciousRows,
    });

    expect(csv).toContain("'=SUM(A1:A10)");
    expect(csv).toContain("'+cmd|' /C calc'!A0");
    expect(csv).toContain("'@dangerous");
    expect(csv).toContain("'-hyphen");
  });

  it("generates standard filename according to VyaparMedia-<Type>-<scope>-<YYYYMMDD>.csv", () => {
    const filename = buildReportFilename("ROI", "Diwali Campaign 2026", fixedNow);
    expect(filename).toBe("VyaparMedia-ROI-Diwali_Campaign_2026-20261122.csv");

    const statementFilename = buildReportFilename("Statement", "Ananya Verma", fixedNow);
    expect(statementFilename).toBe("VyaparMedia-Statement-Ananya_Verma-20261122.csv");
  });
});
