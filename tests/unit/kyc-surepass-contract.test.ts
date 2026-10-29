import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SurepassKYCProvider } from "@/lib/kyc/providers/surepass";
import {
  getCachedKYCResult,
  setCachedKYCResult,
  checkAadhaarOtpRateLimit,
  checkAadhaarOtpVerifyLimit,
  checkUserKYCRateLimit,
  trackSurepassDailySpend,
  SUREPASS_DAILY_SPEND_CAP_RUPEES,
} from "@/lib/kyc/cache";
import { verifyPAN, setKYCProvider } from "@/lib/kyc";
import { redis } from "@/lib/redis";

describe("KYC-SURE-01: Surepass Contract, Caching & Cost Throttling", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("caches successful PAN results in Redis and avoids repeated vendor calls", async () => {
    const panHash = `pan_hash_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const mockData = {
      name: "Ramesh Kumar",
      category: "Individual",
      panType: "P",
      documentNumber: "******1234",
    };

    // Initially cache is empty
    const cachedBefore = await getCachedKYCResult("PAN", panHash);
    expect(cachedBefore).toBeNull();

    // Cache the result
    await setCachedKYCResult("PAN", panHash, mockData, 3600);

    // Now cache hit returns data
    const cachedAfter = await getCachedKYCResult<typeof mockData>("PAN", panHash);
    expect(cachedAfter).not.toBeNull();
    expect(cachedAfter?.name).toBe("Ramesh Kumar");
  });

  it("verifyPAN serves from cache and avoids calling provider on cache hit", async () => {
    const pan = `ABCDE${Math.floor(1000 + Math.random() * 9000)}F`;
    const mockProvider = {
      name: "surepass",
      verifyAadhaar: vi.fn(),
      verifyPAN: vi.fn().mockResolvedValue({
        success: true,
        status: "VERIFIED",
        data: { name: "Test User", documentNumber: "******1234" },
      }),
      verifyGSTIN: vi.fn(),
      verifyBankAccount: vi.fn(),
    };
    setKYCProvider(mockProvider as any);

    // First call: provider is called
    const res1 = await verifyPAN(pan);
    expect(res1.success).toBe(true);
    expect(mockProvider.verifyPAN).toHaveBeenCalledTimes(1);

    // Second call: served from Redis cache, provider NOT called again
    const res2 = await verifyPAN(pan);
    expect(res2.success).toBe(true);
    expect(mockProvider.verifyPAN).toHaveBeenCalledTimes(1); // Still 1!
  });

  it("enforces per-user rate limit of max 3 Aadhaar OTP generations per 24 hours", async () => {
    const testUserId = `user_otp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // 1st attempt: allowed
    const r1 = await checkAadhaarOtpRateLimit(testUserId);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    // 2nd attempt: allowed
    const r2 = await checkAadhaarOtpRateLimit(testUserId);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    // 3rd attempt: allowed
    const r3 = await checkAadhaarOtpRateLimit(testUserId);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    // 4th attempt: throttled
    const r4 = await checkAadhaarOtpRateLimit(testUserId);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it("enforces per-client_id rate limit of max 3 Aadhaar OTP verify attempts", async () => {
    const testClientId = `client_otp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const r1 = await checkAadhaarOtpVerifyLimit(testClientId);
    expect(r1.allowed).toBe(true);
    const r2 = await checkAadhaarOtpVerifyLimit(testClientId);
    expect(r2.allowed).toBe(true);
    const r3 = await checkAadhaarOtpVerifyLimit(testClientId);
    expect(r3.allowed).toBe(true);
    const r4 = await checkAadhaarOtpVerifyLimit(testClientId);
    expect(r4.allowed).toBe(false);
  });

  it("enforces per-user rate limit of max 5 verification attempts per 24 hours", async () => {
    const testUserId = `user_kyc_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    for (let i = 0; i < 5; i++) {
      const res = await checkUserKYCRateLimit(testUserId);
      expect(res.allowed).toBe(true);
    }

    const blocked = await checkUserKYCRateLimit(testUserId);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("tracks Surepass daily spend and triggers cap alert when exceeding ₹5,000 limit", async () => {
    const dateKey = new Date().toISOString().slice(0, 10);
    await redis.del(`kyc:surepass:daily_spend:${dateKey}`);

    // Add spend below cap
    const initialSpend = await trackSurepassDailySpend(100);
    expect(initialSpend.capExceeded).toBe(false);

    // Add spend crossing cap
    const crossedSpend = await trackSurepassDailySpend(SUREPASS_DAILY_SPEND_CAP_RUPEES + 500);
    expect(crossedSpend.capExceeded).toBe(true);
  });

  it("returns user-friendly error (PENDING status, not REJECTED) on provider 503/timeout", async () => {
    const provider = new SurepassKYCProvider("test_key", "https://kyc-api.surepass.io");

    // Mock global fetch to simulate 503 provider down
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      Promise.resolve(new Response(JSON.stringify({ message: "Service Unavailable" }), { status: 503 }))
    );

    const result = await provider.verifyPAN("ABCDE1234F");
    expect(result.success).toBe(false);
    expect(result.status).toBe("PENDING");
    expect(result.error).toMatch(/available nahi|thodi der baad/i);
  });
});
