/**
 * Centralized Configuration and Safety Guard for VyaparMedia Load Testing
 * 
 * Used by both k6 and autocannon test runners.
 */

export const TARGET_URL = process.env.TARGET_URL || process.env.BASE_URL || "http://localhost:3000";

// STRICT SAFETY GUARD: Production targets are strictly forbidden!
export const FORBIDDEN_HOST_PATTERNS = [
  /vyaparmedia\.in$/i,
  /vyaparmedia\.com$/i,
  /vercel\.app$/i, // Unless explicitly overridden for staging
  /prod/i,
  /production/i,
];

export const ALLOWED_HOST_PATTERNS = [
  /^localhost(:\d+)?$/i,
  /^127\.0\.0\.1(:\d+)?$/i,
  /^0\.0\.0\.0(:\d+)?$/i,
  /^staging\.vyaparmedia\.in$/i,
  /^vyaparmedia-staging.*\.vercel\.app$/i,
];

// Strictly prohibited endpoints (Payment gateways, live webhooks, OTP SMS triggers)
export const BLACKLISTED_PATH_PATTERNS = [
  /\/api\/payments(\/.*)?$/i,
  /\/api\/webhooks(\/.*)?$/i,
  /\/api\/auth\/verify-otp$/i,
  /\/api\/auth\/verify-email-otp$/i,
  /\/api\/user\/send-otp$/i,
  /\/api\/user\/verify-contact$/i,
  /\/api\/user\/2fa\/.*$/i,
  /\/api\/wallet\/add-funds$/i,
  /\/api\/wallet\/withdraw$/i,
  /\/api\/deals\/[^\/]+\/pay$/i,
];

/**
 * Validates that the target URL is local or non-production staging.
 * Throws a fatal exception if a production host is detected.
 */
export function validateTargetSafety(urlStr = TARGET_URL) {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch (err) {
    throw new Error(`[SAFETY_VIOLATION] Invalid TARGET_URL: "${urlStr}". Must be a valid URL.`);
  }

  const hostname = parsed.host; // includes port if specified

  // 1. Check if host matches forbidden patterns
  for (const forbidden of FORBIDDEN_HOST_PATTERNS) {
    if (forbidden.test(parsed.hostname) && !parsed.hostname.includes("staging")) {
      throw new Error(
        `\n===============================================================\n` +
        ` [FATAL SAFETY ERROR] PRODUCTION HOST DETECTED: "${parsed.hostname}"\n` +
        ` Load testing against live production environments is STRICTLY\n` +
        ` prohibited to protect user funds, avoid SMS/email spam,\n` +
        ` and prevent database exhaustion.\n` +
        `===============================================================\n`
      );
    }
  }

  // 2. Validate host is explicitly allowed
  const isAllowed = ALLOWED_HOST_PATTERNS.some((pattern) => pattern.test(hostname) || pattern.test(parsed.hostname));
  if (!isAllowed) {
    throw new Error(
      `[SAFETY_VIOLATION] Host "${hostname}" is not recognized as a safe local or staging environment.`
    );
  }

  return true;
}

/**
 * Checks whether an endpoint path is permitted for load testing.
 */
export function assertSafeEndpoint(pathname) {
  for (const blacklisted of BLACKLISTED_PATH_PATTERNS) {
    if (blacklisted.test(pathname)) {
      throw new Error(
        `[SAFETY_VIOLATION] Endpoint "${pathname}" is BLACKLISTED. Payment, webhook, and OTP endpoints must NEVER be load-tested.`
      );
    }
  }
  return true;
}

// Test User Credentials (seeded via `npm run seed`)
export const TEST_CREDENTIALS = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || "admin@test.vyaparmedia.in",
    password: process.env.TEST_PASSWORD || "Test@1234",
  },
  brand: {
    email: process.env.TEST_BRAND_EMAIL || "brand@test.vyaparmedia.in",
    password: process.env.TEST_PASSWORD || "Test@1234",
  },
  influencer: {
    email: process.env.TEST_INFLUENCER_EMAIL || "influencer@test.vyaparmedia.in",
    password: process.env.TEST_PASSWORD || "Test@1234",
  },
};

// Ramp Stages Profile (10 -> 50 -> 200 Virtual Users)
export const RAMP_STAGES = [
  { target: 10, duration: 15, name: "Stage 1: 10 VUs (Warmup / Baseline)" },
  { target: 50, duration: 25, name: "Stage 2: 50 VUs (Moderate Load)" },
  { target: 200, duration: 35, name: "Stage 3: 200 VUs (Peak Stress)" },
];

export const LATENCY_THRESHOLDS = {
  p50MaxMs: 150,
  p95MaxMs: 500,
  p99MaxMs: 1500,
  maxErrorRatePercent: 1.0,
};

