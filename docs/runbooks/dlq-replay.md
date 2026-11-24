# Operational Runbook: Dead Letter Queue (DLQ) Triage & Safe Replay

## Incident Summary
Occurs when asynchronous background tasks (QStash message consumers, email notifications, payment reconciliation jobs) exceed maximum retry thresholds (3 attempts) and are routed to the Dead Letter Queue (`/admin/system#dlq`, `/api/admin/jobs/dlq`).

## Symptoms
- Alert `dlq_depth_exceeded` triggers (DLQ count > 10 messages).
- Admin system controls display red DLQ warning badge.

## Step-by-Step Triage & Replay

### 1. Inspect Dead Letter Payloads
1. Navigate to `/admin/system` -> Dead Letter Queue tab.
2. Inspect the failed job list:
   - Identify `topic` (e.g., `deal-milestone-release`, `email-notification`, `ledger-reconcile`).
   - Examine `lastError` stack trace and payload JSON.

### 2. Classify Root Cause
- **Transient Network / Vendor Timeout**: Safe to replay immediately.
- **Database Unique Constraint / Data Bug**: Do not replay until code fix is deployed.
- **Malformed Payload**: Manually discard or fix payload before replay.

### 3. Deploy Necessary Fix First
If the error was due to an external API format change or code exception, deploy the hotfix before initiating replay to prevent infinite loop poison pills.

### 4. Execute Safe Replay
1. For single jobs: Click "Replay Message" on the job card in `/admin/system`.
2. For batch replay of resolved transient errors:
   ```bash
   npm run dlq:replay -- --topic=[TOPIC_NAME] --limit=50
   ```
3. Monitor consumer logs in Vercel to confirm successful job consumption.
