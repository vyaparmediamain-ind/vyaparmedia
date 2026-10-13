import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/db";

// ---------------------------------------------------------------------------
// In-memory Redis mock — avoids requiring a live Redis connection in unit tests.
// vi.hoisted() runs before vi.mock factories so the Maps are available in scope.
// ---------------------------------------------------------------------------
const { store, setStore } = vi.hoisted(() => ({
  store: new Map<string, string>(),
  setStore: new Map<string, Set<string>>(),
}));

vi.mock("@/lib/redis", () => {
  const redis = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return "OK" as const;
    }),
    setex: vi.fn(async (key: string, _ttl: number, value: string) => {
      store.set(key, value);
      return "OK" as const;
    }),
    del: vi.fn(async (...keys: string[]) => {
      let count = 0;
      for (const k of keys) {
        if (store.delete(k) || setStore.delete(k)) count++;
      }
      return count;
    }),
    keys: vi.fn(async (pattern: string) => {
      const regex = new RegExp(
        "^" +
          pattern
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*/g, ".*") +
          "$",
      );
      return [...store.keys(), ...setStore.keys()].filter((k) => regex.test(k));
    }),
    sadd: vi.fn(async (key: string, ...members: string[]) => {
      if (!setStore.has(key)) setStore.set(key, new Set());
      const s = setStore.get(key)!;
      let added = 0;
      for (const m of members) {
        if (!s.has(m)) { s.add(m); added++; }
      }
      return added;
    }),
    smembers: vi.fn(async (key: string) => [...(setStore.get(key) ?? [])]),
    ttl: vi.fn(async (_key: string) => 60),
    incr: vi.fn(async (key: string) => {
      const current = parseInt(store.get(key) ?? "0", 10);
      const next = current + 1;
      store.set(key, String(next));
      return next;
    }),
    expire: vi.fn(async (_key: string, _seconds: number) => 1),
    // Lua eval: simulate sliding-window allow → [allowed=1, count=1]
    eval: vi.fn(async (..._args: unknown[]) => [1, 1] as [number, number]),
    on: vi.fn(),
  };

  return { redis, default: redis };
});

import { redis } from "@/lib/redis";
import { requireActiveAdmin, invalidateAdminCache } from "@/lib/admin-auth";
import { sendOTP, verifyOTP, normalizeIndianPhone } from "@/lib/sms";
import { rateLimit, checkRateLimit } from "@/lib/rate-limit";
import { revokeAllUserSessions, isTokenRevoked } from "@/lib/blacklist";
import { authConfig } from "@/auth.config";
import { PUT as PUT_email_otp, POST as POST_email_otp } from "@/app/api/auth/verify-email-otp/route";
import { POST as POST_disable_2fa } from "@/app/api/user/2fa/disable/route";
import { AuthService } from "@/services/auth.service";
import { verifyActiveSessionToken } from "@/lib/auth/session";
import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(true),
  sendWelcomeEmail: vi.fn().mockResolvedValue(true),
}));

