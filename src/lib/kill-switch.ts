import redis from "./redis";
import { logger } from "./logger";
import { AppError } from "./errors";

export const KILL_SWITCH_FEATURES = {
  WITHDRAWALS: "killswitch:withdrawals",
  ADD_FUNDS: "killswitch:add_funds",
  CAMPAIGNS: "killswitch:campaigns",
  SIGNUPS: "killswitch:signups",
  MESSAGING: "killswitch:messaging",
  OTP: "killswitch:otp",
  SOCIAL_INSTAGRAM: "killswitch:social:instagram",
  SOCIAL_YOUTUBE: "killswitch:social:youtube",
  AUTH_GOOGLE: "killswitch:auth:google",
  VENDOR_SUREPASS: "killswitch:vendor:surepass",
  VENDOR_DIGILOCKER: "killswitch:vendor:digilocker",
  VENDOR_VISION: "killswitch:vendor:vision",
  VENDOR_SHIPROCKET: "killswitch:vendor:shiprocket",
  VENDOR_RAZORPAY: "killswitch:vendor:razorpay",
  VENDOR_RESEND: "killswitch:vendor:resend",
  VENDOR_FREEIPAPI: "killswitch:vendor:freeipapi",
} as const;

export type KillSwitchFeature =
  | "killswitch:withdrawals"
  | "killswitch:add_funds"
  | "killswitch:campaigns"
  | "killswitch:signups"
  | "killswitch:messaging"
  | "killswitch:otp"
  | "killswitch:social:instagram"
  | "killswitch:social:youtube"
  | "killswitch:auth:google"
  | "killswitch:vendor:surepass"
  | "killswitch:vendor:digilocker"
  | "killswitch:vendor:vision"
  | "killswitch:vendor:shiprocket"
  | "killswitch:vendor:razorpay"
  | "killswitch:vendor:resend"
  | "killswitch:vendor:freeipapi";

export const KILL_SWITCH_MESSAGES: Record<KillSwitchFeature, string> = {
  "killswitch:withdrawals":
    "Withdrawals are temporarily paused for routine system maintenance. Please try again shortly.",
  "killswitch:add_funds":
    "Wallet deposits are temporarily paused for maintenance. Existing balances remain fully accessible.",
  "killswitch:campaigns":
    "New campaign creation is temporarily disabled. Please check back soon.",
  "killswitch:signups":
    "User registrations are temporarily paused. Existing users can log in normally.",
  "killswitch:messaging":
    "Direct messaging is temporarily unavailable while we perform system upgrades.",
  "killswitch:otp":
    "OTP sending is temporarily paused for routine system maintenance. Please try again shortly.",
  "killswitch:social:instagram":
    "Instagram connection is temporarily unavailable. Please try again later.",
  "killswitch:social:youtube":
    "YouTube connection is temporarily unavailable. Please try again later.",
  "killswitch:auth:google":
    "Google sign-in is temporarily paused. Please use email and password to log in.",
  "killswitch:vendor:surepass":
    "Automated identity verification is temporarily unavailable. Please try manual upload or check back shortly.",
  "killswitch:vendor:digilocker":
    "DigiLocker document retrieval is temporarily paused. Please try again later.",
  "killswitch:vendor:vision":
    "Automated image attachment scanning is currently offline. Attachments are routed for human review.",
  "killswitch:vendor:shiprocket":
    "Automated logistics label creation is temporarily paused. Sample orders can still be tracked manually.",
  "killswitch:vendor:razorpay":
    "Payment gateway integration is temporarily undergoing routine maintenance.",
  "killswitch:vendor:resend":
    "Email notifications are queued and will be dispatched once maintenance concludes.",
  "killswitch:vendor:freeipapi":
    "IP geolocation verification is operating in offline fallback mode.",
};

// In-memory overrides for testing or emergency runtime bypasses
const localOverrides: Map<KillSwitchFeature, boolean> = new Map();

/**
 * Checks whether an operational kill switch is currently engaged.
 * Fails open (returns false) if Redis is unreachable to prevent false-positive lockouts.
 */
