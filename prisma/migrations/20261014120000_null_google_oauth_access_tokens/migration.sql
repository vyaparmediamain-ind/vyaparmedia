-- Data migration: Null existing Google OAuth access tokens per OA-07 / O3-T4
-- vyaparmedia only stores provider + providerAccountId for Google authentication; access tokens are not required.

UPDATE "OAuthAccount"
SET "accessToken" = NULL
WHERE "provider" = 'google' AND "accessToken" IS NOT NULL;
