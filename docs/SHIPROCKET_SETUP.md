# Shiprocket Logistics Integration & Production Setup Runbook

**Service:** VyaparMedia Logistics & Product Seeding Engine  
**Target Provider:** Shiprocket API v2 (`https://apiv2.shiprocket.in/v1/external`)  
**Architecture Pattern:** Redis-Cached Bearer Token + Single-Flight Concurrency Lock + Circuit Breaker + Deterministic Order Idempotency + Fail-Closed Webhooks.

---

## 1. Dedicated Shiprocket API User Setup (Security Best Practice)

Do **NOT** use the company's primary root/owner login for automated platform API calls.

### Steps to create a dedicated API user:
1. Log in to the [Shiprocket Dashboard](https://app.shiprocket.in/) as Account Owner.
2. Navigate to **Settings ➔ Users / Company Users** (⚠️ verify in dashboard).
3. Create a dedicated API user (e.g. `logistics-api@vyaparmedia.com`).
4. Assign strict permissions:
   - Order Management: Read & Create.
   - Courier & AWB Assignment: Read & Assign.
   - Tracking & Webhooks: Read.
   - Financial/Payout Settings: Restricted / No Access.
5. Store credentials in production secrets vault (AWS Secrets Manager / Vercel Encrypted Secrets).

---

## 2. Environment Variables & Boot Validation

The platform enforces fail-closed boot validation in `src/env.ts`. In production (`NODE_ENV === "production"`), configuring `SHIPROCKET_EMAIL` without complete credentials will halt boot immediately to prevent silent failure.

| Variable | Staging / Non-Prod | Production | Purpose |
| :--- | :--- | :--- | :--- |
| `SHIPROCKET_EMAIL` | Optional (simulated mock) | `logistics-api@vyaparmedia.com` | API authentication user email |
| `SHIPROCKET_PASSWORD` | Optional | High-entropy password | API authentication password |
| `SHIPROCKET_WEBHOOK_SECRET` | Optional (warns in dev) | Secret string (min 16 chars) | Webhook authentication header |
| `SHIPROCKET_PICKUP_LOCATION` | Optional (`"Primary Warehouse"`) | Exact registered pickup name | Must match registered warehouse |
| `SHIPROCKET_PICKUP_PINCODE` | Optional (`"110001"`) | Origin warehouse 6-digit pin | Default rate calculation pin |

---

## 3. Pickup Location Registration & Exact Matching

Shiprocket API rejects adhoc order creation if `pickup_location` does not match an active pickup location registered in the Shiprocket account.

1. Navigate to **Settings ➔ Pickup Address** in Shiprocket Dashboard (⚠️ verify in dashboard).
2. Ensure the primary warehouse is registered with an exact Nickname (e.g., `Primary Warehouse` or `Noida Hub`).
3. Set `SHIPROCKET_PICKUP_LOCATION="Primary Warehouse"` in production environment variables.
4. Verify the registered pincode matches `SHIPROCKET_PICKUP_PINCODE`.

---

## 4. Webhook Configuration & Fail-Closed Invariants

Shiprocket sends tracking updates as parcels progress through courier networks.

### Webhook URL:
```
POST https://vyaparmedia.com/api/webhooks/shiprocket
```

### Authentication Header:
Configure the custom webhook secret header in Shiprocket:
- Header Name: `x-shiprocket-secret` (or standard `Authorization: Bearer <secret>`).
- Value: Exact match with `SHIPROCKET_WEBHOOK_SECRET`.

### Security Invariants:
1. **Timing-Safe Comparison:** `verifyWebhookSecret` uses `crypto.timingSafeEqual` to guard against side-channel timing attacks.
2. **Fail-Closed in Production:** If `SHIPROCKET_WEBHOOK_SECRET` is unset in production, 100% of webhook requests are rejected with HTTP 401.
3. **Replay Deduplication:** Redis `SET shiprocket:webhook:<awb>:<status>:<timestamp> 1 EX 86400 NX` prevents duplicate processing on vendor network retries.
4. **Out-of-Order Downgrade Guard:** If a deal is already marked `DELIVERED` (`productFulfillmentStatus: RECEIVED`), delayed `IN TRANSIT` webhooks will update scan logs but will **never** downgrade the deal or erase `productReceivedAt`.

---

## 5. Wallet Balance Alert & Minimum Thresholds

Shiprocket operates on a **prepaid wallet balance** model. If the Shiprocket wallet runs out of funds, AWB generation will fail across all brand dispatches.

1. Navigate to **Billing ➔ Recharge Wallet** in Shiprocket Dashboard (⚠️ verify in dashboard).
2. Configure **Low Balance Alert**:
   - Set threshold: `₹10,000` (or 2 days of peak fulfillment volume).
   - Alert email: `finance@vyaparmedia.com`, `tech-alerts@vyaparmedia.com`.
3. Enable Auto-Recharge via NACH / Corporate Card if supported by enterprise tier.

---

## 6. IP Whitelisting (Enterprise Security)

If IP whitelisting is enabled on your Shiprocket plan (⚠️ verify in dashboard):
- Vercel utilizes dynamic IP ranges. Use a static egress proxy or dedicated AWS NAT Gateway with static Elastic IPs for Shiprocket outbound calls.
- Submit the static proxy IPs to Shiprocket support for whitelisting.

---

## 7. Operations & Failure Dispute Matrix

| Status | Canonical State | Platform Action | User Notification |
| :--- | :--- | :--- | :--- |
| `DELIVERED` | `DELIVERED` | Set `productFulfillmentStatus = RECEIVED`, record `productReceivedAt` | "Delivery Confirmed" sent to brand and creator |
| `OUT FOR DELIVERY` | `OUT_FOR_DELIVERY` | Update `shippingStatus` & append scans | — |
| `IN TRANSIT` | `IN_TRANSIT` | Update `shippingStatus` & append scans | — |
| `PICKUP SCHEDULED` | `PICKUP_SCHEDULED` | Initial state upon dispatch | "Product dispatched via Shiprocket" |
| `RTO INITIATED` | `RTO_INITIATED` | Delivery failed, returning to origin | Alert sent to brand and creator |
| `RTO DELIVERED` | `RTO_DELIVERED` | Product returned to warehouse | Brand notified to inspect package; dispute path available |
| `LOST` / `DAMAGED` | `LOST` / `DAMAGED` | Carrier failure in transit | Automated alert to file carrier insurance claim |
| `CANCELLED` | `CANCELLED` | Shipment cancelled prior to pickup | Brand notified |

---

## 8. Data Privacy (DPDP Act) & PII Retention

Under India's Digital Personal Data Protection (DPDP) Act:
1. **Minimal Storage:** Influencer delivery addresses and phone numbers are stored strictly for fulfillment and customs declaration.
2. **Zero Sensitive Logging:** Recipient mobile numbers and full street addresses are masked in application logs (`logger.info` / `logger.error`).
3. **Right to Erasure Compliance:** When a user requests account deletion via `DELETE /api/user/delete-account`, `address` and `pinCode` fields in `influencerProfile` and `brandProfile` are permanently set to `null`.
