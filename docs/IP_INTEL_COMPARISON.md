# IP Intelligence Provider Evaluation & Architectural Comparison (TP-07)

## Executive Summary
VyaparMedia utilizes IP intelligence exclusively as a **soft risk telemetry signal** (registration risk scoring, account takeover heuristics, impossible travel alerts). To maintain operational reliability and comply with Indian DPDP cross-border transfer requirements, this evaluation analyzes our current free tier alongside commercial alternatives and offline database options.

---

## Provider Comparison Matrix

| Criteria | 1. freeipapi.com (Current) | 2. IPinfo.io (Commercial SaaS) | 3. ipapi.co (Commercial SaaS) | 4. MaxMind GeoLite2 (Local DB) |
|---|---|---|---|---|
| **Cost** | **$0 / month** (Free tier) | ~$49 – $249 / month | ~$15 – $100 / month | **$0** (Free license) / GeoIP2 ($) |
| **SLA & Uptime** | **No SLA** (Best-effort community) | 99.9% Uptime SLA | 99.9% Uptime SLA | **100% Availability** (Local embedded) |
| **Rate Limit** | ~60 requests / minute | 50,000 – 250,000 / month | 30,000 – 150,000 / month | **Unlimited** (In-memory lookup) |
| **Lookup Latency** | 150ms – 450ms (External HTTP) | 50ms – 150ms (Global CDN) | 80ms – 200ms (External HTTP) | **< 1ms** (Local binary reader) |
| **Privacy & DPDP** | Transmits user IP to third-party | Transmits user IP to third-party | Transmits user IP to third-party | **Zero Data Egress** (Local server) |
| **VPN/Proxy Accuracy** | Moderate (Basic datacenter flags) | **High** (Dedicated ASN/Privacy detection) | High (Proxy & Tor detection) | Requires GeoIP2 Anonymous IP ($) |
| **Operational Overhead** | None (Zero config) | Token config & quota monitoring | Token config & quota monitoring | Requires automated weekly DB sync |
| **License Restrictions** | Open usage | Commercial terms | Commercial terms | ⚠️ **Attribution & GDPR/CCPA Delete compliance** |

---

## Detailed Evaluation of Alternatives

### Option 1: freeipapi.com with 24h Cache + Negative Cache (Current Implementation)
- **Pros**: Zero infrastructure cost, zero vendor lock-in, no API keys to rotate.
- **Cons**: No SLA, strict burst rate limit (60 req/min), potential network instability or rate limit drops during traffic spikes.
- **Mitigation Implemented**:
  1. Extended Redis cache TTL to 24 hours (86,400s) for known IPs.
  2. 5-minute negative cache (300s) on non-200 responses to prevent thundering herd hammering.
  3. Strict filtering of private, loopback, CGNAT, and AWS/GCP metadata (`169.254.169.254`) addresses.
  4. Non-blocking soft signal: Fails open (`isProxy = false`) on timeout or provider error.

### Option 2: IPinfo.io Enterprise
- **Pros**: Industry-standard accuracy, dedicated privacy/VPN/Tor/Hosting flags, high reliability with SLAs.
- **Cons**: Recurring monthly SaaS cost; outbound HTTP request latency added to auth flows.
- **Trigger to Adopt**: When daily unique signups exceed 10,000/day or when dedicated VPN fraud syndicates emerge.

### Option 3: MaxMind GeoLite2 / GeoIP2 Local Database (MMDB)
- **Pros**:
  - Embedded local file lookup in Node.js runtime (`@maxmind/geoip2-node`).
  - Zero network egress — user IP never leaves the application boundary (maximum DPDP compliance).
  - Sub-millisecond execution time.
- **Cons & License Gotchas**:
  - ⚠️ **MaxMind EULA**: Requires free account with license key, compliance with data subject deletion requests, and scheduled weekly database downloads via cron (`geoipupdate`).
  - VPN/Hosting detection requires paid GeoIP2 Anonymous IP subscription.

---

## Recommendation & Next Steps

1. **Immediate Strategy (Approved)**:
   Retain **freeipapi.com** as a non-blocking soft signal with the newly implemented 24-hour cache, 5-minute negative cache, and private IP gating.
2. **Future Path (When Scale Requires)**:
   Migrate to **MaxMind GeoLite2 / GeoIP2** local database to eliminate third-party HTTP dependencies entirely, ensuring complete privacy compliance under the Digital Personal Data Protection Act, 2023.
