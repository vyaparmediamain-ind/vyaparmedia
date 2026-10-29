# Razorpay Production Go-Live & RBI PA Compliance Runbook

**Service:** VyaparMedia Payment Infrastructure (Orders, Route Escrow, Webhooks, RazorpayX Payouts)  
**Target Environment:** Production (`rzp_live_*`)  
**Compliance Standard:** RBI Payment Aggregator Guidelines (DPSS.CO.PD.No.1810/02.14.008/2019-20) & Razorpay Route Master Services Agreement.

---

## 1. Route Eligibility & RBI PA Compliance Checklist (TP-03)

Under the RBI Guidelines on Regulation of Payment Aggregators and Payment Gateways, marketplace platforms that handle multi-party fund flows (Brand ➔ Influencer) without holding a full PA license must operate under a compliant escrow/nodal model such as **Razorpay Route**.

### Mandatory Compliance Steps:
- [ ] **Turnover & PA Exemption Evaluation**: Confirm platform gross annual transaction volume is within allowable limits for marketplace intermediaries utilizing third-party PA escrow mechanisms.
- [ ] **Payer-Payee Transparency Agreement**: Platform Terms of Service must clearly specify that VyaparMedia acts strictly as a technology facilitator and does not pool or take custody of merchant settlements into proprietary bank accounts. Funds are transferred via Razorpay Route directly to creator linked accounts.
- [ ] **Use-Case Formal Approval (⚠️ Razorpay support se confirm)**: Submit VyaparMedia's two-sided escrow workflow (Brand payment ➔ `on_hold` Route transfer ➔ Post-verification PATCH release) to Razorpay Account Management for written compliance sign-off.
- [ ] **Sub-Merchant / Linked-Account KYC Verification**:
  - Influencer PAN verification (validated against NSDL/Income Tax database).
  - Penny-drop bank account validation (`validateFundAccount` in `src/lib/razorpay.ts`).
  - Active linked-account status check (`account.legal_business_name`, `account.status === "activated"`) enforced prior to initiating any Route transfer (`src/services/payment.service.ts:1037`).
- [ ] **Direct Creator Settlement Guard**: Verify that deal payouts settle directly from the gateway to the creator's bank account and do NOT credit internal wallet ledger balances (`processDealCompletion` in `payment.service.ts`).

---

## 2. API Keys & Production Environment Hardening

| Variable | Sandbox / Staging | Production | Enforcement Rule |
| :--- | :--- | :--- | :--- |
| `RAZORPAY_KEY_ID` | `rzp_test_*` | `rzp_live_*` | Enforced in `src/env.ts` (Throws in prod if key starts with `rzp_test_`) |
| `RAZORPAY_KEY_SECRET` | Secret string | Secret string | Minimum 16 characters |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | `rzp_test_*` | `rzp_live_*` | Mode **MUST** match server `RAZORPAY_KEY_ID` mode |
| `ALLOW_RZP_TEST` | `true` | `false` | Must remain `false` in production (🔒) |
| `RAZORPAY_WEBHOOK_SECRET` | Secret string | Secret string | Validated via `crypto.timingSafeEqual` |
| `RAZORPAY_ACCOUNT_NUMBER` | Sandbox Acc Num | Live Acc Num | Required for RazorpayX balance health checks |

**Verification in Dashboard:**
- ⚠️ Verify in Dashboard: Activate Live mode in Razorpay Dashboard (`https://dashboard.razorpay.com/app/keys`).
- ⚠️ Verify in Dashboard: Verify that webhook URL points to `https://vyaparmedia.com/api/payments/webhook`.

---

## 3. Webhook Secret Rotation Protocol (Zero-Downtime)

To rotate the `RAZORPAY_WEBHOOK_SECRET` without dropping in-flight webhook events from Razorpay:

