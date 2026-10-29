/**
 * Authentication, Session & Verification Constants
 */

// OTP Specifications
export const OTP_DIGIT_LENGTH = 6;
export const AUTH_OTP_EXPIRY_SECONDS = 900; // 15 minutes for new user registration and login OTP
export const CONTACT_UPDATE_OTP_EXPIRY_SECONDS = 600; // 10 minutes for sensitive profile contact updates
export const OTP_RESEND_COOLDOWN_SECONDS = 60; // 60s cooldown before resending OTP
export const MAX_OTP_VERIFICATION_ATTEMPTS = 5; // Max 5 failed OTP attempts before lockout

// Login & Rate Limiting Thresholds
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_WINDOW_SECONDS = 900; // 15 minutes sliding window
export const LOGIN_LOCKOUT_MINUTES = 15;

// Session & Inactivity Timing
export const SESSION_MAX_AGE_DAYS = 7;
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const SESSION_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes periodic health check
export const INACTIVITY_LOGOUT_MS = 30 * 60 * 1000; // 30 minutes before forcing logout
export const INACTIVITY_WARNING_BEFORE_MS = 5 * 60 * 1000; // 5 minutes before forced logout
export const WARN_SESSION_AGE_MS = 25 * 60 * 1000; // 25 minutes session warning threshold
export const SENSITIVE_ACTION_MAX_SESSION_AGE_MS = 10 * 60 * 1000; // 10 minutes maximum age for sensitive operations
export const MAX_ALLOWED_CLOCK_SKEW_MS = 10 * 60 * 1000; // 10 minutes allowed clock skew for token validity

// Multi-Factor Authentication
export const TOTP_DIGIT_LENGTH = 6;
export const TOTP_WINDOW_STEPS = 1; // 1 step tolerance (+/- 30s)
