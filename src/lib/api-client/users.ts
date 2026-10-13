/**
 * apiClient.users — User profile, contact, OTP, and moderation API calls.
 */
import { get, post, put } from "./http";
import type { HttpOptions } from "./http";

/** GET /api/influencers/:id — fetch public influencer profile */
export function getInfluencer(id: string, options?: HttpOptions) {
  return get(`/api/influencers/${encodeURIComponent(id)}`, options);
}

/** POST /api/user/send-otp */
export function sendOtp(
  data: { type: string; value?: string; contact?: string },
  options?: HttpOptions,
) {
  return post("/api/user/send-otp", data, options);
}

/** POST /api/user/change-contact */
export function changeContact(
  data: Record<string, unknown>,
  options?: HttpOptions,
) {
  return post("/api/user/change-contact", data, options);
}

/** POST /api/user/verify-contact */
export function verifyContact(
  data: Record<string, unknown>,
  options?: HttpOptions,
) {
  return post("/api/user/verify-contact", data, options);
}

/** POST /api/user/delete-account */
export function deleteAccount(
  data: { reason?: string; password?: string },
  options?: HttpOptions,
) {
  return post("/api/user/delete-account", data, options);
}

/** POST /api/bookmarks — toggle bookmark on a campaign or creator */
export function toggleBookmark(
  data: {
    targetId: string;
    targetType: string;
    isSaved?: boolean;
    action?: "add" | "remove";
  },
  options?: HttpOptions,
) {
  return post("/api/bookmarks", data, options);
}

/** POST /api/users/block */
export function blockUser(
  data: {
    blockedUserId?: string;
    targetUserId?: string;
    action: "block" | "unblock";
  },
  options?: HttpOptions,
) {
  const payload = {
    blockedUserId: data.blockedUserId || data.targetUserId,
    action: data.action,
  };
  return post("/api/users/block", payload, options);
}

/** GET /api/users/block?checkUserId=:id */
export function checkBlock(userId: string, options?: HttpOptions) {
  return get<{ success?: boolean; data?: { isBlocked: boolean } }>(
    `/api/users/block?checkUserId=${encodeURIComponent(userId)}`,
    options,
  );
}

/** POST /api/users/report */
export function reportUser(
  data: {
    reportedUserId?: string;
    targetUserId?: string;
    reason: string;
    description?: string;
    details?: string;
  },
  options?: HttpOptions,
) {
  const payload = {
    reportedUserId: data.reportedUserId || data.targetUserId,
    reason: data.reason,
    description: data.description || data.details,
  };
  return post("/api/users/report", payload, options);
}

/** POST /api/users/feedback */
export function submitFeedback(
  data: {
    subject?: string | undefined;
    message?: string | undefined;
    attachments?: string[] | undefined;
    type?: string | undefined;
    title?: string | undefined;
    description?: string | undefined;
    screenshotUrl?: string | undefined;
    [key: string]: unknown;
  },
  options?: HttpOptions,
) {
  return post("/api/users/feedback", data, options);
}


/** POST /api/auth/change-password */
export function changePassword(
  data: { currentPassword?: string; newPassword: string; otp?: string },
  options?: HttpOptions,
) {
  return post("/api/auth/change-password", data, options);
}

/** GET /api/auth/:platform/authorize */
export function authorizeSocial(platform: string, options?: HttpOptions) {
  return get(`/api/auth/${encodeURIComponent(platform)}/authorize`, options);
}

/** POST /api/auth/:platform/disconnect */
export function disconnectSocial(platform: string, options?: HttpOptions) {
  return post(
    `/api/auth/${encodeURIComponent(platform)}/disconnect`,
    undefined,
    options,
  );
}

/** POST /api/social/verify — verify social handle */
export function verifySocial(
  data: Record<string, unknown>,
  options?: HttpOptions,
) {
  return post("/api/social/verify", data, options);
}

/** POST /api/user/2fa/setup */
export function setup2fa(options?: HttpOptions) {
  return post("/api/user/2fa/setup", undefined, options);
}

/** POST /api/user/2fa/verify */
export function verify2fa(
  data: { token: string },
  options?: HttpOptions,
) {
  return post("/api/user/2fa/verify", data, options);
}

/** POST /api/user/2fa/disable */
export function disable2fa(
  data: { token?: string; password?: string; code?: string; otp?: string },
  options?: HttpOptions,
) {
  return post("/api/user/2fa/disable", data, options);
}

/** POST /api/verification — submit KYC verification document */
export function submitVerification(
  data: Record<string, unknown> | FormData,
  options?: HttpOptions,
) {
  return post("/api/verification", data, options);
}

/** GET /api/verification — fetch current verification status */
export function getVerification(options?: HttpOptions) {
  return get("/api/verification", options);
}

/** GET /api/auth/digilocker/authorize */
export function authorizeDigilocker(options?: HttpOptions) {
  return get("/api/auth/digilocker/authorize", options);
}

/** PUT /api/admin/payouts/:id — admin payout action */
export function adminPayoutAction(
  withdrawalId: string,
  data: Record<string, unknown>,
  options?: HttpOptions,
) {
  return put(
    `/api/admin/payouts/${encodeURIComponent(withdrawalId)}`,
    data,
    options,
  );
}

