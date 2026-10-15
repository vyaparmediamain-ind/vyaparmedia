import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normalizeIndianPhone, sendOTP, checkAndIncrementDailySmsCap } from "@/lib/sms";
import { setKillSwitch, clearKillSwitchOverrides, KILL_SWITCH_FEATURES } from "@/lib/kill-switch";
import redis from "@/lib/redis";
import * as comm from "@/lib/communication";

describe("COMM-OTP-01: OTP Toll Fraud Prevention, Geo Allowlist, Daily Cap & Failure UX", () => {
  beforeEach(() => {
    clearKillSwitchOverrides();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearKillSwitchOverrides();
    vi.restoreAllMocks();
  });

  describe("Geo-Allowlist (+91 Only)", () => {
    it("accepts valid Indian phone numbers with or without +91/91", () => {
      expect(normalizeIndianPhone("9876543210")).toBe("9876543210");
      expect(normalizeIndianPhone("+919876543210")).toBe("9876543210");
      expect(normalizeIndianPhone("919876543210")).toBe("9876543210");
      expect(normalizeIndianPhone("+91 9876543210")).toBe("9876543210");
    });

    it("rejects non-Indian phone numbers to prevent SMS pumping / toll fraud", () => {
      // US (+1)
      expect(normalizeIndianPhone("+14155552671")).toBeNull();
      // UK (+44)
      expect(normalizeIndianPhone("+447911123456")).toBeNull();
      // China (+86)
      expect(normalizeIndianPhone("+8613800000000")).toBeNull();
      // Invalid format
      expect(normalizeIndianPhone("12345")).toBeNull();
      expect(normalizeIndianPhone("not-a-number")).toBeNull();
    });
  });

  describe("Daily SMS Cap & Cost Protection", () => {
    it("permits SMS within daily cap and rejects when limit is exceeded", async () => {
      let count = 0;
      vi.spyOn(redis, "incr").mockImplementation(async () => {
        count += 1;
        return count;
      });
      vi.spyOn(redis, "expire").mockResolvedValue(1 as never);

      // Within limit (limit 5)
      expect(await checkAndIncrementDailySmsCap(5)).toBe(true);
      expect(await checkAndIncrementDailySmsCap(5)).toBe(true);
      expect(await checkAndIncrementDailySmsCap(5)).toBe(true);
      expect(await checkAndIncrementDailySmsCap(5)).toBe(true);
      expect(await checkAndIncrementDailySmsCap(5)).toBe(true);

      // Exceeded limit
      expect(await checkAndIncrementDailySmsCap(5)).toBe(false);
    });
  });

  describe("Failure UX (MESSAGES.md Compliance)", () => {
    it("returns polite Hindi/English failure message with no raw provider details on total delivery failure", async () => {
      const origPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      const origToken = process.env.WHATSAPP_ACCESS_TOKEN;
      const origTemplate = process.env.WHATSAPP_OTP_TEMPLATE_NAME;

      try {
        process.env.WHATSAPP_PHONE_NUMBER_ID = "phone_meta_test";
        process.env.WHATSAPP_ACCESS_TOKEN = "token_meta_test";
        process.env.WHATSAPP_OTP_TEMPLATE_NAME = "otp_meta_template";

        vi.spyOn(redis, "ttl").mockResolvedValue(-2 as never);
        vi.spyOn(redis, "get").mockResolvedValue(null as never);

        // Force vendor failure
        vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network connection dropped"));
        vi.spyOn(comm, "sendSMS").mockResolvedValue(false);

        const res = await sendOTP("9876543210", { purpose: "phone_verification" });

        expect(res.success).toBe(false);
        expect(res.error).toBe("OTP bhejne me dikkat aayi. 60 second baad dobara try karein");
        // Never reveal vendor name
        expect(res.error).not.toContain("Twilio");
        expect(res.error).not.toContain("MSG91");
        expect(res.error).not.toContain("Meta");
      } finally {
        process.env.WHATSAPP_PHONE_NUMBER_ID = origPhoneId;
        process.env.WHATSAPP_ACCESS_TOKEN = origToken;
        process.env.WHATSAPP_OTP_TEMPLATE_NAME = origTemplate;
      }
    });
  });

  describe("Operational Kill Switch for OTP", () => {
    it("blocks OTP send when killswitch:otp is activated", async () => {
      setKillSwitch("killswitch:otp" as any, true);

      const res = await sendOTP("9876543210", { purpose: "phone_verification" });

      expect(res.success).toBe(false);
      expect(res.error).toBe("OTP bhejne me dikkat aayi. 60 second baad dobara try karein");
    });
  });
});
