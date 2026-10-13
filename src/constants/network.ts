/**
 * Network, HTTP Timeout & Distributed Lock Constants
 */

// Outgoing HTTP Timeouts (ms)
export const DEFAULT_HTTP_TIMEOUT_MS = 10_000; // 10 seconds
export const SMS_GATEWAY_TIMEOUT_MS = 15_000; // 15 seconds
export const KYC_GATEWAY_TIMEOUT_MS = 15_000; // 15 seconds
export const IPINFO_TIMEOUT_MS = 3_000; // 3 seconds
export const SOCIAL_API_TIMEOUT_MS = 10_000; // 10 seconds

// Circuit Breaker Defaults
export const DEFAULT_CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
export const DEFAULT_CIRCUIT_BREAKER_RESET_TIMEOUT_SECONDS = 60; // 1 minute

// Distributed Lock TTLs (seconds)
export const CRON_LOCK_TTLS = {
  DEFAULT: 300, // 5 minutes
  AUTO_APPROVE: 300, // 5 minutes
  LEDGER_RECONCILE: 300, // 5 minutes
  LEDGER_SCAN: 180, // 3 minutes
  POST_MONITOR: 180, // 3 minutes
  SHORT_JOB: 120, // 2 minutes
} as const;

// Distributed Lock Redis Keys
export const CRON_LOCK_KEYS = {
  CONTENT_AUTO_APPROVE: "cron:content-auto-approve:lock",
  LEDGER_RECONCILE: "cron:ledger-settlement-reconciliation:lock",
  LEDGER_SCAN: "cron:ledger-scan:lock",
  POST_MONITOR: "cron:post-monitor:lock",
  EXPIRE_SIGNATURES: "cron:expire-signatures:lock",
  WEEKLY_CHALLENGES: "cron:weekly-challenges:lock",
} as const;
