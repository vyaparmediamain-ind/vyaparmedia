# Operational Runbook: Mass Instagram Reconnect Storm

## Incident Summary
Occurs when Meta Graph API invalidates tokens en masse (e.g., following Meta platform credential rotations, app secret changes, or widespread token expiry), triggering massive API 400/401 storms and threatening crawler timeouts.

## Symptoms
- Background cron `/api/cron/refresh-social-tokens` reports mass token renewal failures.
- Post crawler `/api/cron/post-monitor` flags hundreds of live posts as "Metric Fetch Error".
- Meta API rate limit alert `meta_rate_limit_approaching` (>80% quota consumption).

## Step-by-Step Triage & Recovery

### 1. Enable Instagram Insights Circuit Breaker
Prevent aggressive automated polling from consuming Meta rate limit buckets:
1. Navigate to `/admin/system`.
2. Toggle `KILL_SWITCH_INSTAGRAM_INSIGHTS` to ON.
3. Live crawler automatically falls back to estimated baseline CPMs without penalizing creators.

### 2. Check Meta App Dashboard
1. Log in to Meta Developer Portal (`developers.facebook.com`).
2. Verify that the App Secret, Client ID, and Webhook verification tokens match production environment variables.
3. Check for any unexpected Meta App Review status revocation.

### 3. Broadcast In-App Reconnect Notice
Send a targeted notification to all creators whose tokens expired:
1. Navigate to `/admin/newsletter`.
2. Select Audience: "Creators with Expired Social Tokens".
3. Dispatch template: "Please Reconnect Your Instagram Account to Preserve Live View Tracking".

### 4. Resume Crawler with Staggered Jitter
Once tokens begin re-authenticating:
1. Turn off `KILL_SWITCH_INSTAGRAM_INSIGHTS`.
2. Crawler resumes with 500ms randomized jitter between calls to respect Meta rate limits.
