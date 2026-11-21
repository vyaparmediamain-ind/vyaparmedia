import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isMasterInviteCode,
  getRegistrationGateConfig,
  setRegistrationGateConfig,
  DEFAULT_MASTER_INVITE_CODE,
} from "@/lib/registration-gate";

// Mock redis
vi.mock("@/lib/redis", () => {
  const store = new Map<string, string>();
  return {
    default: {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      set: vi.fn(async (key: string, val: string) => {
        store.set(key, val);
        return "OK";
      }),
      del: vi.fn(async (key: string) => {
        store.delete(key);
        return 1;
      }),
    },
  };
});

// Mock prisma
vi.mock("@/lib/db", () => {
  const dbRules = new Map<string, any>();
  return {
    default: {
      trustRuleConfig: {
        findMany: vi.fn(async ({ where }: any) => {
          const keys = where.ruleKey.in;
          return keys.map((k: string) => dbRules.get(k)).filter(Boolean);
        }),
        upsert: vi.fn(async ({ where, create, update }: any) => {
          const existing = dbRules.get(where.ruleKey);
          if (existing) {
            const updated = { ...existing, ...update, updatedAt: new Date() };
            dbRules.set(where.ruleKey, updated);
            return updated;
          }
          const created = { ...create, id: "rule_" + where.ruleKey, updatedAt: new Date() };
          dbRules.set(where.ruleKey, created);
          return created;
        }),
      },
      $transaction: vi.fn(async (cb: any) => {
        return cb({
          trustRuleConfig: {
            upsert: async ({ where, create, update }: any) => {
              const existing = dbRules.get(where.ruleKey);
              if (existing) {
                const updated = { ...existing, ...update, updatedAt: new Date() };
                dbRules.set(where.ruleKey, updated);
                return updated;
              }
              const created = { ...create, id: "rule_" + where.ruleKey, updatedAt: new Date() };
              dbRules.set(where.ruleKey, created);
              return created;
            },
          },
        });
      }),
    },
  };
});

describe("Registration Gatekeeper (Invite-Only Beta Mode)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should match master VIP invite code case-insensitively", () => {
    expect(isMasterInviteCode("vipbeta", "VIPBETA")).toBe(true);
    expect(isMasterInviteCode("VIPBETA", "VIPBETA")).toBe(true);
    expect(isMasterInviteCode("  VipBeta  ", "VIPBETA")).toBe(true);
    expect(isMasterInviteCode("RANDOM123", "VIPBETA")).toBe(false);
    expect(isMasterInviteCode("", "VIPBETA")).toBe(false);
    expect(isMasterInviteCode(undefined, "VIPBETA")).toBe(false);
  });

  it("should toggle registration mode to invite-only and persist in DB/Redis", async () => {
    const updated = await setRegistrationGateConfig({
      requireReferral: true,
      masterInviteCode: "BETA2026",
      adminUserId: "admin_123",
      adminEmail: "admin@vyaparmedia.in",
      reason: "Launch invite-only beta testing phase",
    });

    expect(updated.requireReferral).toBe(true);
    expect(updated.masterInviteCode).toBe("BETA2026");

    const fetched = await getRegistrationGateConfig();
    expect(fetched.requireReferral).toBe(true);
    expect(fetched.masterInviteCode).toBe("BETA2026");
  });

  it("should toggle back to open registration mode", async () => {
    const updated = await setRegistrationGateConfig({
      requireReferral: false,
      masterInviteCode: DEFAULT_MASTER_INVITE_CODE,
      adminUserId: "admin_123",
      adminEmail: "admin@vyaparmedia.in",
      reason: "Restore public registration",
    });

    expect(updated.requireReferral).toBe(false);
    expect(updated.masterInviteCode).toBe(DEFAULT_MASTER_INVITE_CODE);

    const fetched = await getRegistrationGateConfig();
    expect(fetched.requireReferral).toBe(false);
  });
});
