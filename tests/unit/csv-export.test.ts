import { describe, it, expect } from "vitest";
import { toCsv, paiseToRupees, getIndianFYBounds, getCurrentFY } from "@/lib/csv-export";
import { getPlatformHeader, getPlatformFooter } from "@/lib/platform-config";

describe("CSV Export & Financial Compliance Suite", () => {
  it("converts standard table rows to RFC 4180 CSV", () => {
    const data = [
      { id: "1", name: "Rahul", amount: "100.00" },
      { id: "2", name: "Priya", amount: "250.50" },
    ];
    const csv = toCsv(data);
    const lines = csv.split("\r\n");

    expect(lines[0]).toBe("id,name,amount");
    expect(lines[1]).toBe("1,Rahul,100.00");
    expect(lines[2]).toBe("2,Priya,250.50");
  });

  it("handles platform header and footer without dropping table columns or data", () => {
    const platformHeader = getPlatformHeader().map((line) => ({ "Platform Info": line }));
    const platformFooter = getPlatformFooter().map((line) => ({ "Platform Info": line }));
    const dataRows = [
      { "Deal ID": "deal_001", "Supplier": "Creator X", "TCS": "100.00" },
      { "Deal ID": "deal_002", "Supplier": "Creator Y", "TCS": "200.00" },
    ];

    const finalRows = [
      ...platformHeader,
      { "Deal ID": "", "Supplier": "", "TCS": "" },
      ...dataRows,
      ...platformFooter,
    ];

    const csv = toCsv(finalRows);
    const lines = csv.split("\r\n");

    // Header metadata appears at top
    expect(lines[0]).toContain("Platform: VyaparMedia");

    // Data table header row is present
    expect(lines).toContain("Deal ID,Supplier,TCS");

    // Data rows are populated correctly under their columns
    expect(lines).toContain("deal_001,Creator X,100.00");
    expect(lines).toContain("deal_002,Creator Y,200.00");
  });

  it("neutralizes potential CSV injection formulas", () => {
    const malicious = [
      { col: "=cmd|' /C calc'!A0" },
      { col: "+12345" },
      { col: "@SUM(A1:A10)" },
    ];
    const csv = toCsv(malicious);
    expect(csv).toContain("'=cmd|' /C calc'!A0");
    expect(csv).toContain("'+12345");
    expect(csv).toContain("'@SUM(A1:A10)");
  });

  it("calculates Indian FY bounds accurately for April 1 to March 31", () => {
    const bounds = getIndianFYBounds("2025-26");
    expect(bounds).not.toBeNull();
    if (bounds) {
      expect(bounds.start.toISOString()).toBe("2025-03-31T18:30:00.000Z"); // 00:00 IST on April 1
      expect(bounds.end.toISOString()).toBe("2026-03-31T18:29:59.999Z"); // 23:59:59 IST on March 31
    }
  });

  it("returns current FY string in valid format", () => {
    const fy = getCurrentFY();
    expect(fy).toMatch(/^\d{4}-\d{2}$/);
  });

  it("converts paise to rupees accurately", () => {
    expect(paiseToRupees(10000)).toBe("100.00");
    expect(paiseToRupees(50)).toBe("0.50");
    expect(paiseToRupees(0)).toBe("0.00");
  });
});
