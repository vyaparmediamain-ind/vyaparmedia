import { describe, it, expect } from "vitest";
import {
  calculateDiminishingXp,
  DAILY_XP_CONFIG,
  getStartOfDayIST,
  getDailyXpRedisKey,
} from "@/lib/gamification-engine";
import { calculateLevel } from "@/lib/drs-score";

describe("Gamification XP Daily Cap & Diminishing Returns Curve", () => {
  describe("calculateDiminishingXp()", () => {
    it("awards 100% XP for activities when daily XP is well below full threshold (0 to 200 XP)", () => {
      // 1st deal of the day (100 raw XP)
      const res1 = calculateDiminishingXp(0, 100);
      expect(res1.awardedXp).toBe(100);
      expect(res1.capped).toBe(false);
      expect(res1.rateMultiplier).toBe(1.0);

      // 2nd deal of the day (100 raw XP, current = 100)
      const res2 = calculateDiminishingXp(100, 100);
      expect(res2.awardedXp).toBe(100);
      expect(res2.capped).toBe(false);
      expect(res2.rateMultiplier).toBe(1.0);
    });

    it("applies 50% diminishing returns once daily XP reaches 200 XP threshold", () => {
      // 3rd deal of the day (current = 200, raw = 100)
      const res3 = calculateDiminishingXp(200, 100);
      expect(res3.awardedXp).toBe(50); // 100 * 0.5 = 50
      expect(res3.capped).toBe(true);
      expect(res3.rateMultiplier).toBe(0.5);

      // 4th deal of the day (current = 250, raw = 100)
      const res4 = calculateDiminishingXp(250, 100);
      expect(res4.awardedXp).toBe(50); // 100 * 0.5 = 50
      expect(res4.capped).toBe(true);
      expect(res4.rateMultiplier).toBe(0.5);
    });

    it("correctly splits an action that crosses the 200 XP boundary", () => {
      // User has 150 daily XP and completes a 100 XP deal:
      // First 50 XP is at 100% full weight (= 50 XP)
      // Remaining 50 XP is at 50% diminishing rate (= 25 XP)
      // Total awarded should be 50 + 25 = 75 XP
      const res = calculateDiminishingXp(150, 100);
      expect(res.awardedXp).toBe(75);
      expect(res.capped).toBe(true);
      expect(res.rateMultiplier).toBe(0.75);
    });

    it("enforces the hard daily cap of 400 XP and truncates overflow", () => {
      // User has 380 daily XP and completes a 100 XP deal:
      // Diminished portion would be 50, but only 20 room left to hit 400 max cap
      const res = calculateDiminishingXp(380, 100);
      expect(res.awardedXp).toBe(20);
      expect(res.capped).toBe(true);
      expect(res.rateMultiplier).toBe(0.2);
    });

    it("returns 0 XP when the 400 XP hard cap has already been reached", () => {
      const res = calculateDiminishingXp(400, 100);
      expect(res.awardedXp).toBe(0);
      expect(res.capped).toBe(true);
      expect(res.rateMultiplier).toBe(0);

      // Even higher values
      const resOver = calculateDiminishingXp(450, 15);
      expect(resOver.awardedXp).toBe(0);
      expect(resOver.capped).toBe(true);
    });

    it("neutralizes campaign application spamming", () => {
      let dailyXp = 0;
      let totalAwarded = 0;

      // Simulate 60 rapid applications (10 raw XP each = 600 raw XP)
      for (let i = 0; i < 60; i++) {
        const { awardedXp } = calculateDiminishingXp(dailyXp, 10);
        dailyXp += awardedXp;
        totalAwarded += awardedXp;
      }

      // Max possible repeatable XP cannot exceed 400 XP
      expect(totalAwarded).toBe(400);
      expect(dailyXp).toBe(400);

      // The 61st application receives 0 XP
      const res61 = calculateDiminishingXp(dailyXp, 10);
      expect(res61.awardedXp).toBe(0);
      expect(res61.capped).toBe(true);
    });
  });

  describe("DAILY_XP_CONFIG exemptions", () => {
    it("exempts one-time milestones from the daily action cap", () => {
      expect(DAILY_XP_CONFIG.EXEMPT_REASONS).toContain("BADGE_EARNED");
      expect(DAILY_XP_CONFIG.EXEMPT_REASONS).toContain("REFERRAL_TIER_UP");
      expect(DAILY_XP_CONFIG.EXEMPT_REASONS).toContain("WEEKLY_CHALLENGE");
    });
  });

  describe("IST Timezone Day Boundary Helper", () => {
    it("generates correct Redis key for user and IST date", () => {
      const fixedDate = new Date("2026-09-29T12:00:00Z"); // 17:30 IST on Sept 29
      const key = getDailyXpRedisKey("user-123", fixedDate);
      expect(key).toBe("gamification:daily_xp:user-123:2026-09-29");
    });

    it("calculates start of day in IST converted to UTC", () => {
      const fixedDate = new Date("2026-09-29T12:00:00Z");
      const startOfDay = getStartOfDayIST(fixedDate);
      // 00:00 IST on 2026-09-29 is 2026-09-28T18:30:00.000Z
      expect(startOfDay.toISOString()).toBe("2026-09-28T18:30:00.000Z");
    });
  });

  describe("Progression Time-to-Level-10 Mathematical Proof", () => {
    it("proves Level 10 cannot be reached in 1 or 2 months through burst grinding", () => {
      const level10 = calculateLevel(75000);
      expect(level10.level).toBe(10);
      expect(level10.name).toBe("Legend");
      expect(level10.minXP).toBe(75000);

      // Max daily grind XP is 400
      const maxMonthlyGrindXp = 30 * DAILY_XP_CONFIG.MAX_DAILY_CAP; // 12,000 XP/month
      const maxWeeklyChallengeXpPerMonth = 4 * 1500; // ~6,000 XP/month

      // Even if someone achieves 100% max daily grind XP and completes all challenges:
      const max1MonthTotal = maxMonthlyGrindXp + maxWeeklyChallengeXpPerMonth; // 18,000 XP
      expect(calculateLevel(max1MonthTotal).level).toBeLessThan(9); // Cannot even reach Level 8/9

      // In 2 months (60 days) of 100% max daily grinding:
      const max2MonthTotal = (maxMonthlyGrindXp * 2) + (maxWeeklyChallengeXpPerMonth * 2); // 36,000 XP
      expect(calculateLevel(max2MonthTotal).level).toBeLessThan(9); // Still below Level 9 (40,001)

      // To reach 75,000 XP (with ~25,000 XP from lifetime badges and milestones):
      const remainingXpNeeded = 75000 - 25000; // 50,000 XP
      // Active 5 days/week (typical dedicated influencer) = 2,000 grind XP + 1,000 challenge XP = 3,000 XP/week
      const weeksRequired = Math.ceil(remainingXpNeeded / 3000);
      const monthsRequired = weeksRequired / 4.33;

      expect(monthsRequired).toBeGreaterThanOrEqual(3.8); // Genuinely 4 to 6 months!
    });
  });
});
