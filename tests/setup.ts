import { config } from "dotenv";
import Module from "node:module";

// Load test environment
config({ path: ".env" });
process.env.SKIP_ENV_VALIDATION = "true";
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

// Mock server-only package so server files can be imported in test environment
const originalRequire = Module.prototype.require as (this: unknown, id: string, ...args: unknown[]) => unknown;
Module.prototype.require = function (this: unknown, id: string, ...args: unknown[]) {
  if (id === "server-only") {
    return {};
  }
  return originalRequire.apply(this, [id, ...args]);
};