### Phase 1: Dual-Secret Verification Support
1. In `src/lib/razorpay.ts`, `verifyWebhookSignature` supports comma-separated secrets in `RAZORPAY_WEBHOOK_SECRET` (e.g. `secret_new,secret_old`).
2. Generate a new high-entropy webhook secret in the password manager / vault.
3. Update production environment variables:
   ```bash
   RAZORPAY_WEBHOOK_SECRET="new_secret_hex_64_chars,old_secret_hex_64_chars"
   ```
4. Deploy the application or trigger zero-downtime configuration reload.

### Phase 2: Gateway Configuration Update
5. Log in to Razorpay Dashboard ➔ **Settings** ➔ **Webhooks** (⚠️ verify in dashboard).
6. Edit the webhook configuration and replace the secret with `new_secret_hex_64_chars`.
7. Save changes. Incoming webhooks will now be signed with `new_secret_hex_64_chars`.

### Phase 3: Cleanup & Monitoring
8. Inspect Datadog/CloudWatch logs and Prometheus metric `VyaparMedia_system_errors_total{error_type="WEBHOOK_SIGNATURE_INVALID"}` for 15 minutes.
9. Verify error rate is `0`.
10. Remove `old_secret_hex_64_chars` from production environment variables:
    ```bash
    RAZORPAY_WEBHOOK_SECRET="new_secret_hex_64_chars"
    ```

---

## 4. RazorpayX Payouts & Operational Safeguards

1. **Penny-Drop Validation**: Every creator bank account must undergo penny-drop verification before enabling withdrawals.
2. **Transfer Mode Constraints**:
   - Modes **MUST** be uppercase: `"IMPS"`, `"NEFT"`, `"RTGS"`, `"UPI"`.
   - IMPS single-transaction cap: **₹5,00,000** (50,000,000 paise) enforced by `MAX_WITHDRAWAL_AMOUNT_PAISE`.
3. **Queue If Low Balance**:
   - Payout requests specify `queue_if_low_balance: true`.
   - When account balance is insufficient, payouts enter `queued` / `pending` status.
   - Cron alert triggers critical Sentry/Ops alerts when balance < **₹50,000** (`reconcile-payouts`).
4. **Deterministic Payout Reconciliation (TP-04)**:
   - Every payout submission sets `reference_id = withdrawal.id`.
   - On 5xx gateway error or timeout, the system does **NOT** blindly re-credit the wallet.
   - The cron queries RazorpayX by `fetchPayoutByReferenceId(withdrawal.id)` to confirm if the transaction reached the banking partner.
   - Only if verified as never received (404/empty) does the system refund the wallet.

---

## 5. Daily Settlement Cross-Check (IST Timezone)

- **Job**: `cron/reconcile-ledger-settlements` runs daily at 03:00 AM IST.
- **Window**: Exactly previous day 00:00:00 to 23:59:59 IST (UTC+5:30) converted to Unix epoch seconds.
- **Pagination**: Loops `fetchRazorpayPayments` with `count: 100`, `skip: 0, 100, 200, ...` until full dataset is reconciled.
- **DLQ Enqueueing**: Any gateway captured payment missing from the local `Transaction` ledger or having an amount mismatch is enqueued to `DeadLetterJob` under topic `reconciliation.gateway_mismatch`.

---

## 6. Observability & Alerting Reference

| Metric Name | Type | Description | Alert Threshold |
| :--- | :--- | :--- | :--- |
| `VyaparMedia_razorpay_api_duration_ms` | Histogram | Outbound Razorpay latency | p95 > 2500ms for 5m |
| `VyaparMedia_razorpay_api_errors_total` | Counter | Gateway HTTP 5xx / timeouts | Rate > 1/min |
| `VyaparMedia_razorpay_webhook_lag_seconds` | Histogram | Webhook dispatch to ingestion lag | p95 > 60s |
| `VyaparMedia_razorpay_payouts_total` | Counter | Payouts by status (processed/failed/reversed) | Failed rate > 5% |
| `VyaparMedia_circuit_breaker_open_total` | Counter | Circuit breaker trips to OPEN state | Count > 0 |

---

*Last Updated: October 2026*  
*Authors: VyaparMedia Core Payments Engineering Team*
