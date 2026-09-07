- Migration: remove_rate_limit_counter_and_push_prefs
-- Removes the unused RateLimitCounter table (rate limiting is Redis-only)
-- and removes push notification defaults from notificationPreferences
-- (push notifications feature was removed from the codebase).

-- Drop the dead RateLimitCounter table (rate limiting is fully Redis-based)
DROP TABLE IF EXISTS "RateLimitCounter";

-- Update the column default to remove push notification preference keys.
-- Existing rows keep their current value; only new rows get the clean default.
ALTER TABLE "User"
  ALTER COLUMN "notificationPreferences"
  SET DEFAULT '{"email":{"marketing":true,"updates":true,"security":true}}';
