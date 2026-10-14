# VyaparMedia OAuth & Social Provider Setup Guide (`docs/OAUTH_SETUP.md`)

> **Document Version**: 1.0.0 (Production Release Architecture)  
> **Target Platform**: VyaparMedia Influencer & Escrow Marketplace  
> **Audience**: Engineering Leads, DevOps, Legal / Compliance, Platform Founders  
> **Status**: Mandatory Production Runbook (Pre-Launch Compliance)  

---

## Architecture Overview & Isolation Strategy

VyaparMedia integrates with **Google** (NextAuth v5 user login + YouTube Data API v3 creator metric sync) and **Meta** (Instagram Graph API creator metric sync).

To minimize audit costs and prevent sensitive scope review delays from blocking general user registration:
1. **Google Isolation Strategy**: We recommend creating **two separate OAuth 2.0 Web Client IDs** within a single Google Cloud Project:
   - Client 1 (`web-login`): Non-sensitive identity scopes (`openid`, `email`, `profile`). Requires basic brand verification; launches immediately.
   - Client 2 (`web-youtube`): Sensitive scope (`https://www.googleapis.com/auth/youtube.readonly`). Gated by full Google OAuth Trust & Safety Review and YouTube API Services compliance audit.
2. **Meta Isolation Strategy**: Meta App configured with **Instagram Login for Tech Providers / Business Apps**.
   - Standard Access for sandbox development and approved test accounts (`Instagram Testers`).
   - Advanced Access (`instagram_business_basic`) unlocked only after legal Meta Business Verification and screencast App Review.
3. **Defense-in-Depth Launch Gate**: Redis-backed Kill-Switches (`killswitch:auth:google`, `killswitch:social:youtube`, `killswitch:social:instagram`) keep all external provider surfaces safely dark until production verification badges are granted.

---

## Section A: Google Cloud Setup (Authentication & YouTube Data API)

