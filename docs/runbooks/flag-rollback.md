# Operational Runbook: Feature Flag Rollback Protocol

## Incident Summary
Defines the safe, non-destructive rollout and emergency rollback procedures for platform feature flags managed under `/admin/system`.

## Feature Flag Catalog & Blast Radius

| Flag Key | Description | Default State | Rollback Action |
|---|---|---|---|
| `branded_reports` | Generates official PDF/CSV executive reports | ON | Disable flag to revert to standard web view |
| `report_verification` | Public cryptographic SHA-256 validation | ON | Disable flag; existing reports still download |
| `new_campaign_wizard` | 3-step campaign creation wizard | ON | Disable flag to fall back to classic form |
| `telemetry_v3` | Advanced audience telemetry and dwell tracking | ON | Disable flag to bypass background logging |

## Rollback Execution Steps

### 1. Toggle Off via Admin Portal
1. Navigate to `/admin/system` -> Feature Flags Console.
2. Locate the offending flag (e.g. `branded_reports`).
3. Click "Disable". State updates immediately in Redis and PostgreSQL.

### 2. CLI Fast Rollback (If Admin UI is Unreachable)
```bash
npm run flag:toggle -- --flag=[FLAG_KEY] --state=false
```

### 3. Flush Feature Flag Redis Cache
Ensure distributed edge instances pick up the disabled flag within 1 second:
```bash
redis-cli DEL "feature_flag:[FLAG_KEY]"
redis-cli DEL "cache:feature_flags:all"
```

### 4. Verify System Stabilization
Confirm Sentry error rate decreases and application responses stabilize.
