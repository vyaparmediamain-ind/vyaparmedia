import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Metric Fallback Guard Unit Test
 *
 * Scans all TypeScript / TSX files under `src/` to ensure no new or unapproved
 * `(...Rate|...rate|followers|views|cpv|reach) || <number>` or `?? <number>`
 * fallback patterns are introduced.
 *
 * Any fallback to a non-zero number on core metrics must be explicitly allow-listed
 * with an architectural reason (e.g. UI layout bounds, pagination limits, dispute timeouts, DRS weights).
 */

function walk(dir: string, files: string[] = []): string[] {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== "node_modules" && f !== ".next") {
        walk(full, files);
      }
    } else if (/\.(ts|tsx)$/.test(f)) {
      files.push(full);
    }
  }
  return files;
}

// Regex matching metric identifier followed by || or ?? and a non-zero number
const METRIC_FALLBACK_PATTERN =
  /([a-zA-Z0-9_.]*(?:[rR]ate|[fF]ollowers?|[vV]iews?|[cC]pv|[eE][rR]|[rR]each|[eE]ngagement)[a-zA-Z0-9_.]*)\s*(?:\|\||\?\?)\s*([1-9][0-9]*(?:\.[0-9]+)?)\b/g;

/**
 * Allow-list of legitimate non-zero fallbacks.
 * Each entry must contain file pattern, matched expression or line substring, and architectural reason.
 */
interface AllowListEntry {
  file: string;
  reason: string;
}

const ALLOW_LIST: AllowListEntry[] = [
  // UI Pagination and batch limits
  {
    file: "src/services/creator-metrics.service.ts",
    reason: "Batch chunk limit option default (maxInfluencers ?? 1000)",
  },
  {
    file: "src/components/admin/newsletter/NewsletterBroadcastForm.tsx",
    reason: "Division by zero guard for subscriber count in progress bar",
  },
  {
    file: "src/app/admin/benchmarks/CategoryBenchmarksClient.tsx",
    reason: "Deliverables count simulation bounds Math.max(1, count || 1)",
  },
  {
    file: "src/app/dashboard/campaigns/create/CreateCampaignClient.tsx",
    reason: "Campaign creator slots form bounds / minimum requirement threshold",
  },
  {
    file: "src/components/dashboard/campaigns/create/CampaignCreateHelpers.ts",
    reason: "Form default creator slots",
  },
  {
    file: "src/components/dashboard/campaigns/create/CampaignSummarySidebar.tsx",
    reason: "Slots layout bounds Math.max(1, count || 1)",
  },
  {
    file: "src/services/campaign/create.ts",
    reason: "Campaign creation validation minimum follower gate (Math.max(1000, ...))",
  },

  // Dispute & Trust Engine Review Period Timeouts (Hours)
  {
    file: "src/lib/dispute-mediator/helpers.ts",
    reason: "Review period deadline hours configuration (reviewPeriodHours ?? 48)",
  },
  {
    file: "src/lib/trust-engine.ts",
    reason: "Review period deadline hours configuration (reviewPeriodHours ?? 48)",
  },

  // DRS / Fraud Rule Weights & Penalties
  {
    file: "src/lib/drs-score.ts",
    reason: "Configurable rule weights and penalty constants",
  },
  {
    file: "src/lib/fraud-detection/payment.ts",
    reason: "Fraud rule review threshold weight constant",
  },

  // Settlement & Contract Milestone payout percentages
  {
    file: "src/lib/contract-engine.ts",
    reason: "Milestone policy fallback percentages (30/70)",
  },
  {
    file: "src/lib/deal-settlement.ts",
    reason: "Fee ratio clamped fallback (ratio ?? 1)",
  },
  {
    file: "src/lib/job-topics.ts",
    reason: "Default refund percentage payload",
  },
  {
    file: "src/app/api/deals/[id]/contract/route.ts",
    reason: "Contract version default (terms.version || 1)",
  },
  {
    file: "src/app/api/campaigns/[id]/route.ts",
    reason: "HTTP error status code fallback (error.statusCode || 400)",
  },

  // Baseline CPV fallback floor for pricing engines
  {
    file: "src/lib/fair-price-engine.ts",
    reason: "Category baseline CPV minimum division guard Math.max(1, baseline || 1)",
  },
  {
    file: "src/lib/engagement-tracker.ts",
    reason: "Reach multiplier lookup by interval fallback ('24h' || 0.15)",
  },
  {
    file: "src/components/dashboard/campaigns/CampaignRoiReport.tsx",
    reason: "Sorting missing CPV to end of list (999999) and delivery multiplier baseline",
  },
  {
    file: "src/services/scout.service.ts",
    reason: "Scout royalty percentage fallback default",
  },
  {
    file: "src/components/analytics/AdminAnalyticsView.tsx",
    reason: "UI percentage presentation fallback for empty analytics",
  },
  {
    file: "src/app/page.tsx",
    reason: "Landing page verified reviews count fallback",
  },

  // Trust score & Level & Authenticity score default baselines (Non-rate/non-volume metrics)
  {
    file: "src/auth.config.ts",
    reason: "Default user baseline trust score / level (600 / 1)",
  },
  {
    file: "src/lib/auth/session.ts",
    reason: "Default user baseline trust score / level (600 / 1)",
  },
  {
    file: "src/components/analytics/BrandDashboard.tsx",
    reason: "UI default baseline brand trust score display",
  },
  {
    file: "src/components/analytics/InfluencerDashboard.tsx",
    reason: "UI rating star bar division guard",
  },
  {
    file: "src/components/dashboard/campaigns/MatchScoreBadge.tsx",
    reason: "Matching algorithm breakdown display baseline score",
  },
  {
    file: "src/components/dashboard/home/DashboardHomeClient.tsx",
    reason: "UI default home widget trust score / level baseline",
  },
  {
    file: "src/components/dashboard/settings/AuthenticityAuditCard.tsx",
    reason: "UI sample display score for un-audited profile preview",
  },
  {
    file: "src/components/dashboard/settings/VerificationTab.tsx",
    reason: "UI verification status trust score baseline",
  },
  {
    file: "src/lib/action-eligibility.ts",
    reason: "Clean baseline authenticity score for new unflagged creator",
  },
  {
    file: "src/lib/admin-campaign-audit.ts",
    reason: "Clean baseline authenticity score for new unflagged creator",
  },
  {
    file: "src/app/admin/users/page.tsx",
    reason: "Admin dashboard display baseline for unscored creator authenticity",
  },
  {
    file: "src/app/api/reports/brand/campaign/[id]/roi/route.ts",
    reason: "Historical campaign ROI model default authenticity and rating",
  },
  {
    file: "src/services/admin.service.ts",
    reason: "Admin creator verification default baseline authenticity score",
  },
  {
    file: "src/services/campaign-roi.service.ts",
    reason: "Historical campaign ROI model default authenticity and rating",
  },
  {
    file: "src/services/fair-price.service.ts",
    reason: "Fair price model baseline authenticity score",
  },
  {
    file: "src/services/market-range-report.service.ts",
    reason: "Market range benchmark baseline authenticity score",
  },

  // Base rate / starting rate card defaults for creators without customized rate cards
  {
    file: "src/app/api/influencers/[id]/route.ts",
    reason: "Default starting rate card baseline (2000000 paise = Rs 20,000) for creator without custom rate",
  },
  {
    file: "src/app/dashboard/influencers/[id]/page.tsx",
    reason: "Default starting rate card baseline (2000000 paise = Rs 20,000) for creator without custom rate",
  },
  {
    file: "src/lib/creator-profile.ts",
    reason: "Standard base rate / content quality baseline for unconfigured profile",
  },
  {
    file: "src/components/profile/InfluencerProfileClient.tsx",
    reason: "Profile media kit starting rate card baseline",
  },
  {
    file: "src/components/dashboard/home/QuickDiscoveryRow.tsx",
    reason: "Discovery campaign budget display fallback",
  },
  {
    file: "src/services/matching.service.ts",
    reason: "Matching engine fallback budget for uncapped campaign",
  },
];

