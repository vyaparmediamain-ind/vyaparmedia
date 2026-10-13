import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CRON_JOBS } from "../../scripts/setup-qstash-crons";
import { validateCronSecret } from "@/app/api/cron/guard";
import { AppError } from "@/lib/errors";

// Mock next/headers
let mockHeaderStore: Record<string, string> = {};

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (name: string) => mockHeaderStore[name.toLowerCase()] || null,
  })),
}));

describe("Cron Guard & Authorization Architecture", () => {
  const TEST_SECRET = "test_cron_secret_abc123";
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    mockHeaderStore = {};
    process.env.CRON_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
  });

  it("throws internal server error if CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    await expect(validateCronSecret()).rejects.toThrowError(AppError);
    await expect(validateCronSecret()).rejects.toMatchObject({
      statusCode: 500,
      message: "CRON_SECRET is not configured",
    });
  });

  it("rejects unauthenticated requests without headers with 401 Unauthorized", async () => {
    await expect(validateCronSecret()).rejects.toThrowError(AppError);
    await expect(validateCronSecret()).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid Cron Secret or QStash Signature",
    });
  });

  it("rejects requests with an incorrect Bearer token with 401 Unauthorized", async () => {
    mockHeaderStore["authorization"] = "Bearer wrong_secret_key";
    await expect(validateCronSecret()).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid Cron Secret or QStash Signature",
    });
  });

  it("authorizes requests with a valid Bearer token", async () => {
    mockHeaderStore["authorization"] = `Bearer ${TEST_SECRET}`;
    await expect(validateCronSecret()).resolves.toBeUndefined();
  });

  it("authorizes requests with case-insensitive 'bearer' token", async () => {
    mockHeaderStore["authorization"] = `bearer ${TEST_SECRET}`;
    await expect(validateCronSecret()).resolves.toBeUndefined();
  });

  it("authorizes requests with a valid x-cron-secret header", async () => {
    mockHeaderStore["x-cron-secret"] = TEST_SECRET;
    await expect(validateCronSecret()).resolves.toBeUndefined();
  });

  it("authorizes requests with a valid x-api-key header", async () => {
    mockHeaderStore["x-api-key"] = TEST_SECRET;
    await expect(validateCronSecret()).resolves.toBeUndefined();
  });

  it("authorizes requests with test mock Upstash signature", async () => {
    const origKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const origNext = process.env.QSTASH_NEXT_SIGNING_KEY;
    delete process.env.QSTASH_CURRENT_SIGNING_KEY;
    delete process.env.QSTASH_NEXT_SIGNING_KEY;
    mockHeaderStore["upstash-signature"] = "valid_mock_qstash_signature";
    try {
      await expect(validateCronSecret()).resolves.toBeUndefined();
    } finally {
      process.env.QSTASH_CURRENT_SIGNING_KEY = origKey;
      process.env.QSTASH_NEXT_SIGNING_KEY = origNext;
    }
  });

  it("rejects requests attempting authentication via ?key=<secret> in URL query parameter (P0-REL-03)", async () => {
    const mockReq = new Request(`https://vyaparmedia-nine.vercel.app/api/cron/ledger-scan?key=${TEST_SECRET}`);
    await expect(validateCronSecret(mockReq)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("rejects requests attempting authentication via ?secret=<secret> in URL query parameter (P0-REL-03)", async () => {
    const mockReq = new Request(`https://vyaparmedia-nine.vercel.app/api/cron/ledger-scan?secret=${TEST_SECRET}`);
    await expect(validateCronSecret(mockReq)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("rejects requests with invalid query parameter secret", async () => {
    const mockReq = new Request(`https://vyaparmedia-nine.vercel.app/api/cron/ledger-scan?key=invalid_secret`);
    await expect(validateCronSecret(mockReq)).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});

describe("Upstash QStash Cron Job Schedule Definitions", () => {
  it("defines exactly 15 scheduled cron jobs", () => {
    expect(CRON_JOBS).toHaveLength(15);
  });

  it("ensures all jobs have unique IDs and unique route paths", () => {
    const ids = new Set(CRON_JOBS.map((j) => j.id));
    const paths = new Set(CRON_JOBS.map((j) => j.path));

    expect(ids.size).toBe(15);
    expect(paths.size).toBe(15);
  });

  it("ensures all cron expressions are valid 5-part cron syntax", () => {
    const cronRegex = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/;
    for (const job of CRON_JOBS) {
      expect(job.cron).toMatch(cronRegex);
    }
  });

  it("ensures all jobs have descriptions and positive timeouts", () => {
    for (const job of CRON_JOBS) {
      expect(job.name.length).toBeGreaterThan(5);
      expect(job.description.length).toBeGreaterThan(10);
      expect(job.timeoutSeconds).toBeGreaterThanOrEqual(30);
    }
  });
});

describe("Physical Cron Route Endpoints Audit", () => {
  it("verifies every route file exists on disk and is guarded", () => {
    for (const job of CRON_JOBS) {
      const routeFile = path.join(process.cwd(), "src/app", job.path, "route.ts");
      expect(fs.existsSync(routeFile), `Route file should exist: ${job.path}`).toBe(true);

      const content = fs.readFileSync(routeFile, "utf8");

      // Verify validateCronSecret is called
      expect(
        content.includes("validateCronSecret"),
        `Route ${job.path} must invoke validateCronSecret`
      ).toBe(true);

      // Verify GET and/or POST handlers are exported
      const hasGet = content.includes("export const GET =") || content.includes("export async function GET");
      const hasPost = content.includes("export const POST =") || content.includes("export async function POST");
      expect(
        hasGet || hasPost,
        `Route ${job.path} must export a GET or POST handler`
      ).toBe(true);

      // Verify distributed locking is implemented
      expect(
        content.includes("acquireDistributedLock"),
        `Route ${job.path} must implement distributed locking to prevent duplicate concurrent runs`
      ).toBe(true);
    }
  });
});
