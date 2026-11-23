-- AlterTable: Add metricsQuality to EngagementSnapshot
ALTER TABLE "EngagementSnapshot" ADD COLUMN IF NOT EXISTS "metricsQuality" JSONB;
