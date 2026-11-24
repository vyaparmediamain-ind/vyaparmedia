# Operational Runbook: Admin Compromise & Emergency Lockout Recovery

## Incident Summary
Occurs when an administrator account is suspected of credential leakage, unauthorized role escalation, compromised session tokens, or when active staff are locked out of the administrative portal.

## Symptoms
- Audit log shows unexpected administrative actions from unrecognized IP addresses or unusual hours.
- Admin user reported lost 2FA device or compromised email account.
- 403 Forbidden errors across all admin dashboard routes.

## Step-by-Step Triage & Recovery

### 1. Emergency Session Invalidation
Immediately revoke all active NextAuth JWT sessions and Redis permission caches:
```bash
npm run admin:revoke-all-sessions
```
This forces all active staff to re-authenticate and re-verify TOTP credentials.

### 2. Lockout the Compromised Admin Account
Directly lock the affected user in PostgreSQL:
```sql
UPDATE "User" 
SET status = 'SUSPENDED', "verificationLevel" = 'NONE'
WHERE email = '[COMPROMISED_EMAIL]';
```

### 3. Clear Admin Permission Cache
Purge Redis admin authorization cache keys:
```bash
redis-cli DEL "admin:active:[USER_ID]"
redis-cli DEL "cache:admin:auth:*"
```

### 4. Break-Glass Emergency Admin Provisioning
If all active administrators are locked out:
1. SSH into the production bastion host.
2. Run the break-glass recovery CLI with the master database encryption key:
   ```bash
   npm run admin:emergency-break-glass -- --email=[RECOVERY_ADMIN_EMAIL]
   ```
3. A single-use TOTP setup QR code is generated in terminal.
4. Scan the QR code, log in immediately, and rotate all administrative API secrets.
