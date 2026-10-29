import { describe, it, expect } from "vitest";
import { parsePagination, MAX_PAGINATION_PAGE, MAX_PAGINATION_LIMIT } from "@/lib/utils-client";
import { paginationSchema } from "@/lib/validations";

describe("SEC-PAGINATION-01: Pagination & Offset Hardening", () => {
  it("enforces maximum page boundary in parsePagination utility", () => {
    // Normal input
    const normal = parsePagination(new URLSearchParams("page=5&limit=20"));
    expect(normal.page).toBe(5);
    expect(normal.limit).toBe(20);
    expect(normal.skip).toBe(80);

    // Deep offset attack: page = 999999
    const deepAttack = parsePagination(new URLSearchParams("page=999999&limit=50"));
    expect(deepAttack.page).toBe(MAX_PAGINATION_PAGE);
    expect(deepAttack.limit).toBe(MAX_PAGINATION_LIMIT);
    expect(deepAttack.skip).toBe((MAX_PAGINATION_PAGE - 1) * MAX_PAGINATION_LIMIT);
    expect(deepAttack.skip).toBe(49950); // Capped below 50,000

    // Extreme limit attack: limit = 50000
    const limitAttack = parsePagination(new URLSearchParams("page=1&limit=50000"));
    expect(limitAttack.limit).toBe(MAX_PAGINATION_LIMIT);
    expect(limitAttack.skip).toBe(0);

    // Negative page attack: page = -10
    const negAttack = parsePagination(new URLSearchParams("page=-10&limit=-5"));
    expect(negAttack.page).toBe(1);
    expect(negAttack.limit).toBe(1);
    expect(negAttack.skip).toBe(0);
  });

  it("enforces max bounds in paginationSchema Zod validation", () => {
    // Valid input
    const valid = paginationSchema.safeParse({ page: "10", limit: "50" });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.page).toBe(10);
      expect(valid.data.limit).toBe(50);
    }

    // Invalid input: page exceeding max
    const pageExceeded = paginationSchema.safeParse({ page: "1001", limit: "20" });
    expect(pageExceeded.success).toBe(false);

    // Invalid input: limit exceeding max
    const limitExceeded = paginationSchema.safeParse({ page: "1", limit: "101" });
    expect(limitExceeded.success).toBe(false);
  });
});

