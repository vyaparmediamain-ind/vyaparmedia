import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isIpBannedEdge } from "@/lib/blacklist-edge";

describe("isIpBannedEdge Security & Fail-Closed Guard", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  const setNodeEnv = (val: string) => {
    (process.env as Record<string, string | undefined>).NODE_ENV = val;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    process.env.UPSTASH_REDIS_REST_URL = "https://mock-upstash.redis.com";
    process.env.UPSTASH_REDIS_REST_TOKEN = "mock-secret-token";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it("should fail open (return false) if Upstash REST credentials are not configured", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const result = await isIpBannedEdge("192.168.1.1");
    expect(result).toBe(false);
  });

  it("should return true when Upstash Redis finds an active ban for the IP", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: "banned:malicious_activity" }),
    });

    const result = await isIpBannedEdge("203.0.113.42");
    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://mock-upstash.redis.com/get/ban:ip:203.0.113.42",
      expect.objectContaining({
        headers: { Authorization: "Bearer mock-secret-token" },
      }),
    );
  });

  it("should return false when Upstash Redis confirms IP is not banned (result: null)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: null }),
    });

    const result = await isIpBannedEdge("203.0.113.99");
    expect(result).toBe(false);
  });

  describe("Fail-Safe Behavior on Redis Failure, Timeout, or Outage", () => {
    it("should fail OPEN (return false) in development or test environment when fetch throws", async () => {
      setNodeEnv("test");
      global.fetch = vi.fn().mockRejectedValue(new Error("Upstash timeout or connection reset"));

      const result = await isIpBannedEdge("198.51.100.10");
      expect(result).toBe(false);
    });

    it("should fail OPEN (return false) in development or test environment on HTTP 500 error", async () => {
      setNodeEnv("test");
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const result = await isIpBannedEdge("198.51.100.11");
      expect(result).toBe(false);
    });

    it("SECURITY: should fail CLOSED (return true) in production environment when fetch throws / times out", async () => {
      setNodeEnv("production");
      global.fetch = vi.fn().mockRejectedValue(new Error("Redis connection refused or AbortSignal timeout"));

      const result = await isIpBannedEdge("198.51.100.12");
      // Must return true in production to prevent malicious/banned IPs bypassing security during an outage
      expect(result).toBe(true);
    });

    it("SECURITY: should fail CLOSED (return true) in production environment on HTTP error (!response.ok)", async () => {
      setNodeEnv("production");
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      });

      const result = await isIpBannedEdge("198.51.100.13");
      // Must return true in production to prevent malicious/banned IPs bypassing security during Upstash 503
      expect(result).toBe(true);
    });
  });
});
