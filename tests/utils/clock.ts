import { vi } from "vitest";

/**
 * Executes a callback within a strictly frozen clock.
 * Restores real timers immediately on completion or failure.
 */
export async function withFixedClock<T>(
  isoDate: string | Date,
  fn: () => T | Promise<T>,
): Promise<T> {
  const targetDate = typeof isoDate === "string" ? new Date(isoDate) : isoDate;
  vi.useFakeTimers();
  vi.setSystemTime(targetDate);
  try {
    return await fn();
  } finally {
    vi.useRealTimers();
  }
}

/**
 * Sets the system clock to a fixed time and returns a handle to restore it.
 */
export function setFixedClock(isoDate: string | Date): { restore: () => void } {
  const targetDate = typeof isoDate === "string" ? new Date(isoDate) : isoDate;
  vi.useFakeTimers();
  vi.setSystemTime(targetDate);
  return {
    restore: () => {
      vi.useRealTimers();
    },
  };
}