Official Reference: [Google Cloud Console](https://console.cloud.google.com/) | [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)

### 1. Project Initialization & API Activation
1. Sign in to the [Google Cloud Console](https://console.cloud.google.com/) using the primary organization administrative account (e.g., `admin@vyaparmedia.in`).
2. Create a new Google Cloud Project named `vyaparmedia-production` (or `vyaparmedia-staging` for non-prod).
3. Navigate to **APIs & Services > Library**:
   - Search for **YouTube Data API v3** and click **Enable** ([Doc link](https://developers.google.com/youtube/v3/getting-started)).
   - *(Optional / Future-proof)*: Search for **YouTube Analytics API** and enable if advanced creator revenue/retention insights are budgeted for future phases (see `brain/youtube_analytics_cost_benefit.md`).

### 2. OAuth Consent Screen Configuration
1. Navigate to **APIs & Services > OAuth consent screen**:
   - **User Type**: Select **External** (allows any Google user/creator to sign in or connect).
   - Click **Create**.
2. **App Information**:
   - **App name**: `VyaparMedia` (must match legal brand).
   - **User support email**: `support@vyaparmedia.in`.
   - **App logo**: 120x120px square PNG/JPG with transparent background representing the official logo.
3. **App Domain Links** (All domains must match verified root domain):
   - **Application home page**: `https://vyaparmedia.in` (publicly accessible landing page).
   - **Application privacy policy link**: `https://vyaparmedia.in/privacy` (📚 must detail Google user data access, processing, storage, and 30-day retention policy).
   - **Application terms of service link**: `https://vyaparmedia.in/terms`.
4. **Authorized Domains**:
   - Add `vyaparmedia.in`.
   - 📚 **Mandatory Search Console Verification**: The root domain (`vyaparmedia.in`) **must** be verified in [Google Search Console](https://search.google.com/search-console) by the identical Google account configuring the OAuth consent screen (DNS TXT record verification recommended).

### 3. Client 1: User Sign-In Client (`web-login`)
Used by NextAuth v5 in `src/lib/auth.ts` for creator/brand passwordless login.

1. Navigate to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
2. **Application type**: Web application.
3. **Name**: `VyaparMedia Web Login`.
4. **Scopes requested**:
   - `openid` (Associate you with your personal info on Google)
   - `https://www.googleapis.com/auth/userinfo.email` (`email`)
   - `https://www.googleapis.com/auth/userinfo.profile` (`profile`)
   - *Risk classification*: **Non-sensitive**.
   - *Audit requirement*: Brand verification only (automated or 2–3 business days).
5. **Authorized JavaScript Origins**:
   - Production: `https://app.vyaparmedia.in`
   - Staging: `https://staging.vyaparmedia.in`
   - Local Dev: `http://localhost:3000`
6. **Authorized Redirect URIs (Exact Matching)**:
   - Production: `https://app.vyaparmedia.in/api/auth/callback/google`
   - Staging: `https://staging.vyaparmedia.in/api/auth/callback/google`
   - Local Dev: `http://localhost:3000/api/auth/callback/google`
7. Save client details into environment:
   ```bash
   AUTH_GOOGLE_ID="<client-id-web-login>.apps.googleusercontent.com"
   AUTH_GOOGLE_SECRET="<client-secret-web-login>"
   ```

### 4. Client 2: Creator YouTube Channel Sync Client (`web-youtube`)
Used by `src/lib/oauth-helper.ts` and `src/app/api/auth/youtube/callback/route.ts` for channel metric ingestion.

1. Navigate to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
2. **Application type**: Web application.
3. **Name**: `VyaparMedia YouTube Sync`.
4. **Scopes requested**:
   - `https://www.googleapis.com/auth/youtube.readonly`
   - *Risk classification*: **Sensitive Scope** ([Google Scopes Classification](https://developers.google.com/identity/protocols/oauth2/scopes#youtube)).
5. **Authorized Redirect URIs (Exact Matching)**:
   - Production: `https://app.vyaparmedia.in/api/auth/youtube/callback`
   - Staging: `https://staging.vyaparmedia.in/api/auth/youtube/callback`
   - Local Dev: `http://localhost:3000/api/auth/youtube/callback`
6. Save client details into environment:
   ```bash
   YOUTUBE_CLIENT_ID="<client-id-web-youtube>.apps.googleusercontent.com"
   YOUTUBE_CLIENT_SECRET="<client-secret-web-youtube>"
   ```

### 5. Sensitive Scope App Verification Protocol
Requesting `youtube.readonly` requires formal submission to Google Trust & Safety:
1. **Required Verification Assets**:
   - **YouTube Demo Screencast**: Unlisted YouTube video demonstrating:
     - User clicking "Connect YouTube" in VyaparMedia Settings (`/dashboard/settings?tab=social`).
     - Google OAuth Consent screen clearly displaying the project name and OAuth Client ID in URL address bar.
     - Consent approval by creator.
     - VyaparMedia dashboard displaying read-only subscriber and video metrics without storing or modifying video content.
   - **Written Justification Statement**:
     > *"VyaparMedia is an influencer marketplace connecting Indian creators with verified commercial brand campaigns. We request `youtube.readonly` solely to verify channel ownership, display subscriber count, and compute 30-day average engagement rates so brands can negotiate fair escrow milestones. We do not edit, upload, delete, or manage creator channels."*
   - **Privacy Policy Disclosure**:
     - Must explicitly state how YouTube data is accessed, cached in encrypted form (`AES-GCM-256`), and automatically purged after 30 days pursuant to YouTube Developer Policies.
2. **Review Timelines**:
   - Initial Brand Verification: 2–3 business days 📚.
   - Sensitive Scope Security Review: 2 to 6 weeks ⚠️ (*Verify in dashboard status alerts*).
3. **Publishing Status**:
   - In **Testing** mode: Limited to 100 pre-registered test Google accounts. *Warning*: Refresh tokens in testing mode expire in **7 days** ⚠️.
   - Must transition to **In Production** status before public launch.

### 6. Public YouTube API Key (`YOUTUBE_API_KEY`)
Used by `src/lib/social/youtube.ts` for non-authenticated fallback channel statistics queries:
1. Navigate to **APIs & Services > Credentials > Create Credentials > API Key**.
2. Click **Edit API Key**:
   - **Name**: `VyaparMedia Server YouTube Key`.
   - **API restrictions**: Select **Restrict key** > choose only **YouTube Data API v3**.
   - **Application restrictions**: Select **IP addresses** and whitelist VyaparMedia egress server IPs (NAT Gateway / Production Server IPs).
3. Save into environment:
   ```bash
   YOUTUBE_API_KEY="AIzaSy..."
   ```

### 7. Quota Allocation & Extension Architecture
1. **Default Quota**: Google provides a base tier of **10,000 units/day** 📚 across the Cloud project.
2. **Cost Calculation**:
   - `channels.list`: 1 unit.
   - `playlistItems.list`: 1 unit.
   - `videos.list`: 1 unit.
   - *Total per creator sync*: ~3 units.
   - *Daily creator sync capacity on free quota*: ~3,300 creators.
3. **Quota Extension**:
   - When active creator count exceeds 2,500, submit the [YouTube API Services Quota Extension Form](https://support.google.com/youtube/contact/yt_api_form) ⚠️ (*requires comprehensive compliance audit*).

### 8. Mandatory Developer Policy Terms
To comply with the [YouTube API Services Terms of Service](https://developers.google.com/youtube/terms/developer-policies):
1. **Public Terms & Privacy**:
   - The Privacy Policy must state: *"VyaparMedia uses YouTube API Services. By connecting your YouTube account, you agree to be bound by the YouTube Terms of Service (https://www.youtube.com/t/terms) and Google Privacy Policy (https://www.google.com/policies/privacy)."*
2. **Revocation Notice**:
   - The UI and Privacy Policy must inform users that they can revoke VyaparMedia's access via the [Google Security Settings](https://security.google.com/settings/security/permissions).
3. **30-Day Data Retention**:
   - Stored metrics must either be refreshed via active OAuth tokens or purged after 30 days (enforced by `src/app/api/cron/cleanup-oauth/route.ts`).

---

## Section B: Meta Developer Setup (Instagram Graph API)

Official Reference: [Meta for Developers](https://developers.facebook.com/) | [Instagram API with Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login)

### 1. Developer Account & App Creation
1. Register as a Meta Developer on [developers.facebook.com](https://developers.facebook.com/) using a corporate Facebook profile linked to the official Business Manager.
2. Click **Create App**:
   - **Use Case**: Select **Other**.
   - **App Type**: Select **Business** (required for accessing Instagram Graph API and Creator insights).
   - **App Name**: `VyaparMedia`.
   - **App Contact Email**: `security@vyaparmedia.in`.
   - **Business Account**: Select your verified Meta Business Manager account.

### 2. Product Integration: Instagram API with Instagram Login
1. In the App Dashboard, locate **Add Products to Your App**.
2. Find **Instagram** and click **Set Up**.
3. Select **API setup with Instagram login** ([Official Guide](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login)).
4. ⚠️ *Verify in dashboard*: Meta App Dashboard provides both a **Meta App ID** and an **Instagram App ID**. In the Instagram product settings, ensure you copy the specific **Instagram App ID** and **Instagram App Secret**:
   ```bash
   INSTAGRAM_APP_ID="<instagram-app-id>"
   INSTAGRAM_APP_SECRET="<instagram-app-secret>"
   ```

### 3. Client OAuth Settings & URLs
Navigate to **Instagram > Basic Display** or **Instagram API with Instagram Login > Settings**:
1. **Valid OAuth Redirect URIs**:
   - Production: `https://app.vyaparmedia.in/api/auth/instagram/callback`
   - Staging: `https://staging.vyaparmedia.in/api/auth/instagram/callback`
   - Local Dev: `http://localhost:3000/api/auth/instagram/callback` (for testing only)
2. **App Basic Settings**:
   - **Privacy Policy URL**: `https://vyaparmedia.in/privacy`
   - **Terms of Service URL**: `https://vyaparmedia.in/terms`
   - **Data Deletion Instructions URL**: `https://vyaparmedia.in/data-deletion` (📚 Mandatory for Meta App Review approval).
   - **Deauthorize Callback URL**: `https://app.vyaparmedia.in/api/auth/instagram/deauthorize` ⚠️ (*Verify in dashboard*).
   - **App Category**: `Business and Pages`.
   - **App Icon**: 1024x1024px official brand graphic.

### 4. Standard Access & Development Testing
While in **Development Mode**, only accounts with explicit roles can authenticate:
1. Navigate to **App Roles > Roles > Instagram Testers**.
2. Click **Add Instagram Testers** and input the Instagram username (e.g., `@vyaparmedia_test`).
3. **Acceptance Required**: The tester must open their mobile Instagram app:
   - Navigate to **Settings > Website permissions > Apps and Websites > Tester Invites**.
   - Click **Accept**.
4. Test OAuth flow and token exchange against `api.instagram.com/oauth/authorize`.

### 5. Advanced Access & Meta Business Verification
To allow any public creator in India to connect their Instagram handle, the app must transition to **Advanced Access**:
1. **Meta Business Verification (Legal Entity Audit)**:
   - In Meta Business Settings (`business.facebook.com`), complete Business Verification.
   - Documents required:
     - Certificate of Incorporation (MCA CIN).
     - GST Registration Certificate (GSTIN matching company name).
     - Bank Statement / Utility Bill with exact registered business address.
     - Official Website Domain Verification (via Meta HTML meta tag or DNS TXT record).
   - *Timeline*: 2 to 7 business days 📚.
2. **App Review Submission**:
   - Request permission: **`instagram_business_basic`** (📚 required for read access to username, profile picture, media count, follower count, and media metrics).
   - *(Optional)*: `instagram_business_manage_insights` (only if detailed story/reach impressions are required).
   - **Review Submission Requirements**:
     - Detailed explanation of step-by-step user journey.
     - Screen recording (.mp4 or YouTube link) demonstrating a creator linking their Instagram account and viewing their verified trust score on VyaparMedia.
     - Live demo credentials for Meta reviewers to log in and test.

### 6. Creator Professional Account Requirement
- **Technical Constraint**: The Instagram Graph API **does not support personal Instagram accounts**.
- **Onboarding Guidance for Creators**:
  Creators must switch their account in the Instagram mobile app prior to connecting:
  1. Open Instagram > **Settings and activity**.
  2. Scroll to **For professionals** > **Account type and tools**.
  3. Select **Switch to professional account** > Choose **Creator** or **Business**.

---

## Section C: Launch Gating & Compliance Checklist

External provider review rejections or credential leaks can halt operations. All items below must be signed off prior to activating production traffic:

| Item | Focus Area | Requirement / Verification Criterion | Owner | ETA | Blocking Launch? |
| :---: | :---: | :--- | :---: | :---: | :---: |
| **G-01** | **Entity Verification** | Official MCA CIN, GSTIN, PAN, and Indian corporate bank account submitted for Meta Business Verification. | **Legal / Founder** | Day 1–3 | 🔴 **BLOCKING** |
| **G-02** | **Domain Ownership** | `vyaparmedia.in` verified in Google Search Console and Meta Business Manager via DNS TXT records. | **DevOps** | Day 1 | 🔴 **BLOCKING** |
| **G-03** | **Legal Policies Live** | `/privacy`, `/terms`, and `/data-deletion` live with explicit YouTube API Services disclosure and Meta data deletion instructions. | **Legal / Founder** | Day 2 | 🔴 **BLOCKING** |
| **G-04** | **Google Web-Login** | Google `web-login` OAuth client configured with `openid, email, profile` and brand verification passed. | **Dev Lead** | Day 3 | 🔴 **BLOCKING** |
| **G-05** | **Google YouTube Audit** | Demo video recorded, `youtube.readonly` justification submitted to Google Trust & Safety. | **Dev Lead** | Day 5–20 | 🟡 Non-blocking (Email/Password & Manual handles active) |
| **G-06** | **Meta App Review** | `instagram_business_basic` App Review submitted with screencast and test accounts. | **Dev Lead** | Day 5–15 | 🟡 Non-blocking (Kill-switch isolates pending approval) |
| **G-07** | **Secret Hygiene** | Production secrets (`AUTH_SECRET`, `ENCRYPTION_KEYS`, `AUTH_GOOGLE_SECRET`, `YOUTUBE_CLIENT_SECRET`, `INSTAGRAM_APP_SECRET`) injected via KMS / Vercel Env; zero fallback placeholders. | **DevOps** | Day 2 | 🔴 **BLOCKING** |
| **G-08** | **Feature Flag Defense** | Default production Redis kill-switches (`killswitch:social:instagram`, `killswitch:social:youtube`) active until provider approvals arrive. | **Dev Lead** | Day 1 | 🔴 **BLOCKING** |
| **G-09** | **Reviewer Test Seed** | Staging seed script executes with dummy creator deals for Google & Meta auditor accounts. | **QA / Dev** | Day 4 | 🔴 **BLOCKING** |
| **G-10** | **30-Day Retention Cron** | `GET /api/cron/cleanup-oauth` and `GET /api/cron/refresh-social-tokens` configured in Upstash QStash / cron runner with `CRON_SECRET`. | **DevOps** | Day 3 | 🔴 **BLOCKING** |

---

## Section D: Environment Variable Reference

Populate the following secrets into production deployment pipelines (`.env.production`):

```ini
# ==============================================================================
# VYAPARMEDIA PRODUCTION OAUTH & SOCIAL CREDENTIAL CONTRACT
# ==============================================================================

# Core Application URL (Used for rigid trusted redirect_uri construction)
NEXT_PUBLIC_APP_URL="https://app.vyaparmedia.in"
APP_URL="https://app.vyaparmedia.in"

# NextAuth v5 Primary Secret (64 hex characters minimum, no hardcoded defaults)
AUTH_SECRET="<crypto-random-256-bit-hex-string>"

# AES-GCM-256 Key Rotation Ring (v1:<64-hex-chars>)
ENCRYPTION_KEYS="v1:<64-hex-char-aes-key>"

# Google OAuth 2.0 Web Login Client (Client 1: Non-sensitive)
AUTH_GOOGLE_ID="<google-web-login-client-id>.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="<google-web-login-client-secret>"

# YouTube OAuth 2.0 Creator Sync Client (Client 2: Sensitive youtube.readonly)
YOUTUBE_CLIENT_ID="<google-youtube-sync-client-id>.apps.googleusercontent.com"
YOUTUBE_CLIENT_SECRET="<google-youtube-sync-client-secret>"
YOUTUBE_API_KEY="<restricted-server-ip-youtube-api-key>"

# Meta for Developers / Instagram Login for Tech Providers
INSTAGRAM_APP_ID="<meta-instagram-app-id>"
INSTAGRAM_APP_SECRET="<meta-instagram-app-secret>"

# Cron Authentication Guard
CRON_SECRET="<crypto-random-32-byte-hex-string>"
```
