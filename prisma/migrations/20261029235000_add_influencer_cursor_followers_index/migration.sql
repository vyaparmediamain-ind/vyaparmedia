-- CreateIndex for O(1) Keyset Cursor Pagination on Creator Discovery
CREATE INDEX IF NOT EXISTS "InfluencerProfile_deletedAt_instagramFollowers_id_idx" 
    ON "InfluencerProfile"("deletedAt", "instagramFollowers" DESC, "id" DESC);
