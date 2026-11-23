import { vi } from "vitest";
import { logger } from "@/lib/logger";

export interface LoggerSpy {
  info: ReturnType<typeof vi.spyOn>;
  warn: ReturnType<typeof vi.spyOn>;
  error: ReturnType<typeof vi.spyOn>;
  critical: ReturnType<typeof vi.spyOn>;
  debug: ReturnType<typeof vi.spyOn>;
  restore: () => void;
  clear: () => void;
}

/**
 * Creates spies on the application structured logger to silence console output
 * and allow clean, targeted assertions during test execution.
 */
export function createLoggerSpy(options: { silent?: boolean } = { silent: true }): LoggerSpy {
  const silent = options.silent ?? true;

  const info = vi.spyOn(logger, "info").mockImplementation((...args: unknown[]) => {
    if (!silent) console.info(...args);
    return logger;
  });

  const warn = vi.spyOn(logger, "warn").mockImplementation((...args: unknown[]) => {
    if (!silent) console.warn(...args);
    return logger;
  });

  const error = vi.spyOn(logger, "error").mockImplementation((...args: unknown[]) => {
    if (!silent) console.error(...args);
    return logger;
  });

  const critical = vi.spyOn(logger, "critical").mockImplementation((...args: unknown[]) => {
    if (!silent) console.error("[CRITICAL]", ...args);
    return logger;
  });

  const debug = vi.spyOn(logger, "debug").mockImplementation((...args: unknown[]) => {
    if (!silent) console.debug(...args);
    return logger;
  });

  return {
    info,
    warn,
    error,
    critical,
    debug,
    restore: () => {
      info.mockRestore();
      warn.mockRestore();
      error.mockRestore();
      critical.mockRestore();
      debug.mockRestore();
    },
    clear: () => {
      info.mockClear();
      warn.mockClear();
      error.mockClear();
      critical.mockClear();
      debug.mockClear();
    },
  };
}
