import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { assertNotProduction } from "../../scripts/guard-production";

describe("Production Guard for Scripts (P15 REL-08)", () => {
  const originalEnv = { ...process.env };
  const originalArgv = [...process.argv];

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.argv = [...originalArgv];
  });

  afterEach(() => {
    process.env = originalEnv;
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it("should block execution when NODE_ENV is production", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as unknown as (code?: string | number | null | undefined) => never);

    expect(() => assertNotProduction("test-script")).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("should block execution when VERCEL_ENV is production", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    process.env.VERCEL_ENV = "production";
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as unknown as (code?: string | number | null | undefined) => never);

    expect(() => assertNotProduction("test-script")).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("should block execution against a remote database without explicit flag", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    process.env.DATABASE_URL = "postgresql://postgres:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as unknown as (code?: string | number | null | undefined) => never);

    expect(() => assertNotProduction("test-script", { allowRemoteWithFlag: true })).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("should allow remote database when explicit flag --i-know-this-is-not-prod is provided", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    process.env.DATABASE_URL = "postgresql://postgres:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";
    process.argv.push("--i-know-this-is-not-prod");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as unknown as (code?: string | number | null | undefined) => never);

    expect(() => assertNotProduction("test-script", { allowRemoteWithFlag: true })).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("should always allow localhost database", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/vyapar_dev";

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as unknown as (code?: string | number | null | undefined) => never);

    expect(() => assertNotProduction("test-script")).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("should require wipe confirmation for clear-and-seed", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/vyapar_dev";

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as unknown as (code?: string | number | null | undefined) => never);

    // Missing confirmation
    expect(() => assertNotProduction("clear-and-seed", { requireWipeConfirmation: true })).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);

    // With confirmation
    process.argv.push("--confirm-wipe-database");
    exitSpy.mockClear();
    expect(() => assertNotProduction("clear-and-seed", { requireWipeConfirmation: true })).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
