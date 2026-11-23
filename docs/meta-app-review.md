# Meta App Review Submission Guide: `instagram_business_manage_insights`

> **Document Target**: Meta Developer Portal & App Review Dashboard  
> **Application Name**: VyaparMedia Influencer Marketplace  
> **App Category**: Business / Influencer Marketing & Escrow Automation  
> **Requested Permission**: `instagram_business_manage_insights`  
> **Access Level Required**: Advanced Access  
> **Target Audience**: Professional Creators (Creator / Business Instagram accounts) and Verified Indian SMB Brands  
> **Author**: VyaparMedia Engineering Team  

---

## 1. Executive Summary & Purpose

VyaparMedia is an escrow-backed influencer marketing and commerce marketplace in India. Brands hire creators for campaign deliverables (Instagram Reels, Feed posts, and Stories). 

To ensure fair payment release from RBI-compliant escrow, VyaparMedia verifies that published campaign deliverables meet agreed reach and view milestones. 

- Under `instagram_business_basic`, Meta provides only profile metadata, like counts, and comment counts. It **does not** provide view counts, reach, shares, or saves.
- The `instagram_business_manage_insights` permission is required to read read-only performance telemetry (`views`, `reach`, `shares`, `saved`, `total_interactions`) for media objects published under an active campaign contract.

---

## 2. Permission Justification Text (Meta Submission Form)

*Copy and paste the text below into the "How will your app use this permission?" text box on the Meta Developer Portal:*

### 2.1 Primary Justification Statement
> "Our application, VyaparMedia, is an influencer campaign collaboration platform. Brands deposit campaign funds into milestone escrow accounts, and creators complete sponsored content deliverables on Instagram.
>
> We request `instagram_business_manage_insights` to read read-only media metrics—specifically `views`, `reach`, `saved`, and `shares`—for posts and reels created by creators who connect their Instagram Professional accounts to our platform.
>
> These verified metrics are displayed to the creator and the hiring brand in their contract dashboard to verify that milestone deliverables were successfully executed. This replaces inaccurate third-party estimations with Meta's official API insights, ensuring that creators are paid promptly and transparently for their genuine organic performance."

### 2.2 Why Basic Scope Is Insufficient
> "The `instagram_business_basic` permission provides access only to public likes, comments, captions, and media permalinks. View counts, reach, saves, and shares are completely inaccessible under `instagram_business_basic`. Because view count is the primary commercial metric (Cost Per View / CPV) in digital brand marketing, our platform cannot confirm contract fulfillment without access to `instagram_business_manage_insights`."

### 2.3 User Experience & Data Flow
> "1. A creator navigates to **Settings > Social Platforms** and clicks **'Connect Instagram'** (or **'Enable Verified Views'**).
> 2. The creator is directed to Meta's secure OAuth consent dialog requesting `instagram_business_basic` and `instagram_business_manage_insights`.
> 3. If the creator grants insights, our platform fetches read-only insights for the creator's campaign posts via `GET graph.instagram.com/{media-id}/insights?metric=views,reach,likes,comments,shares,saved,total_interactions`.
> 4. If the creator denies the insights scope, our platform connects with basic scope only and clearly informs the creator that views will be calculated via platform estimates.
> 5. The creator can disconnect their account or revoke permissions at any time via Settings or via Instagram's 'Apps and Websites' menu."

---

## 3. Screencast Video Walkthrough Script (2-Minute Video)

Meta requires a demonstration video showing the end-to-end user experience. Follow this exact storyboard when recording the screencast:

