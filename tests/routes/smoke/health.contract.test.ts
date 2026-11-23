import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeAuthedRequest, makeSession } from "../../utils/auth";
import { createFetchMock } from "../../utils/fetch-mock";
import { createLoggerSpy } from "../../utils/logger-spy";
import { apiWrapper } from "@/lib/api-wrapper";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

describe("Route Contract Smoke: apiWrapper and Auth Contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authenticates valid session and passes parsed request body", async () => {
    const loggerSpy = createLoggerSpy();
    const session = makeSession("BRAND");
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session);

    const testSchema = z.object({
      campaignName: z.string(),
      budgetPaise: z.number().int().positive(),
    }).strict();

    const handler = apiWrapper(
      async (req) => {
        const body = req.validBody as { budgetPaise: number };
        return NextResponse.json({
          status: "SUCCESS",
          user: req.session?.user?.id,
          receivedBudget: body?.budgetPaise,
        });
      },
      {
        requireAuth: true,
        validate: {
          body: testSchema,
        },
      }
    );

    const { req, context } = makeAuthedRequest("BRAND", {
      body: {
        campaignName: "Festive Blitz",
        budgetPaise: 5000000,
      },
    });

    const res = await handler(req, context);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe("SUCCESS");
    expect(json.receivedBudget).toBe(5000000);
    expect(json.user).toBe(session.user.id);

    loggerSpy.restore();
  });

  it("rejects unauthorized request with 401 when requireAuth is enabled", async () => {
    const loggerSpy = createLoggerSpy();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const handler = apiWrapper(
      async () => {
        return NextResponse.json({ status: "OK" });
      },
      {
        requireAuth: true,
      }
    );

    const { req, context } = makeAuthedRequest(null);
    const res = await handler(req, context);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");

    loggerSpy.restore();
  });

  it("strictly enforces Zod schema validation on payload", async () => {
    const loggerSpy = createLoggerSpy();

    const testSchema = z.object({
      fieldA: z.string(),
    }).strict();

    const handler = apiWrapper(
      async () => {
        return NextResponse.json({ status: "OK" });
      },
      {
        validate: {
          body: testSchema,
        },
      }
    );

    // Invalid body missing fieldA
    const { req, context } = makeAuthedRequest("BRAND", {
      body: { invalidField: 123 },
    });

    const res = await handler(req, context);
    expect(res.status).toBe(400);

    loggerSpy.restore();
  });

  it("fails fast via strict fetch mock on unexpected external calls", async () => {
    const fetchMock = createFetchMock();

    // Register an allowed mock endpoint
    fetchMock.mockJson("https://api.allowed.com/ping", { ok: true });

    // Call allowed endpoint
    const res = await fetch("https://api.allowed.com/ping");
    const json = await res.json();
    expect(json.ok).toBe(true);

    // Call unmocked endpoint -> must throw UnexpectedFetchError
    await expect(fetch("https://api.unregistered-vendor.com/bad")).rejects.toThrow(
      /Unexpected fetch call/
    );

    fetchMock.restore();
  });
});
