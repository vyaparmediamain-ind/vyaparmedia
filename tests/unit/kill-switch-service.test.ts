import { describe, it, expect, beforeEach } from "vitest";
import {
  isKillSwitchActive,
  setKillSwitchOverride,
  clearKillSwitchOverrides,
  assertKillSwitchInactive,
  getAllKillSwitches,
  getKillSwitchMessage,
  KILL_SWITCH_FEATURES,
  KILL_SWITCH_METADATA,
} from "@/lib/kill-switch";

describe("Operational Kill-Switch & Circuit Breaker Engine", () => {
  beforeEach(() => {
    clearKillSwitchOverrides();
  });

  it("should fail open and return false when switches are inactive", async () => {
    setKillSwitchOverride("killswitch:withdrawals", false);
    const active = await isKillSwitchActive("killswitch:withdrawals");
    expect(active).toBe(false);
  });

  it("should block with 503 error when assertKillSwitchInactive encounters active switch", async () => {
    setKillSwitchOverride("killswitch:withdrawals", true);

    await expect(assertKillSwitchInactive("killswitch:withdrawals")).rejects.toThrow(
      /Withdrawals are temporarily paused/,
    );
  });

  it("should pass assertKillSwitchInactive when switch is inactive", async () => {
    setKillSwitchOverride("killswitch:withdrawals", false);
    await expect(assertKillSwitchInactive("killswitch:withdrawals")).resolves.toBeUndefined();
  });

  it("should return rich metadata for all 16 registered platform circuit breakers", async () => {
    const all = await getAllKillSwitches();
    expect(all.length).toBe(16);

    const withdrawals = all.find((s) => s.feature === "killswitch:withdrawals");
    expect(withdrawals).toBeDefined();
    expect(withdrawals?.severity).toBe("CRITICAL");
    expect(withdrawals?.category).toBe("FINANCIAL");
    expect(withdrawals?.title).toBe("Creator & Brand Withdrawals");

    const razorpay = all.find((s) => s.feature === "killswitch:vendor:razorpay");
    expect(razorpay).toBeDefined();
    expect(razorpay?.severity).toBe("CRITICAL");
    expect(razorpay?.category).toBe("VENDOR");

    const signups = all.find((s) => s.feature === "killswitch:signups");
    expect(signups).toBeDefined();
    expect(signups?.severity).toBe("CRITICAL");
    expect(signups?.category).toBe("SECURITY");
  });

  it("should have user-friendly degraded messages for every kill switch feature", () => {
    for (const key of Object.values(KILL_SWITCH_FEATURES)) {
      const msg = getKillSwitchMessage(key);
      expect(typeof msg).toBe("string");
      expect(msg.length).toBeGreaterThan(15);
    }
  });
});
