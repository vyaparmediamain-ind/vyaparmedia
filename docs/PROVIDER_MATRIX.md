# VyaparMedia Communications & Messaging Provider Matrix (`docs/PROVIDER_MATRIX.md`)

> **Last Updated:** October 2026  
> **Status:** Production Ready & Enforced  
> **Architecture Standard:** Single Primary per Channel → Circuit Breaker Protected → Automatic Degraded Fallback Chain → Strict DLT/RFC Compliance.

---

## 1. Channel & Provider Architecture Matrix

| Channel | Primary Provider | Secondary Fallback | Protocol / API Surface | Regulatory & RFC Compliance |
| :--- | :--- | :--- | :--- | :--- |
| **Transactional SMS** | **MSG91** | None (Fail Fast / Logged) | MSG91 Flow API (`https://api.msg91.com/api/v5/flow/`) | **TRAI TCCCPR (2018) DLT**: Entity ID, Sender ID `DCSNL` (6 chars), category template IDs |
| **WhatsApp OTP** | **Meta Cloud API** | **Twilio WhatsApp** | Meta Graph API v20.0 (`/messages`) → Twilio REST API (`/Messages.json`) | Approved Authentication template category, copy-code button, Business Verification |
| **Transactional & Marketing Email** | **Resend** | None (Exponential Retry) | Resend API v1 (`https://api.resend.com/emails`) | **RFC 8058** One-Click `List-Unsubscribe`, SPF/DKIM/DMARC domain alignment, Svix webhook suppression |

---

## 2. Channel Deep-Dives & Operational Runbooks

### A. SMS Delivery (MSG91 & TRAI DLT Compliance)
- **Primary Endpoint**: `https://api.msg91.com/api/v5/flow/`
- **Sender ID / Header**: Registered 6-character header (`DCSNL` / `MSG91_SENDER_ID`).
- **DLT Template Resolution**:
  - `otp`: `MSG91_OTP_TEMPLATE_ID` (Placeholder: `##otp##` / `##code##`)
  - `transactional` / `deal`: `MSG91_TRANSACTIONAL_TEMPLATE_ID`
  - `fulfillment` / `shipping`: `MSG91_FULFILLMENT_TEMPLATE_ID`
  - `notification`: `MSG91_NOTIFICATION_TEMPLATE_ID`
- **Production Enforcement**:
  - For OTP SMS: Missing DLT template in production fails loudly to prevent unverified delivery.
  - For Non-OTP SMS: If DLT template is unconfigured, delivery is skipped silently with a warning metric to avoid TRAI operator rejection fines.
- **Circuit Breaker**: `withCircuitBreaker("msg91:api")` trips after 5 consecutive 5xx/network errors, fast-failing for 60 seconds.
- **Delivery Report (DLR) Webhook**:
  - Endpoint: `/api/webhooks/msg91` (POST/GET)
  - Records delivery status (`DELIVRD`, `UNDELIV`, `FAILED`) into Redis key `sms:dlr:<requestId>` with 24h TTL.

---

### B. WhatsApp Delivery (Meta Cloud API Primary + Twilio Fallback)
- **Fallback Chain**:
  1. **Meta Cloud API**: Attempted first when `WHATSAPP_PROVIDER` is `"meta"` or `"auto"`. Uses template messages (`WHATSAPP_OTP_TEMPLATE_NAME`) with language (`WHATSAPP_TEMPLATE_LANGUAGE`, default `en_US`).
  2. **Twilio WhatsApp**: Fallback when Meta fails or trips circuit breaker. Uses `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_WHATSAPP_FROM`.
  3. **MSG91 SMS**: Ultimate fallback when both WhatsApp providers fail.
- **Circuit Breakers**:
  - Meta: `withCircuitBreaker("meta:whatsapp")`
  - Twilio: `withCircuitBreaker("twilio:whatsapp")`
- **Production Boot Validation (`src/env.ts`)**:
  - When `WHATSAPP_PROVIDER === "meta"`, boot validation enforces that `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, and `WHATSAPP_OTP_TEMPLATE_NAME` are non-empty strings.

---

### C. Email Delivery (Resend Hardening & Deliverability)
- **Primary Endpoint**: `https://api.resend.com/emails`
- **Idempotency Guarantee**:
  - Outbound requests pass header `Idempotency-Key: resend_${correlationId}`.
  - Guarantees network retries (1s, 2s, 4s backoff) never deliver duplicate emails to users.
- **RFC 8058 Bulk Sender Compliance**:
  - Blog newsletters attach RFC 8058 headers:
    - `List-Unsubscribe: <https://vyaparmedia.in/api/blog/unsubscribe?token=...>`
    - `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
- **Realtime Bounce & Complaint Suppression**:
  - Webhook Endpoint: `/api/webhooks/resend`
  - Svix HMAC signature verification validates `svix-id`, `svix-timestamp`, and `svix-signature`.
  - On `email.bounced` or `email.complained`, recipient is cached in Redis `email:suppressed:${email}` for 90 days.
  - `sendEmail` checks the suppression list before invoking Resend, dropping sends to bad addresses to maintain high sender reputation score.
- **Template Security**:
  - Every dynamic field is escaped via `escapeHtml()`.
  - Preview preheaders are escaped before injection into hidden preview `<div>`.
  - Links are generated from `getAppUrl()` (`env.NEXTAUTH_URL`), never trusting untrusted HTTP `Host` headers.

---

## 3. Fraud Prevention & Cost Protection
- **Geo-Allowlist**:
  - `normalizeIndianPhone` enforces `+91` / `91` Indian mobile numbers starting with `[6-9]`.
  - Foreign country codes (+1, +44, +86, etc.) are rejected upfront to eliminate international toll-fraud / SMS pumping attacks.
- **Daily SMS Volume Cap**:
  - Distributed Redis counter `sms:daily_cap:<YYYY-MM-DD>` tracks daily SMS volume.
  - Default cap: 1,000 SMS/day.
  - Emits warning log at 80% capacity and blocks further dispatches upon reaching 100% capacity with alert: `[SMS ABUSE GUARD] Daily SMS limit exceeded! Potential toll-fraud pumping attack blocked.`
- **Operational Kill Switch**:
  - Key: `killswitch:otp` (managed via Redis).
  - When active, immediately pauses OTP dispatches with clean user message without incurring vendor costs.
- **Uniform User Enumeration Guard**:
  - Registration requests for existing phone numbers or emails return uniform success response:
    *"If this phone number/email can be registered, an OTP has been sent."*
  - OTP values are never echoed in API response payloads in production.
- **User-Facing Failure UX**:
  - On total communication gateway failure, users receive the standardized, empathetic message:
    *"OTP bhejne me dikkat aayi. 60 second baad dobara try karein"* with direct alternative channel retry CTA.
  - Raw technical exceptions, provider names (Twilio, MSG91, Meta, Resend), and internal errors are strictly blocked from leaking.
