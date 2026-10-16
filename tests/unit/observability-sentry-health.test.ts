import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scrubPiiString, scrubPiiObject, scrubSentryEvent } from "@/lib/sentry-sanitizer";
import { GET as healthGet } from "@/app/api/health/route";
import { GET as metricsGet } from "@/app/api/metrics/route";
import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { redis } from "@/lib/redis";

// Mock database and redis
vi.mock("@/lib/db", () => ({
  default: {
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    ping: vi.fn().mockResolvedValue("PONG"),
    get: vi.fn().mockResolvedValue(String(Date.now())),
  },
}));

describe("OBS-SENTRY-01: Sentry Sanitizer, Health Check Resilience, and Metrics Authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Requirement 1: Comprehensive PII Sanitizer Coverage", () => {
    const testCases = [
      {
        name: "Indian PAN number",
        input: "User PAN is ABCDE1234F submitted for KYC",
        expected: "User PAN is [REDACTED_PAN] submitted for KYC",
      },
      {
        name: "Aadhaar number (spaced)",
        input: "Aadhaar card 2345 6789 0123 verified",
        expected: "Aadhaar card [REDACTED_AADHAAR] verified",
      },
      {
        name: "Aadhaar number (hyphenated)",
        input: "Aadhaar card 2345-6789-0123 verified",
        expected: "Aadhaar card [REDACTED_AADHAAR] verified",
      },
      {
        name: "IFSC code",
        input: "Bank branch IFSC HDFC0001234 verified",
        expected: "Bank branch IFSC [REDACTED_IFSC] verified",
      },
      {
        name: "Indian mobile phone number",
        input: "Contact influencer at +91 9876543210 for deal",
        expected: "Contact influencer at [REDACTED_PHONE] for deal",
      },
      {
        name: "Personal email address",
        input: "Send invoice to creator.finance@gmail.com immediately",
        expected: "Send invoice to [REDACTED_EMAIL] immediately",
      },
      {
        name: "JWT authorization token",
        input: "Auth failed for eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c in session",
        expected: "Auth failed for [REDACTED_JWT] in session",
      },
      {
        name: "Bearer token string",
        input: "Request failed with header Bearer secret_live_token_xyz987==",
        expected: "Request failed with header Bearer [REDACTED_TOKEN]",
      },
      {
        name: "URL access_token query param",
        input: "https://vyaparmedia.in/auth/callback?access_token=ya29.a0AfH6SM12345&scope=read",
        expected: "https://vyaparmedia.in/auth/callback?access_token=[REDACTED]&scope=read",
      },
      {
        name: "Razorpay payment ID",
        input: "Failed payment capture for pay_1234567890abcdef at gateway",
        expected: "Failed payment capture for [REDACTED_PAYMENT_ID] at gateway",
      },
      {
        name: "Razorpay order ID",
        input: "Escrow lock created for order_1234567890abcdef successfully",
        expected: "Escrow lock created for [REDACTED_ORDER_ID] successfully",
      },
      {
        name: "Razorpay payout ID",
        input: "Settlement failed for payout pout_1234567890abcdef insufficient balance",
        expected: "Settlement failed for payout [REDACTED_PAYOUT_ID] insufficient balance",
      },
      {
        name: "Razorpay live API key",
        input: "Using key rzp_live_1234567890abcdef to call Razorpay",
        expected: "Using key [REDACTED_RAZORPAY_KEY] to call Razorpay",
      },
    ];

    testCases.forEach(({ name, input, expected }) => {
      it(`sanitizes ${name}`, () => {
        const result = scrubPiiString(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe("Requirement 2: Sentry Event Context Sanitization (User, Request, Breadcrumbs)", () => {
    it("strips user PII context and retains only user.id", () => {
      const mockEvent = {
        user: {
          id: "usr_12345",
          email: "victim@example.com",
          username: "priya_creator",
          ip_address: "203.0.113.42",
        },
      };

      const sanitized = scrubSentryEvent(mockEvent);
      expect(sanitized.user).toEqual({ id: "usr_12345" });
    });

    it("scrubs sensitive headers and query tokens from request context", () => {
      const mockEvent = {
        request: {
          url: "https://vyaparmedia.in/api/oauth?code=secret_code&access_token=token123",
          headers: {
            authorization: "Bearer sensitive_bearer_token",
            cookie: "next-auth.session-token=jwt12345; __Host-session=val",
            "x-api-key": "secret_key_123",
            "content-type": "application/json",
          },
          data: {
            pan: "ABCDE1234F",
            email: "test@example.com",
            phone: "+91 9876543210",
          },
        },
      };

      const sanitized = scrubSentryEvent(mockEvent);
      expect(sanitized.request?.headers?.authorization).toBe("[REDACTED]");
      expect(sanitized.request?.headers?.cookie).toBe("[REDACTED]");
      expect(sanitized.request?.headers?.["x-api-key"]).toBe("[REDACTED]");
      expect(sanitized.request?.headers?.["content-type"]).toBe("application/json");
      expect(sanitized.request?.url).toContain("access_token=[REDACTED]");
      expect(sanitized.request?.data?.pan).toBe("[REDACTED]");
      expect(sanitized.request?.data?.email).toBe("[REDACTED]");
    });

    it("scrubs breadcrumbs containing query parameters and sensitive messages", () => {
      const mockEvent = {
        breadcrumbs: [
          {
            category: "http",
            data: {
              url: "https://api.razorpay.com/v1/payments/pay_1234567890abcdef?access_token=secret",
            },
            message: "Fetched payment pay_1234567890abcdef for PAN ABCDE1234F",
          },
        ],
      };

      const sanitized = scrubSentryEvent(mockEvent);
      const b = sanitized.breadcrumbs?.[0];
      expect(b?.data?.url).toContain("[REDACTED_PAYMENT_ID]");
      expect(b?.data?.url).toContain("access_token=[REDACTED]");
      expect(b?.message).toContain("[REDACTED_PAYMENT_ID]");
      expect(b?.message).toContain("[REDACTED_PAN]");
    });

    it("scrubs deeply nested objects and arrays using scrubPiiObject", () => {
      const nested = {
        metadata: {
          userPan: "ABCDE1234F",
          recipients: ["user@domain.com", "+91 9876543210"],
        },
      };
      const sanitized = scrubPiiObject(nested);
      expect(sanitized.metadata.userPan).toBe("[REDACTED]");
      expect(sanitized.metadata.recipients[0]).toBe("[REDACTED_EMAIL]");
      expect(sanitized.metadata.recipients[1]).toBe("[REDACTED_PHONE]");
    });
  });

  describe("Requirement 3: Sentry Edge Config beforeSend Integration", () => {
    it("ensures sentry.edge.config.ts imports and attaches beforeSend sanitizer", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const edgeContent = fs.readFileSync(path.join(process.cwd(), "sentry.edge.config.ts"), "utf-8");

      expect(edgeContent).toContain("beforeSend");
      expect(edgeContent).toContain("scrubPiiObject");
    });
  });

  describe("Requirement 4: Health Check Real Degradation (Without Simulate)", () => {
    it("returns HTTP 503 and DEGRADED when database query fails organically", async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error("Connection pool timeout / network partition"));

      const req = new NextRequest("http://localhost:3000/api/health");
      const res = await healthGet(req);
      const data = await res.json();

      expect(res.status).toBe(503);
      expect(data.status).toBe("DEGRADED");
      expect(data.services.database).toBe("DOWN");
    });

    it("returns HTTP 503 and DEGRADED when Redis ping fails organically", async () => {
      vi.mocked(redis.ping).mockRejectedValueOnce(new Error("Redis ECONNREFUSED"));

      const req = new NextRequest("http://localhost:3000/api/health");
      const res = await healthGet(req);
      const data = await res.json();

      expect(res.status).toBe(503);
      expect(data.status).toBe("DEGRADED");
      expect(data.services.redis).toBe("DOWN");
    });
  });

  describe("Requirement 5: Metrics Bearer Token Protection", () => {
    const origToken = process.env.PROMETHEUS_AUTH_TOKEN;

    beforeEach(() => {
      process.env.PROMETHEUS_AUTH_TOKEN = "valid_metrics_bearer_token_12345678";
    });

    afterEach(() => {
      process.env.PROMETHEUS_AUTH_TOKEN = origToken;
    });

    it("returns HTTP 404 if PROMETHEUS_AUTH_TOKEN is unset in environment", async () => {
      delete process.env.PROMETHEUS_AUTH_TOKEN;

      const req = new Request("http://localhost:3000/api/metrics");
      const res = await metricsGet(req);
      expect(res.status).toBe(404);
    });

    it("returns HTTP 401 when Authorization header is missing or invalid", async () => {
      const req = new Request("http://localhost:3000/api/metrics", {
        headers: { Authorization: "Bearer wrong_token" },
      });
      const res = await metricsGet(req);
      expect(res.status).toBe(401);
    });

    it("returns HTTP 200 with Prometheus metrics when correct Bearer token is provided", async () => {
      const req = new Request("http://localhost:3000/api/metrics", {
        headers: { Authorization: "Bearer valid_metrics_bearer_token_12345678" },
      });
      const res = await metricsGet(req);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("VyaparMedia_");
    });
  });
});
