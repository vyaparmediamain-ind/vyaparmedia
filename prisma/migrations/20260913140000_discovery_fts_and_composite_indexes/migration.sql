-- PostgreSQL Extension for Trigram Fuzzy Matching and Typo-Tolerance
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ====================================================================
-- 1. InfluencerProfile Full-Text Search and Trigram Indexes
-- ====================================================================

-- Expression GIN Index for Full-Text Search (displayName, bio, categories, city)
CREATE INDEX IF NOT EXISTS idx_influencer_fts ON "InfluencerProfile" 
USING GIN (to_tsvector('english', coalesce("displayName", '') || ' ' || coalesce("bio", '') || ' ' || coalesce("categories", '') || ' ' || coalesce("city", '')));

-- Trigram GIN Index on displayName for Typo-Tolerant & Prefix Search
CREATE INDEX IF NOT EXISTS idx_influencer_name_trgm ON "InfluencerProfile" 
USING GIN ("displayName" gin_trgm_ops);

-- Composite B-Tree Indexes for Most-Common Filter Combinations
CREATE INDEX IF NOT EXISTS idx_influencer_cat_followers ON "InfluencerProfile" ("categories", "instagramFollowers");
CREATE INDEX IF NOT EXISTS idx_influencer_city_followers ON "InfluencerProfile" ("city", "instagramFollowers");
CREATE INDEX IF NOT EXISTS idx_influencer_rates ON "InfluencerProfile" ("minRate", "maxRate");
CREATE INDEX IF NOT EXISTS idx_influencer_featured_rank ON "InfluencerProfile" ("isFeatured", "instagramFollowers" DESC, "averageRating" DESC);
CREATE INDEX IF NOT EXISTS idx_influencer_cursor_created ON "InfluencerProfile" ("createdAt" DESC, "id" DESC);

-- ====================================================================
-- 2. Campaign Full-Text Search and Trigram Indexes
-- ====================================================================

-- Expression GIN Index for Full-Text Search (title, description)
CREATE INDEX IF NOT EXISTS idx_campaign_fts ON "Campaign" 
USING GIN (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("description", '')));

-- Trigram GIN Index on Campaign Title for Typo-Tolerant Search
CREATE INDEX IF NOT EXISTS idx_campaign_title_trgm ON "Campaign" 
USING GIN ("title" gin_trgm_ops);

-- Composite B-Tree Index for High-Frequency Campaign Filtering
CREATE INDEX IF NOT EXISTS idx_campaign_active_budget ON "Campaign" 
("status", "deletedAt", "perInfluencerBudget", "createdAt" DESC);
