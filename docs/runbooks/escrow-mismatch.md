# Operational Runbook: Escrow Reconciliation Mismatch

## Incident Summary
Occurs when the automated nightly ledger scan detects a variance between the platform's aggregate user escrow balances in PostgreSQL and the physical cash balance held in the RBI-compliant nodal bank escrow account.

## Symptoms
- Alert `escrow_reserve_mismatch_critical` triggers in `#incident-war-room`.
- Daily reconciliation cron `/api/cron/ledger-scan` returns non-zero variance.
- Admin dashboard `/admin/financial` displays amber reconciliation badge.

## Step-by-Step Triage & Recovery

### 1. Freeze Suspicious Outbound Disbursements
If variance is negative (more money promised than physical cash in nodal account):
1. Navigate to `/admin/system`.
2. Toggle Emergency Kill Switch `KILL_SWITCH_WITHDRAWALS` to ON to prevent fraudulent drains.
3. Notify the Incident Commander and Head of Finance immediately.

### 2. Run Ledger Invariant Audit
Run the database double-entry invariant verification script:
```bash
npm run db:audit-ledger
```
This queries every deal, transaction, and wallet balance:
- Confirms: $\sum \text{Wallet.balance} + \sum \text{Deal.amount (ESCROW)} = \text{Nodal Account Total}$.
- Identifies any orphan credit transactions without matching treasury debits.

### 3. Reconcile Stale or In-Flight Settlements
Check for settlements stuck between gateway clearance and ledger posting:
```bash
npm run reconcile:ledger-settlements
```

### 4. Lift Kill Switch
Once the nodal balance variance returns to exactly 0 paise:
1. Re-enable withdrawals on `/admin/system`.
2. Log the post-incident audit certificate.
