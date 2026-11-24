# Operational Runbook: Telemetry Ingest & Rollup Incident

## Incident Summary
Occurs when user traffic telemetry ingest (`/api/telemetry/event`, `/api/telemetry/track`) experiences Redis buffer backpressure, packet drops, or when the hourly rollup cron `/api/cron/telemetry-rollup` lags behind real-time event logs.

## Symptoms
- Redis memory usage spikes above 85% on telemetry stream keys (`telemetry:stream:*`).
- Telemetry ingest p95 latency exceeds 50ms budget.
- Admin Traffic & Behaviour analytics graphs display incomplete or flatlined data.

## Step-by-Step Triage & Recovery

### 1. Check Redis Stream Queue Length
Check length of pending event buffer:
```bash
redis-cli XLEN "telemetry:stream:events"
```

### 2. Trigger Out-of-Band Telemetry Flush
Force an immediate batch flush from Redis into PostgreSQL:
```bash
curl -X POST "https://app.vyaparmedia.in/api/cron/telemetry-flush" \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

### 3. Run Emergency Retention Pruning
If Redis is near OOM, prune raw event streams older than 48 hours:
```bash
curl -X POST "https://app.vyaparmedia.in/api/cron/telemetry-retention" \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

### 4. Verify Small-Number Privacy Rules
Confirm that public/creator visibility queries strictly enforce the `<5` privacy suppression threshold without exposing raw visitor IDs.
