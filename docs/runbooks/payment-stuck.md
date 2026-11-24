# Operational Runbook: Payment Stuck / Webhook Drop Resolution

## Incident Summary
Occurs when an incoming Razorpay webhook fails to deliver (e.g., HTTP 5xx, timeout, signature mismatch) or a withdrawal payout via RazorpayX remains stuck in `PROCESSING` state past the standard SLA (30 minutes).

## Symptoms
- Brand reported funds debited from bank, but platform wallet balance did not increase.
- Creator requested withdrawal, but payout status remains `PENDING` without an IMPS UTR number.
- High failure rate alert on `/api/payments/webhook`.

## Step-by-Step Triage & Recovery

### 1. Check Razorpay Status
Verify external gateway health:
- Check [Razorpay Status Dashboard](https://status.razorpay.com/) for banking partner degradation (HDFC, ICICI, SBI UPI rails).

### 2. Inspect Inbound Webhook Logs
Query PostgreSQL for recent webhook events:
```sql
SELECT id, "paymentId", status, "errorMessage", "createdAt" 
FROM "PaymentWebhookEvent" 
WHERE status = 'FAILED' OR status = 'PENDING'
ORDER BY "createdAt" DESC LIMIT 20;
```

### 3. Check Idempotency Key & Mutex Locks
Ensure the webhook did not abort due to a deadlocked distributed Redis mutex:
```bash
redis-cli GET "lock:webhook:razorpay:[PAYMENT_ID]"
```
If key is orphaned with no active thread, delete the lock key.

### 4. Manual Verification & Reconciliation
If payment was confirmed in Razorpay Dashboard:
1. Open Admin Panel: `/admin/financial`.
2. Locate transaction under "Pending Inbound Deposits".
3. Verify Razorpay Payment ID, Amount (in paise), and Order ID.
4. Trigger administrative reconciliation:
   ```bash
   npm run reconcile:payment -- --payment-id=[PAYMENT_ID]
   ```
5. Confirm wallet credit and verify ledger balancing.

## Post-Mortem & Preventative Actions
- Ensure Razorpay webhook secret is correctly configured in environment variables.
- Review Sentry issues for unexpected serialization errors in `/api/payments/webhook`.
