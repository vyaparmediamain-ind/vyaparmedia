- Migration: add_is_estimated_to_engagement_snapshot
-- Adds isEstimated flag so the API can clearly communicate when engagement
-- metrics are rule-based estimates vs real Instagram/YouTube API data.
-- Defaults to TRUE so all existing rows are correctly classified as estimated.

ALTER TABLE "EngagementSnapshot"
  ADD COLUMN "isEstimated" BOOLEAN NOT NULL DEFAULT TRUE;
