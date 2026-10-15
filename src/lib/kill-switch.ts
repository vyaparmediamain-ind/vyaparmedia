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
  | "killswitch:auth:google";

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