describe("Metric Fallback Guard", () => {
  it("must not contain unapproved || <number> or ?? <number> on followers, views, rates, cpv, or er", () => {
    const srcDir = path.resolve(process.cwd(), "src");
    const allFiles = walk(srcDir);

    const violations: Array<{
      file: string;
      line: number;
      expr: string;
      fullLine: string;
    }> = [];

    for (const filePath of allFiles) {
      const normalizedPath = filePath.replace(/\\/g, "/");
      const relativePath = normalizedPath.substring(normalizedPath.indexOf("src/"));
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      lines.forEach((lineText, idx) => {
        let match: RegExpExecArray | null;
        METRIC_FALLBACK_PATTERN.lastIndex = 0;
        while ((match = METRIC_FALLBACK_PATTERN.exec(lineText)) !== null) {
          const expr = match[0];

          // Check if file is in allow list
          const isAllowed = ALLOW_LIST.some((entry) => relativePath.includes(entry.file));
          if (!isAllowed) {
            violations.push({
              file: relativePath,
              line: idx + 1,
              expr,
              fullLine: lineText.trim(),
            });
          }
        }
      });
    }

    if (violations.length > 0) {
      const formatted = violations
        .map((v) => `  ${v.file}:${v.line} -> "${v.expr}" in line: "${v.fullLine}"`)
        .join("\n");
      expect.fail(
        `Found ${violations.length} unapproved metric fallback defaults (must be null/zero or explicitly allow-listed):\n${formatted}`
      );
    }

    expect(violations).toHaveLength(0);
  });
});