export async function isKillSwitchActive(feature: KillSwitchFeature): Promise<boolean> {
  if (localOverrides.has(feature)) {
    return localOverrides.get(feature) === true;
  }

  try {
    const val = await redis.get(feature);
    return val === "true" || val === "1";
  } catch (err: unknown) {
    logger.warn(`[KillSwitch] Failed to check kill switch '${feature}' from Redis. Failing open.`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Asserts that a kill switch is not active.
 * Throws AppError.serviceUnavailable (HTTP 503) if active.
 */
export async function assertKillSwitchInactive(feature: KillSwitchFeature): Promise<void> {
  const active = await isKillSwitchActive(feature);
  if (active) {
    const message = KILL_SWITCH_MESSAGES[feature] || "Service is temporarily paused for system maintenance.";
    logger.warn(`[KillSwitch] Blocked request by operational kill switch: ${feature}`);
    throw AppError.serviceUnavailable(message);
  }
}

/**
 * Sets the operational status of a kill switch in Redis and local cache.
 */
export async function setKillSwitch(feature: KillSwitchFeature, active: boolean): Promise<void> {
  localOverrides.set(feature, active);
  try {
    if (active) {
      // Set 7-day TTL (86400 * 7) to prevent indefinite retention if operational killswitch is never manually reset
      await redis.set(feature, "true", "EX", 86400 * 7);
    } else {
      await redis.del(feature);
    }
  } catch (err: unknown) {
    logger.error(`[KillSwitch] Failed to update kill switch '${feature}' in Redis`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Sets an in-memory override for testing or emergency runtime bypass.
 */
export function setKillSwitchOverride(feature: KillSwitchFeature, active: boolean): void {
  localOverrides.set(feature, active);
}

/**
 * Clears in-memory test overrides.
 */
export function clearKillSwitchOverrides(): void {
  localOverrides.clear();
}

/**
 * Returns user-facing degraded notification message for an active kill switch feature.
 */
export function getKillSwitchMessage(feature: KillSwitchFeature): string {
  return (
    KILL_SWITCH_MESSAGES[feature] ||
    "This service is temporarily undergoing routine maintenance. Please try again shortly."
  );
}

export interface KillSwitchItem {
  feature: KillSwitchFeature;
  title: string;
  category: "FINANCIAL" | "SECURITY" | "VENDOR";
  categoryLabel: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  impact: string;
  active: boolean;
  message: string;
}

export const KILL_SWITCH_METADATA: Record<
  KillSwitchFeature,
  Omit<KillSwitchItem, "feature" | "active" | "message">
> = {
  "killswitch:withdrawals": {
    title: "Creator & Brand Withdrawals",
    category: "FINANCIAL",
    categoryLabel: "Financial Controls",
    severity: "CRITICAL",
    description: "Instant circuit breaker stopping all bank and UPI withdrawal payouts.",
    impact: "Prevents drain if abnormal payout behavior is detected. Escrow balances remain safe.",
  },
  "killswitch:add_funds": {
    title: "Wallet Top-Ups (Add Funds)",
    category: "FINANCIAL",
    categoryLabel: "Financial Controls",
    severity: "CRITICAL",
    description: "Pauses incoming wallet payments and deposits via Razorpay.",
    impact: "Stops inbound money flow during gateway reconciliation or ledger auditing.",
  },
  "killswitch:campaigns": {
    title: "Campaign Creation & Escrow Locks",
    category: "FINANCIAL",
    categoryLabel: "Financial Controls",
    severity: "HIGH",
    description: "Prevents brands from launching new campaigns or committing new escrow funds.",
    impact: "Protects platform liability during contract template or compliance updates.",
  },
  "killswitch:signups": {
    title: "New User Registrations",
    category: "SECURITY",
    categoryLabel: "Security & User Access",
    severity: "CRITICAL",
    description: "Blocks all new creator and brand registrations (anti-bot / spam flood barrier).",
    impact: "Existing registered users can log in and transact normally.",
  },
  "killswitch:otp": {
    title: "SMS & Mobile OTP Delivery",
    category: "SECURITY",
    categoryLabel: "Security & User Access",
    severity: "HIGH",
    description: "Halts dispatching 2FA and mobile OTP SMS messages.",
    impact: "Mitigates SMS toll-fraud attacks or vendor rate limit storms.",
  },
  "killswitch:messaging": {
    title: "In-App Direct Chat & Messaging",
    category: "SECURITY",
    categoryLabel: "Security & User Access",
    severity: "MEDIUM",
    description: "Pauses real-time messaging between brands and influencers.",
    impact: "Useful during moderation emergencies or circumvention attack waves.",
  },
  "killswitch:auth:google": {
    title: "Google OAuth Sign-In",
    category: "SECURITY",
    categoryLabel: "Security & User Access",
    severity: "MEDIUM",
    description: "Disables Google Single Sign-On fallback in case of Google API outages.",
    impact: "Users log in using their primary email and password instead.",
  },
  "killswitch:social:instagram": {
    title: "Instagram Graph API Integration",
    category: "VENDOR",
    categoryLabel: "Third-Party Integrations",
    severity: "MEDIUM",
    description: "Disables live Instagram metrics polling and token refreshes.",
    impact: "Existing follower counts and engagement stats remain safely cached.",
  },
  "killswitch:social:youtube": {
    title: "YouTube Data API Integration",
    category: "VENDOR",
    categoryLabel: "Third-Party Integrations",
    severity: "MEDIUM",
    description: "Disables YouTube subscriber verification and channel audits.",
    impact: "Historical YouTube analytics remain accessible in read-only mode.",
  },
  "killswitch:vendor:razorpay": {
    title: "Razorpay Gateway Integration",
    category: "VENDOR",
    categoryLabel: "Third-Party Integrations",
    severity: "CRITICAL",
    description: "Isolates Razorpay orders, transfers, and route settlement calls.",
    impact: "Activated when Razorpay reports widespread gateway or webhook degradation.",
  },
  "killswitch:vendor:shiprocket": {
    title: "Shiprocket Courier & Logistics",
    category: "VENDOR",
    categoryLabel: "Third-Party Integrations",
    severity: "HIGH",
    description: "Pauses automated shipping label generation and courier dispatching.",
    impact: "Sample kits can still be tracked manually via AWB numbers.",
  },
  "killswitch:vendor:surepass": {
    title: "Surepass KYC & OCR API",
    category: "VENDOR",
    categoryLabel: "Third-Party Integrations",
    severity: "HIGH",
    description: "Halts automated PAN, GST, and Aadhaar document verification calls.",
    impact: "Submissions queue safely in the admin manual verification queue.",
  },
  "killswitch:vendor:digilocker": {
    title: "DigiLocker Integration",
    category: "VENDOR",
    categoryLabel: "Third-Party Integrations",
    severity: "MEDIUM",
    description: "Pauses government DigiLocker document fetch flows.",
    impact: "Users are seamlessly guided to direct document upload.",
  },
  "killswitch:vendor:vision": {
    title: "Google Cloud Vision AI",
    category: "VENDOR",
    categoryLabel: "Third-Party Integrations",
    severity: "MEDIUM",
    description: "Bypasses automatic image attachment safety and fraud scanning.",
    impact: "Images are flagged for manual admin inspection without blocking upload.",
  },
  "killswitch:vendor:resend": {
    title: "Resend Email Notification Delivery",
    category: "VENDOR",
    categoryLabel: "Third-Party Integrations",
    severity: "MEDIUM",
    description: "Queues outgoing marketing and transaction notification emails.",
    impact: "Prevents notification bursts during email template maintenance.",
  },
  "killswitch:vendor:freeipapi": {
    title: "FreeIPAPI Geolocation Verification",
    category: "VENDOR",
    categoryLabel: "Third-Party Integrations",
    severity: "MEDIUM",
    description: "Skips external IP lookup calls and defaults to local country detection.",
    impact: "Eliminates latency if the external IP service is experiencing rate limits.",
  },
};

export async function getAllKillSwitches(): Promise<KillSwitchItem[]> {
  const features = Object.values(KILL_SWITCH_FEATURES) as KillSwitchFeature[];
  const results: KillSwitchItem[] = [];

  for (const feature of features) {
    const active = await isKillSwitchActive(feature);
    const meta = KILL_SWITCH_METADATA[feature];
    results.push({
      feature,
      title: meta?.title || feature,
      category: meta?.category || "VENDOR",
      categoryLabel: meta?.categoryLabel || "Other",
      description: meta?.description || "Operational circuit breaker",
      severity: meta?.severity || "MEDIUM",
      impact: meta?.impact || "",
      active,
      message: getKillSwitchMessage(feature),
    });
  }

  return results;
}