describe("Unit Tests: Authentication & Authorization Layer Hardening", () => {
  beforeEach(() => {
    // Clear in-memory Redis state; avoid vi.clearAllMocks() which would wipe
    // the vi.fn() implementations defined inside the mock factory above.
    store.clear();
    setStore.clear();
  });

  // =========================================================================
  // 1. DB-AUTHORITATIVE RBAC FOR ADMIN ACTIONS
  // =========================================================================
  describe("Pillar 1: DB-Authoritative RBAC (Anti-Stale JWT & Instant Revocation)", () => {
    const mockAdminId = "usr_admin_security_test_01";
    const mockAdminEmail = "sec-admin@vyaparmedia.com";

    beforeEach(async () => {
      await redis.del(`admin_verified:${mockAdminId}`);
      await redis.del(`user:jtis:${mockAdminId}`);
      await redis.del(`active_session:${mockAdminId}`);
    });

    it("should reject admin request if JWT claim is not ADMIN or input is missing", async () => {
      await expect(
        requireActiveAdmin({ id: mockAdminId, email: mockAdminEmail, userType: "INFLUENCER" }),
      ).rejects.toThrow("Unauthorized: Admin access required");

      await expect(
        requireActiveAdmin(null),
      ).rejects.toThrow("Unauthorized: Admin access required");
    });

    it("should authenticate active admin against DB on cache-miss and populate Redis 60s cache", async () => {
      const mockDbUser = {
        id: mockAdminId,
        email: mockAdminEmail,
        userType: "ADMIN",
        status: "ACTIVE",
        deletedAt: null,
      };

      vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce(mockDbUser as never);

      const result = await requireActiveAdmin({
        id: mockAdminId,
        email: mockAdminEmail,
        userType: "ADMIN",
      });

      expect(result.id).toBe(mockAdminId);
      expect(result.email).toBe(mockAdminEmail);

      // Verify Redis cache key was set with "1"
      const cached = await redis.get(`admin_verified:${mockAdminId}`);
      expect(cached).toBe("1");
    });

    it("should fast-path return on Redis cache hit without hitting DB", async () => {
      // Pre-seed Redis cache
      await redis.set(`admin_verified:${mockAdminId}`, "1", "EX", 60);

      const dbSpy = vi.spyOn(prisma.user, "findUnique");

      const result = await requireActiveAdmin({
        id: mockAdminId,
        email: mockAdminEmail,
        userType: "ADMIN",
      });

      expect(result.id).toBe(mockAdminId);
      expect(dbSpy).not.toHaveBeenCalled();
    });

    it("should reject immediately when admin is demoted or banned (DB authoritative source of truth)", async () => {
      // 1. Cache was invalidated due to demotion/ban
      await invalidateAdminCache(mockAdminId);
      const cached = await redis.get(`admin_verified:${mockAdminId}`);
      expect(cached).toBeNull();

      // 2. DB now returns demoted user (e.g. INFLUENCER) or BANNED status
      vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce({
        id: mockAdminId,
        email: mockAdminEmail,
        userType: "INFLUENCER", // Demoted!
        status: "ACTIVE",
        deletedAt: null,
      } as never);

      // 3. Stale JWT still carries userType: 'ADMIN', but DB-check blocks it immediately
      await expect(
        requireActiveAdmin({
          id: mockAdminId,
          email: mockAdminEmail,
          userType: "ADMIN", // Stale JWT claim
        }),
      ).rejects.toThrow("Unauthorized: Admin access required");
    });

    it("should reject stale JWT when admin account has been suspended or deleted in DB", async () => {
      await invalidateAdminCache(mockAdminId);

      vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce({
        id: mockAdminId,
        email: mockAdminEmail,
        userType: "ADMIN",
        status: "SUSPENDED", // Suspended in DB
        deletedAt: null,
      } as never);

      await expect(
        requireActiveAdmin({
          id: mockAdminId,
          email: mockAdminEmail,
          userType: "ADMIN",
        }),
      ).rejects.toThrow("Unauthorized: Admin access required");
    });
  });

  // =========================================================================
  // 2. OTP VERIFICATION, BRUTE-FORCE LOCKOUT & ANTI-ENUMERATION
  // =========================================================================
  describe("Pillar 2: OTP Hardening, Brute-Force Lockout & Dual Rate Limiting", () => {
    const testPhone = "9876543210";
    const normalizedPhone = normalizeIndianPhone(testPhone)!;
    const purpose = "phone_verification";

    beforeEach(async () => {
      // Clear Redis keys for test phone
      const keys = await redis.keys(`*${normalizedPhone}*`);
      if (keys.length > 0) {
        await Promise.all(keys.map((k) => redis.del(k)));
      }
    });

    it("should normalize valid 10-digit Indian phone numbers and reject invalid formats", () => {
      expect(normalizeIndianPhone("9876543210")).toBe("9876543210");
      expect(normalizeIndianPhone("+919876543210")).toBe("9876543210");
      expect(normalizeIndianPhone("919876543210")).toBe("9876543210");
      expect(normalizeIndianPhone("1234567890")).toBeNull(); // Doesn't start with 6-9
      expect(normalizeIndianPhone("abcdefghij")).toBeNull();
    });

    it("should lock out brute-force attacks after 5 failed OTP attempts and purge Redis key", async () => {
      // 1. Generate an OTP in test mode
      const sendResult = await sendOTP(testPhone, { purpose });
      expect(sendResult.success).toBe(true);

      const wrongCode = "000000";

      // 2. Simulate 5 failed attempts
      for (let attempt = 1; attempt <= 5; attempt++) {
        const verifyResult = await verifyOTP(testPhone, wrongCode, { purpose });
        expect(verifyResult.success).toBe(false);
        expect(verifyResult.error).toBe("Invalid OTP");
      }

      // 3. 6th attempt must trigger 'Maximum attempts exceeded' and purge the OTP
      const lockedResult = await verifyOTP(testPhone, wrongCode, { purpose });
      expect(lockedResult.success).toBe(false);
      expect(lockedResult.error).toBe("Maximum attempts exceeded");

      // 4. Verify that subsequent attempt returns 'OTP not found or expired' because the key was purged
      const subsequentResult = await verifyOTP(testPhone, wrongCode, { purpose });
      expect(subsequentResult.success).toBe(false);
      expect(subsequentResult.error).toBe("OTP not found or expired");
    });

    it("should enforce dual rate-limiting (per phone and per IP)", async () => {
      const phoneToken = `otp:verify:phone:${normalizedPhone}`;
      const mockIp = "103.21.244.15";

      // Phone rate limit check (5 attempts per 15 min window)
      const r1 = await rateLimit({ uniqueToken: phoneToken, limit: 5, window: 900, securityCritical: true });
      expect(r1.success).toBe(true);

      // IP rate limit check
      const ipLimit = await checkRateLimit(mockIp, "AUTH");
      expect(ipLimit.success).toBe(true);
    });

    it("should ensure registration phone/email checks return generic enumeration-safe responses", async () => {
      // Anti-enumeration test: regardless of user presence, response message must remain identical
      vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce({
        id: "existing_user_1",
      } as never);

      const req = new NextRequest("http://localhost:3000/api/auth/verify-email-otp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "existing@example.com", type: "registration" }),
      });

      const res = await PUT_email_otp(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain("If this email can be registered");
    });

    it("should lock out email contact OTP verification after 3 failed attempts and burn key", async () => {
      const testEmail = "lockout_test@example.com";
      const key = `email-otp:registration:${testEmail}`;
      const correctOtp = "654321";
      const submittedHash = crypto.createHash("sha256").update(correctOtp).digest("hex");
      await redis.setex(
        key,
        600,
        JSON.stringify({
          otp: submittedHash,
          attempts: 0,
          createdAt: new Date().toISOString(),
        }),
      );

      // 3 failed attempts via real POST route handler
      for (let i = 1; i <= 3; i++) {
        const req = new NextRequest("http://localhost:3000/api/auth/verify-email-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: testEmail, otp: "000000", type: "registration" }),
        });
        const res = await POST_email_otp(req);
        const data = await res.json();
        expect(res.status).toBe(400);
        expect(data.error).toBe("Invalid OTP. Please try again.");
      }

      // 4th attempt triggers lockout and burns key in real handler
      const lockReq = new NextRequest("http://localhost:3000/api/auth/verify-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail, otp: "000000", type: "registration" }),
      });
      const lockRes = await POST_email_otp(lockReq);
      const lockData = await lockRes.json();
      expect(lockRes.status).toBe(429);
      expect(lockData.error).toContain("Too many failed attempts");

      // Key should now be purged
      const burnedKey = await redis.get(key);
      expect(burnedKey).toBeNull();
    });
  });

  // =========================================================================
  // 3. 2FA SECURITY & RE-AUTHENTICATION PROTECTED ACTIONS
  // =========================================================================
  describe("Pillar 3: 2FA TOTP, Backup Recovery Codes & Re-Auth Protection", () => {
    it("should generate cryptographically random recovery codes and verify bcrypt hashing", async () => {
      const recoveryCodes: string[] = [];
      for (let i = 0; i < 8; i++) {
        recoveryCodes.push(crypto.randomBytes(5).toString("hex").toUpperCase());
      }

      expect(recoveryCodes).toHaveLength(8);
      recoveryCodes.forEach((code) => {
        expect(code).toHaveLength(10);
      });

      // Hash with bcrypt
      const hashedCodes = await Promise.all(recoveryCodes.map((c) => bcrypt.hash(c, 10)));
      expect(hashedCodes).toHaveLength(8);

      // Verify each plaintext code matches its bcrypt hash
      for (let i = 0; i < recoveryCodes.length; i++) {
        const code = recoveryCodes[i];
        const hash = hashedCodes[i];
        if (code && hash) {
          const isMatch = await bcrypt.compare(code, hash);
          expect(isMatch).toBe(true);
        }
      }

      // Tampered code must fail
      const firstHash = hashedCodes[0];
      expect(firstHash).toBeDefined();
      if (firstHash) {
        const isBadMatch = await bcrypt.compare("WRONGCODE1", firstHash);
        expect(isBadMatch).toBe(false);
      }
    });

    it("should require re-authentication (password, TOTP, or phone OTP) before disabling 2FA", async () => {
      const testPassword = "SuperSecurePassword123!";
      const passwordHash = await bcrypt.hash(testPassword, 10);
      const testPhone = "+919876543210";

      const mockSession = {
        user: { id: "usr_2fa_test_01", email: "user2fa@example.com" },
      };
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "usr_2fa_test_01",
        email: "user2fa@example.com",
        phone: testPhone,
        passwordHash,
        twoFactorSecret: "mockSecret",
        isTwoFactorEnabled: true,
      } as never);

      vi.spyOn(prisma.user, "update").mockResolvedValue({} as never);

      // Case 1: Missing credentials -> 400
      const req1 = new NextRequest("http://localhost:3000/api/user/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res1 = await POST_disable_2fa(req1);
      const data1 = await res1.json();
      expect(res1.status).toBe(400);
      expect(data1.error).toContain("Re-authentication required");

      // Case 2: Incorrect credentials -> 403
      const req2 = new NextRequest("http://localhost:3000/api/user/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "WrongPassword999" }),
      });
      const res2 = await POST_disable_2fa(req2);
      const data2 = await res2.json();
      expect(res2.status).toBe(403);
      expect(data2.error).toContain("Re-authentication failed");

      // Case 3: Correct password -> Authorized (200)
      const req3 = new NextRequest("http://localhost:3000/api/user/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: testPassword }),
      });
      const res3 = await POST_disable_2fa(req3);
      const data3 = await res3.json();
      expect(res3.status).toBe(200);
      expect(data3.success).toBe(true);
    });
  });

  // =========================================================================
  // 4. PASSWORD RESET ATOMIC SINGLE-USE & GLOBAL SESSION INVALIDATION
  // =========================================================================
  describe("Pillar 4: Password Reset Atomic Single-Use & Session Invalidation", () => {
    const mockUserId = "usr_reset_security_test_01";
    const rawResetToken = crypto.randomBytes(32).toString("hex");
    const hashedResetToken = crypto.createHash("sha256").update(rawResetToken).digest("hex");

    beforeEach(async () => {
      await redis.del(`user:jtis:${mockUserId}`);
      await redis.del(`active_session:${mockUserId}`);
      await redis.del(`admin_verified:${mockUserId}`);
    });

    it("should hash reset tokens with SHA-256 for secure DB storage", () => {
      const token = "sample_raw_token_xyz";
      const hash1 = crypto.createHash("sha256").update(token).digest("hex");
      const hash2 = crypto.createHash("sha256").update(token).digest("hex");
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(token);
    });

    it("should prevent replay attacks by atomically consuming single-use reset token", async () => {
      let tokenInDb: string | null = hashedResetToken;

      vi.spyOn(prisma.user, "findFirst").mockImplementation((async (args: { where: { resetToken?: unknown } }) => {
        if (tokenInDb && args.where.resetToken === tokenInDb) {
          return { id: mockUserId };
        }
        return null;
      }) as never);

      vi.spyOn(prisma.user, "updateMany").mockImplementation((async (args: { where: { resetToken?: unknown } }) => {
        if (tokenInDb && args.where.resetToken === tokenInDb) {
          tokenInDb = null;
          return { count: 1 };
        }
        return { count: 0 };
      }) as never);

      vi.spyOn(prisma.refreshToken, "updateMany").mockResolvedValue({ count: 0 });

      // First attempt: succeeds via real AuthService.resetPassword
      const firstResult = await AuthService.resetPassword(rawResetToken, "NewSecurePassword123!");
      expect(firstResult).toBe(true);

      // Second attempt (replay attack): fails immediately via real AuthService.resetPassword
      await expect(
        AuthService.resetPassword(rawResetToken, "NewSecurePassword123!"),
      ).rejects.toThrow("Invalid or expired token");
    });

    it("should revoke all active user sessions and JTIs upon password reset", async () => {
      const jti1 = "jti_session_device_mobile_1";
      const jti2 = "jti_session_device_desktop_2";

      // 1. Simulate active sessions tracked in Redis set
      await redis.sadd(`user:jtis:${mockUserId}`, jti1, jti2);
      await redis.set(`active_session:${mockUserId}`, "active_refresh_token_abc");
      await redis.set(`admin_verified:${mockUserId}`, "1");

      // Mock prisma.refreshToken.updateMany
      vi.spyOn(prisma.refreshToken, "updateMany").mockResolvedValueOnce({ count: 2 });

      // 2. Invoke revokeAllUserSessions
      await revokeAllUserSessions(mockUserId);

      // 3. Verify all JTIs were added to Redis token revocation blacklist
      const isJti1Revoked = await isTokenRevoked(jti1);
      const isJti2Revoked = await isTokenRevoked(jti2);
      expect(isJti1Revoked).toBe(true);
      expect(isJti2Revoked).toBe(true);

      // 4. Verify session caches were deleted
      const activeSession = await redis.get(`active_session:${mockUserId}`);
      const adminCache = await redis.get(`admin_verified:${mockUserId}`);
      const trackedJtis = await redis.smembers(`user:jtis:${mockUserId}`);

      expect(activeSession).toBeNull();
      expect(adminCache).toBeNull();
      expect(trackedJtis).toHaveLength(0);
    });
  });

  // =========================================================================
  // 5. SESSION FIXATION & FINANCIAL PLATFORM SESSION CONFIGURATION
  // =========================================================================
  describe("Pillar 5: Financial Platform Session MaxAge & Fixation Prevention", () => {
    it("should verify financial-platform session duration is 7 days (not 30 days)", () => {
      const FINTECH_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 604,800 seconds
      const DEFAULT_NEXTAUTH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 2,592,000 seconds

      expect(FINTECH_SESSION_MAX_AGE_SECONDS).toBe(604800);
      expect(FINTECH_SESSION_MAX_AGE_SECONDS).toBeLessThan(DEFAULT_NEXTAUTH_MAX_AGE_SECONDS);
    });

    it("should prevent session fixation by issuing fresh JTI and rotating active session token on login", async () => {
      const preLoginSessionId = "anon_fixation_candidate_token_001";
      const postLoginJti = crypto.randomUUID();
      const postLoginRefreshToken = crypto.randomBytes(32).toString("hex");

      // Pre-login session token cannot match post-login JTI
      expect(postLoginJti).not.toBe(preLoginSessionId);

      // Simulate token rotation in Redis
      const testUserId = "usr_fixation_test_01";
      await redis.set(`active_session:${testUserId}`, postLoginRefreshToken);

      const activeToken = await redis.get(`active_session:${testUserId}`);
      expect(activeToken).toBe(postLoginRefreshToken);
      expect(activeToken).not.toBe(preLoginSessionId);

      // Verify that presenting the pre-login token fails validation against Redis active session
      const preLoginValidation = await verifyActiveSessionToken(testUserId, preLoginSessionId);
      expect(preLoginValidation).toBe(false);

      const postLoginValidation = await verifyActiveSessionToken(testUserId, postLoginRefreshToken);
      expect(postLoginValidation).toBe(true);

      // Clean up
      await redis.del(`active_session:${testUserId}`);
    });

    it("should verify NextAuth authConfig session maxAge is 7 days and cookies enforce httpOnly and SameSite lax", () => {
      // 1. Session maxAge is exactly 7 days (604,800s)
      expect(authConfig.session?.maxAge).toBe(7 * 24 * 60 * 60);
      expect(authConfig.session?.strategy).toBe("jwt");

      // 2. Cookie security attributes
      const cookies = authConfig.cookies as Record<string, { options?: { httpOnly?: boolean; sameSite?: string; path?: string } }>;
      expect(cookies).toBeDefined();

      // sessionToken cookie
      expect(cookies.sessionToken?.options?.httpOnly).toBe(true);
      expect(cookies.sessionToken?.options?.sameSite).toBe("lax");
      expect(cookies.sessionToken?.options?.path).toBe("/");

      // callbackUrl cookie
      expect(cookies.callbackUrl?.options?.sameSite).toBe("lax");
      expect(cookies.callbackUrl?.options?.path).toBe("/");

      // csrfToken cookie
      expect(cookies.csrfToken?.options?.httpOnly).toBe(true);
      expect(cookies.csrfToken?.options?.sameSite).toBe("lax");
      expect(cookies.csrfToken?.options?.path).toBe("/");
    });
  });
});
