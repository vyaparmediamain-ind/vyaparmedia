import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("BUG-RACE-01: Atomic KYC Elevation & Unique Verification Document Constraint", () => {
  it("enforces @@unique([userId, type]) on VerificationDocument model in schema.prisma", () => {
    const schemaPath = path.join(process.cwd(), "prisma/schema.prisma");
    const schemaContent = fs.readFileSync(schemaPath, "utf-8");

    // Extract VerificationDocument model block
    const modelMatch = schemaContent.match(/model VerificationDocument\s*\{([\s\S]*?)\n\}/);
    expect(modelMatch).toBeTruthy();
    const modelBlock = modelMatch![1];

    expect(modelBlock).toContain("@@unique([userId, type])");
  });

  it("ensures handleVerifyAadhaar executes user elevation and document update inside an atomic prisma.$transaction", () => {
    const routePath = path.join(process.cwd(), "src/app/api/verification/route.ts");
    const routeContent = fs.readFileSync(routePath, "utf-8");

    // Extract handleVerifyAadhaar function
    const aadhaarFnMatch = routeContent.match(/async function handleVerifyAadhaar[\s\S]*?\n\}/);
    expect(aadhaarFnMatch).toBeTruthy();
    const aadhaarFn = aadhaarFnMatch![0];

    // Verify it uses prisma.$transaction
    expect(aadhaarFn).toMatch(/prisma\.\$transaction/);
    // Verify it uses tx.user.update or tx.verificationDocument
    expect(aadhaarFn).toMatch(/tx\.user\.update/);
    expect(aadhaarFn).toMatch(/tx\.verificationDocument/);
  });

  it("ensures handleVerifyPan executes user elevation and document update inside an atomic prisma.$transaction", () => {
    const routePath = path.join(process.cwd(), "src/app/api/verification/route.ts");
    const routeContent = fs.readFileSync(routePath, "utf-8");

    const panFnMatch = routeContent.match(/async function handleVerifyPan[\s\S]*?\n\}/);
    expect(panFnMatch).toBeTruthy();
    const panFn = panFnMatch![0];

    expect(panFn).toMatch(/prisma\.\$transaction/);
    expect(panFn).toMatch(/tx\.user\.update/);
    expect(panFn).toMatch(/tx\.verificationDocument/);
  });

  it("ensures handleVerifyGst executes user elevation and document update inside an atomic prisma.$transaction", () => {
    const routePath = path.join(process.cwd(), "src/app/api/verification/route.ts");
    const routeContent = fs.readFileSync(routePath, "utf-8");

    const gstFnMatch = routeContent.match(/async function handleVerifyGst[\s\S]*?\n\}/);
    expect(gstFnMatch).toBeTruthy();
    const gstFn = gstFnMatch![0];

    expect(gstFn).toMatch(/prisma\.\$transaction/);
    expect(gstFn).toMatch(/tx\.user\.update/);
    expect(gstFn).toMatch(/tx\.verificationDocument/);
  });

  it("ensures manual document upload route performs upsert targeting compound userId_type key", () => {
    const routePath = path.join(process.cwd(), "src/app/api/verification/route.ts");
    const routeContent = fs.readFileSync(routePath, "utf-8");

    expect(routeContent).toMatch(/prisma\.verificationDocument\.upsert/);
    expect(routeContent).toMatch(/userId_type:\s*\{/);
  });
});
