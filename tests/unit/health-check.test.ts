import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/health/route";

// Mock database and redis for unit testing the health route
vi.mock("@/lib/db", () => {
  return {
    default: {
      $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    },
  };
});

vi.mock("@/lib/redis", () => {
  return {
    redis: {
      ping: vi.fn().mockResolvedValue("PONG"),
    },
  };
});

describe("Health Check Endpoint (/api/health)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.QSTASH_TOKEN = "valid_mock_qstash_token_12345";
  });

  it("returns HTTP 200 and OK status when all core services (DB, Redis, QStash) are healthy", async () => {
    const req = new NextRequest("http://localhost:3000/api/health");
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("OK");
    expect(body.services.database).toBe("OK");
    expect(body.services.redis).toBe("OK");
    expect(body.services.qstash).toBe("OK");
    expect(typeof body.uptime).toBe("number");
    expect(typeof body.timestamp).toBe("number");
  });

  it("returns HTTP 503 and DEGRADED status when ?simulate=db_down is requested", async () => {
    const req = new NextRequest("http://localhost:3000/api/health?simulate=db_down");
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("DEGRADED");
    expect(body.services.database).toBe("DOWN (SIMULATED)");
    expect(body.services.redis).toBe("OK");
  });

  it("reports QStash as UNCONFIGURED when token is missing", async () => {
    delete process.env.QSTASH_TOKEN;

    const req = new NextRequest("http://localhost:3000/api/health");
    const response = await GET(req);
    const body = await response.json();

    expect(body.services.qstash).toBe("UNCONFIGURED");
    // Core status remains OK or dependent on DB/Redis
    expect(response.status).toBe(200);
  });
});