| Timestamp | Screen / Action | Voiceover / Text Overlay |
| :--- | :--- | :--- |
| **0:00 - 0:15** | Log in to VyaparMedia creator dashboard (`app.vyaparmedia.in` or local/staging tunnel). | *"Welcome to VyaparMedia. We are demonstrating our integration with Meta's Instagram API using Instagram Login and the `instagram_business_manage_insights` permission."* |
| **0:15 - 0:35** | Navigate to **Settings > Social Tab**. Point out the Instagram card displaying status: *"Views access: Basic (Estimated)"* or *"Not connected"*. | *"Creators manage their connected accounts here. To verify campaign performance with genuine data, creators click 'Connect Instagram' or 'Enable Verified Views'."* |
| **0:35 - 0:55** | Click **"Connect Instagram"**. Meta OAuth dialog opens showing permissions for profile information and media insights. | *"The creator is redirected to Meta's OAuth dialog. Notice the explicit request for `instagram_business_basic` and `instagram_business_manage_insights`. The creator reviews and approves the permissions."* |
| **0:55 - 1:15** | Redirect back to Settings. The Instagram card now displays a green state chip: **"Views access: Active"**. | *"Upon successful authorization, the account status immediately updates to 'Views access: Active'. Access tokens are securely encrypted with AES-256-GCM."* |
| **1:15 - 1:40** | Navigate to an active campaign contract under **Deals > Campaign Workspace**. View the **Engagement Snapshot Card** showing verified view counts, reach, shares, and saves with a green **"VERIFIED"** data quality tag. | *"When a creator submits their campaign Reel or Post, our system queries Meta's `media/insights` endpoint. Both the creator and the brand see official Meta view counts and reach, guaranteeing escrow milestone accuracy."* |
| **1:40 - 2:00** | Demonstrate disconnection: Go back to Settings and click **"Disconnect"**. State chip updates to *"Not connected"*. | *"Creators have complete autonomy to disconnect their account at any time. Thank you for reviewing VyaparMedia."* |

---

## 4. Data-Use & Security Compliance

### 4.1 Restricted Scope & Invariants
- **No Direct Messages**: VyaparMedia does not request `instagram_manage_messages`.
- **No Publishing / Posting**: VyaparMedia is strictly read-only; it does not request `instagram_content_publish`.
- **Professional Accounts Only**: Insights are only queried for Business and Creator accounts. Personal accounts are not queried.
- **Handling Empty Datasets**: When Meta returns an empty dataset `[]` (e.g. for media inside carousel albums or stories with fewer than 5 viewers), VyaparMedia treats the metric as `undefined` and falls back to conservative heuristics rather than showing synthetic zero values.

### 4.2 Security & Encryption Standards
- **Token Storage**: All short-lived and long-lived OAuth tokens are encrypted using **AES-256-GCM** with unique IVs before persisting to Postgres (`src/lib/encryption.ts`).
- **Zero Token Logging**: OAuth tokens, authorization codes, and refresh tokens are strictly scrubbed from all Winston and Sentry logs (`src/lib/sentry-sanitizer.ts`).
- **Circuit Breakers & Timeouts**: All calls to `graph.instagram.com` are wrapped in circuit breakers (`instagram:insights`) with a 5000ms timeout (`SOCIAL_API_TIMEOUT_MS`) and kill-switch protections (`SOCIAL_INSTAGRAM`).

---

## 5. Privacy Policy & Terms of Service Requirements

Ensure the following clauses are published on `https://vyaparmedia.in/privacy` and `https://vyaparmedia.in/terms` before submitting for review:

1. **Third-Party Platform Data Disclosure**:
   > *"When you connect your Instagram Professional account to VyaparMedia, we access basic profile information (username, follower count) and media insights (views, reach, engagements) via Meta's Graph API. We use this data exclusively to verify sponsored campaign deliverables and calculate engagement analytics for your account."*
2. **Data Retention & Deletion**:
   > *"We retain media performance metrics for active campaign records for 30 days. You may disconnect your Instagram account or request data deletion at any time via your Settings page or by contacting privacy@vyaparmedia.in. You can also revoke access directly through your Instagram account settings under 'Apps and Websites'."*
3. **No Commercial Resale of User Data**:
   > *"VyaparMedia does not sell, broker, or license Instagram user telemetry to data brokers or advertising networks."*

---

## 6. Test Accounts & Reviewer Instructions

For Meta Reviewers testing the integration:

1. **Review URL**: `https://app.vyaparmedia.in` (or designated staging tunnel URL).
2. **Test Creator Credentials**:
   - **Email**: `meta-reviewer-creator@vyaparmedia.in`
   - **Password**: *(Provided in Meta Secure Submission Notes)*
3. **Test Instagram Professional Account**:
   - Use an Instagram test user created under Meta App Dashboard > Roles > Test Users with Role: Instagram Tester.
4. **Step-by-Step Test Procedure**:
   - Log in with the test creator credentials.
   - Click the avatar / settings menu -> **Settings** -> **Social Platforms**.
   - Under Instagram, click **"Enable Verified Views"** (or **"Connect Instagram"**).
   - Log in to Instagram with the test user and grant both Basic and Insights permissions.
   - Verify the state chip changes to **"Views access: Active"**.
