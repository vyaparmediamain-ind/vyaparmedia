/**
 * apiClient.auth — Authentication, registration, OTP, and session API calls.
 */
import { get, post, put } from "./http";
import type { HttpOptions } from "./http";

export interface SendEmailOtpPayload {
  email: string;
  type?: string;
}

export interface VerifyEmailOtpPayload {
  email: string;
  otp: string;
  type?: string;
}

export interface SendPhoneOtpPayload {
  phone: string;
  type?: string;
}

export interface VerifyPhoneOtpPayload {
  phone: string;
  otp: string;
  type?: string;
}

export interface ResetPasswordRequestPayload {
  action: "request";
  email: string;
}

export interface ResetPasswordConfirmPayload {
  action: "reset";
  token: string;
  newPassword: string;
}

/** PUT /api/auth/verify-email-otp — Send Email OTP */
export function sendEmailOtp(
  payload: SendEmailOtpPayload,
  options?: HttpOptions,
) {
  return put<{ success?: boolean; otp?: string; message?: string; error?: string }>(
    "/api/auth/verify-email-otp",
    { type: "registration", ...payload },
    { skipAuthRedirect: true, ...options },
  );
}

/** POST /api/auth/verify-email-otp — Verify Email OTP */
export function verifyEmailOtp(
  payload: VerifyEmailOtpPayload,
  options?: HttpOptions,
) {
  return post<{ success?: boolean; verified?: boolean; message?: string; error?: string }>(
    "/api/auth/verify-email-otp",
    { type: "registration", ...payload },
    { skipAuthRedirect: true, ...options },
  );
}

/** PUT /api/auth/verify-otp — Send Phone SMS/WhatsApp OTP */
export function sendPhoneOtp(
  payload: SendPhoneOtpPayload,
  options?: HttpOptions,
) {
  return put<{
    success?: boolean;
    channel?: "whatsapp" | "sms" | "dev" | null;
    otp?: string;
    error?: string;
  }>(
    "/api/auth/verify-otp",
    { type: "registration", ...payload },
    { skipAuthRedirect: true, ...options },
  );
}

/** POST /api/auth/verify-otp — Verify Phone OTP */
export function verifyPhoneOtp(
  payload: VerifyPhoneOtpPayload,
  options?: HttpOptions,
) {
  return post<{ success?: boolean; verified?: boolean; error?: string }>(
    "/api/auth/verify-otp",
    { type: "registration", ...payload },
    { skipAuthRedirect: true, ...options },
  );
}

/** POST /api/auth/register — Complete account registration */
export function register(
  payload: Record<string, unknown>,
  options?: HttpOptions,
) {
  return post<{
    success?: boolean;
    user?: unknown;
    message?: string;
    details?: { fieldErrors?: Record<string, string[]> };
    error?: string;
  }>(
    "/api/auth/register",
    payload,
    { skipAuthRedirect: true, ...options },
  );
}

/** POST /api/auth/reset-password (request link) */
export function requestPasswordReset(
  email: string,
  options?: HttpOptions,
) {
  return post<{ message?: string; resetLink?: string; error?: string }>(
    "/api/auth/reset-password",
    { action: "request", email },
    { skipAuthRedirect: true, ...options },
  );
}

/** POST /api/auth/reset-password (confirm new password) */
export function resetPassword(
  payload: { token: string; newPassword: string },
  options?: HttpOptions,
) {
  return post<{ message?: string; error?: string }>(
    "/api/auth/reset-password",
    { action: "reset", ...payload },
    { skipAuthRedirect: true, ...options },
  );
}

/** GET /api/auth/session — Check current active session */
export function getSession(options?: HttpOptions) {
  return get<Record<string, unknown>>(
    "/api/auth/session",
    {
      skipAuthRedirect: true,
      cache: "no-store",
      credentials: "same-origin",
      ...options,
    },
  );
}
