import { describe, it, expect, vi, beforeEach } from "vitest";
import { redis } from "@/lib/redis";
import {
  getShiprocketToken,
  clearCachedShiprocketToken,
  shiprocketAuthenticatedFetch,
} from "@/lib/shiprocket";
import { AppError } from "@/lib/errors";

describe("SR-AUTH-01: Shiprocket Redis Token Caching, Single-Flight & 401 Refresh", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    process.env.SHIPROCKET_EMAIL = "partner@vyaparmedia.in";
    process.env.SHIPROCKET_PASSWORD = "secure_shiprocket_password";
    await clearCachedShiprocketToken();
  });

  it("retrieves token from Redis when available without calling /auth/login", async () => {
    const mockToken = "redis_cached_token_123456";
    vi.spyOn(redis, "get").mockResolvedValue(mockToken);
    vi.spyOn(redis, "ttl").mockResolvedValue(500000); // ~5.7 days remaining

    const fetchSpy = vi.spyOn(global, "fetch");

    const token = await getShiprocketToken();
    expect(token).toBe(mockToken);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches fresh token and stores in Redis with 7-day TTL when Redis cache is empty", async () => {
    vi.spyOn(redis, "get").mockResolvedValue(null);
    const setSpy = vi.spyOn(redis, "set").mockResolvedValue("OK");

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: "new_sr_jwt_token_777" }),
      text: async () => JSON.stringify({ token: "new_sr_jwt_token_777" }),
    } as any);

    const token = await getShiprocketToken();
    expect(token).toBe("new_sr_jwt_token_777");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(setSpy).toHaveBeenCalledWith(
      "shiprocket:auth:token",
      "new_sr_jwt_token_777",
      "EX",
      604800, // 7 days in seconds
    );
  });

  it("deduplicates concurrent login requests during cold start (single-flight lock)", async () => {
    vi.spyOn(redis, "get").mockResolvedValue(null);
    vi.spyOn(redis, "set").mockResolvedValue("OK");

    let loginCalls = 0;
    vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
      if (String(url).includes("/auth/login")) {
        loginCalls++;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return {
          ok: true,
          status: 200,
          json: async () => ({ token: `token_call_${loginCalls}` }),
          text: async () => JSON.stringify({ token: `token_call_${loginCalls}` }),
        } as any;
      }
      return { ok: true, status: 200, json: async () => ({}) } as any;
    });

    // Invoke 5 concurrent calls simultaneously
    const results = await Promise.all([
      getShiprocketToken(),
      getShiprocketToken(),
      getShiprocketToken(),
      getShiprocketToken(),
      getShiprocketToken(),
    ]);

    // All should receive the same token and only 1 login request should have been made
    expect(loginCalls).toBe(1);
    expect(results.every((t) => t === "token_call_1")).toBe(true);
  });

  it("refreshes token once and retries when Shiprocket returns 401 Unauthorized", async () => {
    vi.spyOn(redis, "get").mockResolvedValue(null);
    const delSpy = vi.spyOn(redis, "del").mockResolvedValue(1);
    vi.spyOn(redis, "set").mockResolvedValue("OK");

    let authCount = 0;
    let apiCount = 0;

    vi.spyOn(global, "fetch").mockImplementation(async (url: any, init: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/auth/login")) {
        authCount++;
        return {
          ok: true,
          status: 200,
          json: async () => ({ token: `token_version_${authCount}` }),
          text: async () => JSON.stringify({ token: `token_version_${authCount}` }),
        } as any;
      }

      if (urlStr.includes("/orders/show")) {
        apiCount++;
        const authHeader =
          init?.headers instanceof Headers
            ? init.headers.get("authorization")
            : init?.headers?.Authorization || init?.headers?.authorization;
        // First call with stale token returns 401
        if (authHeader === "Bearer token_version_1") {
          return {
            ok: false,
            status: 401,
            text: async () => "Unauthorized: Token expired",
            json: async () => ({ message: "Unauthorized" }),
          } as any;
        }
        // Second call with fresh token returns 200 OK
        if (authHeader === "Bearer token_version_2") {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, order_id: "ORD_789" }),
          } as any;
        }
      }

      return { ok: false, status: 404 } as any;
    });

    const res = await shiprocketAuthenticatedFetch("https://apiv2.shiprocket.in/v1/external/orders/show");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.order_id).toBe("ORD_789");

    // Verified: called auth twice (initial + refreshed), deleted stale token from redis
    expect(authCount).toBe(2);
    expect(apiCount).toBe(2);
    expect(delSpy).toHaveBeenCalledWith("shiprocket:auth:token");
  });
});
