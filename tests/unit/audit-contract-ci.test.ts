import { describe, it, expect } from "vitest";
import { runContractAudit } from "../../scripts/audit-contract";

describe("Full-Stack API Contract Verification (CI Guard)", () => {
  const result = runContractAudit();

  it("verifies server route handlers exist for all frontend client call sites (Zero Dead 404 Routes)", () => {
    // In unpatched code, apiClient.messages targets /api/messages/${id} which doesn't exist on server (P8-CON-04)
    expect(
      result.deadCalls.map((d) => `[${d.method}] ${d.rawUrl} at ${d.file}:${d.line}`),
      "Detected dead API client call sites targeting non-existent server routes (P8-CON-04)"
    ).toEqual([]);
  });

  it("verifies HTTP methods match between frontend client calls and exported server methods (Zero 405 Method Mismatches)", () => {
    // In unpatched code:
    // 1. /api/notifications/preferences called with POST, server only exports [GET, PATCH] (P8-CON-02)
    // 2. /api/compliance/india-tax called with POST, server only exports [GET, PUT] (P8-CON-03)
    expect(
      result.methodMismatches.map((m) => `[${m.call.method}] ${m.call.rawUrl} at ${m.call.file}:${m.call.line} (Server: [${m.serverRoute.methods.join(", ")}])`),
      "Detected HTTP Method Mismatches (HTTP 405 Risk)"
    ).toEqual([]);
  });

  it("ensures total API contract drift is zero for production release", () => {
    expect(result.success, "Full-stack API contract audit must pass with 0 drift").toBe(true);
  });
});
