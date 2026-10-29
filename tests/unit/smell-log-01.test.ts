import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "@/lib/logger-client";

describe("SMELL-LOG-01: Client Logger PII Masking", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("masks PAN in client logger message and metadata", () => {
    logger.warn("PAN verification submitted for ABCDE1234F", { pan: "ABCDE1234F" });
    expect(warnSpy).toHaveBeenCalled();
    const [msg, meta] = warnSpy.mock.calls[0];
    expect(msg).not.toContain("ABCDE1234F");
    expect(JSON.stringify(meta)).not.toContain("ABCDE1234F");
    expect(msg).toContain("[REDACTED_PAN]");
  });

  it("masks Aadhaar in client logger message and metadata", () => {
    logger.info("Aadhaar submitted: 1234 5678 9012", { aadhaar: "1234 5678 9012" });
    expect(infoSpy).toHaveBeenCalled();
    const [msg, meta] = infoSpy.mock.calls[0];
    expect(msg).not.toContain("1234 5678 9012");
    expect(JSON.stringify(meta)).not.toContain("1234 5678 9012");
    expect(msg).toContain("[REDACTED_AADHAAR]");
  });

  it("masks Email in client logger message and metadata", () => {
    logger.warn("User registered: testuser@example.com", { userEmail: "testuser@example.com" });
    expect(warnSpy).toHaveBeenCalled();
    const [msg, meta] = warnSpy.mock.calls[0];
    expect(msg).not.toContain("testuser@example.com");
    expect(JSON.stringify(meta)).not.toContain("testuser@example.com");
    expect(msg).toContain("te***@example.com");
  });

  it("masks Phone number in client logger message and metadata", () => {
    logger.error("SMS failed for 9876543210", new Error("Network timeout"), { phone: "9876543210" });
    expect(errorSpy).toHaveBeenCalled();
    const [msg, meta] = errorSpy.mock.calls[0];
    expect(msg).not.toContain("9876543210");
    expect(JSON.stringify(meta)).not.toContain("9876543210");
  });

  it("masks sensitive keys like password, token, secret", () => {
    logger.info("Login attempt", { password: "SuperSecretPassword123!", token: "jwt-token-12345" });
    expect(infoSpy).toHaveBeenCalled();
    const [, meta] = infoSpy.mock.calls[0];
    expect(JSON.stringify(meta)).not.toContain("SuperSecretPassword123!");
    expect(JSON.stringify(meta)).not.toContain("jwt-token-12345");
  });
});
