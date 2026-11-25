import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TelemetryService } from "@/services/telemetry.service";
import { telemetryEventsDroppedTotal } from "@/lib/metrics";
import * as featureFlagsModule from "@/lib/feature-flags";

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn(),
  FEATURE_FLAGS: {
    TELEMETRY_ANONYMOUS: "telemetry_anonymous",
    TELEMETRY_IDENTIFIED: "telemetry_identified",
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    rpush: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
  },
}));

describe("Telemetry Salt Security", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(featureFlagsModule.isFeatureEnabled).mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("drops telemetry event with counter when all salt secrets are missing (refuses public constant fallback)", async () => {
    delete process.env.TELEMETRY_DAILY_SALT_SECRET;
    delete process.env.TELEMETRY_DAILY_SALT;
    delete process.env.NEXTAUTH_SECRET;

    const incSpy = vi.spyOn(telemetryEventsDroppedTotal, "inc");

    const result = await TelemetryService.enqueueTrackEvent({
      routeKey: "/campaigns",
      tabId: "tab_12345678",
      deviceType: "desktop",
      activeMs: 1500,
      maxScrollPct: 80,
    });

    expect(result.enqueued).toBe(false);
    expect(result.droppedReason).toBe("missing_salt_secret");
    expect(incSpy).toHaveBeenCalledWith({ reason: "missing_salt_secret" });
  });

  it("enqueues telemetry event normally when TELEMETRY_DAILY_SALT_SECRET is present", async () => {
    process.env.TELEMETRY_DAILY_SALT_SECRET = "production_secure_salt_value_12345";

    const incSpy = vi.spyOn(telemetryEventsDroppedTotal, "inc");

    const result = await TelemetryService.enqueueTrackEvent({
      routeKey: "/campaigns",
      tabId: "tab_45678910",
      deviceType: "mobile",
      activeMs: 2500,
      maxScrollPct: 50,
    });

    expect(result.enqueued).toBe(true);
    expect(incSpy).not.toHaveBeenCalledWith({ reason: "missing_salt_secret" });
  });
});
