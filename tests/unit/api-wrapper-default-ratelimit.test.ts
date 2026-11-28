import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { apiWrapper, DEFAULT_API_RATE_LIMIT } from "@/lib/api-wrapper";
import * as rateLimitModule from "@/lib/rate-limit";

describe("apiWrapper Default Rate Limiting (M2)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should apply DEFAULT_API_RATE_LIMIT (120 req/60s) when no rateLimit is specified", async () => {
    const rateLimitSpy = vi.spyOn(rateLimitModule, "rateLimit").mockResolvedValue({
      success: true,
      limit: 120,
      remaining: 119,
      reset: Math.floor(Date.now() / 1000) + 60,
    });

    const handler = apiWrapper(async () => {
      return NextResponse.json({ ok: true });
    });

    const req = new NextRequest("http://localhost:3000/api/test-route");
    const res = await handler(req, { params: Promise.resolve({}) });

    expect(rateLimitSpy).toHaveBeenCalledTimes(1);
    expect(rateLimitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: DEFAULT_API_RATE_LIMIT.limit,
        window: DEFAULT_API_RATE_LIMIT.window,
      })
    );

    expect(res.headers.get("x-ratelimit-limit")).toBe("120");
    expect(res.headers.get("x-ratelimit-remaining")).toBe("119");
  });

  it("should honor explicit custom rateLimit options", async () => {
    const rateLimitSpy = vi.spyOn(rateLimitModule, "rateLimit").mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: Math.floor(Date.now() / 1000) + 60,
    });

    const handler = apiWrapper(
      async () => {
        return NextResponse.json({ ok: true });
      },
      { rateLimit: { limit: 5, window: 60 } }
    );

    const req = new NextRequest("http://localhost:3000/api/sensitive-route");
    await handler(req, { params: Promise.resolve({}) });

    expect(rateLimitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 5,
        window: 60,
      })
    );
  });

  it("should skip rate limiting when skipRateLimit is true", async () => {
    const rateLimitSpy = vi.spyOn(rateLimitModule, "rateLimit");

    const handler = apiWrapper(
      async () => {
        return NextResponse.json({ ok: true });
      },
      { skipRateLimit: true }
    );

    const req = new NextRequest("http://localhost:3000/api/health");
    const res = await handler(req, { params: Promise.resolve({}) });

    expect(rateLimitSpy).not.toHaveBeenCalled();
    expect(res.headers.get("x-ratelimit-limit")).toBeNull();
  });
});
