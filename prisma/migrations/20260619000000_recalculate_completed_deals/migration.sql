- Recalculate completedDeals and totalDeals for all influencer profiles to correct historical double-increment errors.
UPDATE "InfluencerProfile" p
SET "completedDeals" = (
  SELECT COUNT(*)
  FROM "Deal" d
  WHERE d."influencerId" = p.id AND d.status = 'COMPLETED'
),
"totalDeals" = (
  SELECT COUNT(*)
  FROM "Deal" d
  WHERE d."influencerId" = p.id
)
WHERE true;
