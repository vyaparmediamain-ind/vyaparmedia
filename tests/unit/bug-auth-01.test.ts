import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  evaluateTokenClockSkew,
  verifyServerTime,
} from "@/hooks/useTokenRefreshGuard";
import { MAX_ALLOWED_CLOCK_SKEW_MS } from "@/constants/auth";

describe("BUG-AUTH-01: useTokenRefreshGuard clock skew protection & loop prevention", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("configures MAX_ALLOWED_CLOCK_SKEW_MS to 10 minutes (600,000 ms)", () => {
    expect(MAX_ALLOWED_CLOCK_SKEW_MS).toBe(10 * 60 * 1000);
  });

  it("permits regular tokens where lastRefreshed <= clientNow with ALLOW", () => {
    const clientNow = 1700000000000;
    vi.setSystemTime(clientNow);
    const lastRefreshed = clientNow - 5000; // 5 seconds ago

    const decision = evaluateTokenClockSkew(lastRefreshed, clientNow);
    expect(decision.action).toBe("ALLOW");
    expect(decision.skewMs).toBe(0);
  });

  it("does NOT trigger forced logout for modest clock skew under 10 minutes (e.g., 2 minutes)", () => {
    const clientNow = 1700000000000;
    vi.setSystemTime(clientNow);
    // User clock is 2 minutes behind server
    const lastRefreshed = clientNow + 2 * 60 * 1000;

    const decision = evaluateTokenClockSkew(lastRefreshed, clientNow);
    expect(decision.action).toBe("WARN_ONLY");
    expect(decision.skewMs).toBe(2 * 60 * 1000);
  });

  it("triggers VERIFY_SERVER for severe clock skew (> 10 minutes)", () => {
    const clientNow = 1700000000000;
    vi.setSystemTime(clientNow);
    // User clock is 15 minutes behind server
    const lastRefreshed = clientNow + 15 * 60 * 1000;

    const decision = evaluateTokenClockSkew(lastRefreshed, clientNow);
    expect(decision.action).toBe("VERIFY_SERVER");
    expect(decision.skewMs).toBe(15 * 60 * 1000);
  });

  it("verifyServerTime preserves session when server time confirms token was legally issued", async () => {
    const serverTime = 1700000900000; // true server time
    const lastRefreshed = serverTime - 1000; // issued 1s ago on server

    const mockFetch = vi.fn().mockResolvedValue({
      headers: {
        get: (header: string) => {
          if (header.toLowerCase() === "date") {
            return new Date(serverTime).toUTCString();
          }
          return null;
        },
      },
    });

    const result = await verifyServerTime(lastRefreshed, 10 * 60 * 1000, mockFetch as unknown as typeof fetch);
    expect(result.isValid).toBe(true);
    expect(result.serverTime).toBe(new Date(new Date(serverTime).toUTCString()).getTime());
  });

  it("verifyServerTime flags token only when issued in the future relative to server clock", async () => {
    const serverTime = 1700000000000;
    // Token claims to be from 20 minutes in the future even on server clock
    const lastRefreshed = serverTime + 20 * 60 * 1000;

    const mockFetch = vi.fn().mockResolvedValue({
      headers: {
        get: (header: string) => {
          if (header.toLowerCase() === "date") {
            return new Date(serverTime).toUTCString();
          }
          return null;
        },
      },
    });

    const result = await verifyServerTime(lastRefreshed, 10 * 60 * 1000, mockFetch as unknown as typeof fetch);
    expect(result.isValid).toBe(false);
  });

  it("verifyServerTime fails open on network failure to avoid infinite offline logout loops", async () => {
    const lastRefreshed = 1700000000000;
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network offline"));

    const result = await verifyServerTime(lastRefreshed, 10 * 60 * 1000, mockFetch as unknown as typeof fetch);
    expect(result.isValid).toBe(true);
    expect(result.serverTime).toBeNull();
  });
});
