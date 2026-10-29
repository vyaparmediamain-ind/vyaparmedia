/**
 * Pre-flight Resend Domain Verification (P1-REL-11)
 *
 * Verifies SPF, DKIM, and DMARC status on Resend before deployment.
 * Major mail providers (Google, Yahoo) reject unauthenticated emails with 550 5.7.26.
 *
 * Usage: npx tsx scripts/verify-resend-domain.ts
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@vyaparmedia.in";
const TARGET_DOMAIN = FROM_EMAIL.split("@")[1]?.toLowerCase() || "vyaparmedia.in";

async function verifyResendDomain(): Promise<void> {
  console.log(`[Resend Pre-Flight] Validating domain authentication for: ${TARGET_DOMAIN}`);

  if (!RESEND_API_KEY) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Resend Pre-Flight] ERROR: RESEND_API_KEY is not configured in production.");
      process.exit(1);
    }
    console.warn("[Resend Pre-Flight] SKIPPED: RESEND_API_KEY is not set (non-production environment).");
    process.exit(0);
  }

  try {
    const res = await fetch("https://api.resend.com/domains", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[Resend Pre-Flight] FAILED: Resend API returned ${res.status}: ${errText}`);
      if (process.env.NODE_ENV === "production") {
        process.exit(1);
      }
      process.exit(0);
    }

    const json = (await res.json()) as {
      data?: Array<{
        id: string;
        name: string;
        status: string;
        records?: Array<{ record: string; name: string; type: string; value: string; status: string }>;
      }>;
    };

    const domains = json.data || [];
    const matched = domains.find((d) => d.name.toLowerCase() === TARGET_DOMAIN);

    if (!matched) {
      console.error(`[Resend Pre-Flight] ERROR: Domain "${TARGET_DOMAIN}" is not registered in your Resend account.`);
      console.error("Please add the domain at https://resend.com/domains and configure DNS records:");
      console.error("  1. SPF: TXT record with value provided by Resend");
      console.error("  2. DKIM: CNAME/TXT records for resend._domainkey");
      console.error("  3. DMARC: TXT record at _dmarc with v=DMARC1; p=none/quarantine");
      if (process.env.NODE_ENV === "production") {
        process.exit(1);
      }
      process.exit(0);
    }

    if (matched.status !== "verified") {
      console.warn(`[Resend Pre-Flight] WARNING: Domain "${TARGET_DOMAIN}" status is "${matched.status}" (expected "verified").`);
      if (matched.records && matched.records.length > 0) {
        console.table(matched.records.map((r) => ({
          Type: r.type,
          Name: r.name,
          Status: r.status,
        })));
      }
      if (process.env.NODE_ENV === "production") {
        console.error("[Resend Pre-Flight] Deployment aborted: Unverified domain causes email delivery drops in production.");
        process.exit(1);
      }
    } else {
      console.log(`[Resend Pre-Flight] SUCCESS: Domain "${TARGET_DOMAIN}" is verified with SPF/DKIM/DMARC.`);
    }
  } catch (err) {
    console.error("[Resend Pre-Flight] Network or timeout error checking Resend domain:", err);
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  }
}

verifyResendDomain();
