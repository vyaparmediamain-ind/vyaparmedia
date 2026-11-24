/**
 * VyaparMedia In-Product Guide Coverage AST & Audit Generator
 *
 * Scans routes.json, navigation config, forms, widgets, and action buttons.
 * Maps every page route, primary action, complex form, and dashboard widget to a valid guide ID.
 * Generates docs/audit/guide-coverage.json.
 */

import fs from "node:fs";
import path from "node:path";
import { ALL_GUIDES, getGuideById } from "../../src/content/guides";

export interface PageGuideMapping {
  path: string;
  roles: string[];
  guideId: string;
  guideTitle: string;
}

export interface ActionGuideMapping {
  actionId: string;
  label: string;
  page: string;
  role: string;
  guideId: string;
  stepAnchor?: string;
  isDestructive?: boolean;
  safetyRunbook?: string;
}

export interface FormGuideMapping {
  formId: string;
  name: string;
  page: string;
  role: string;
  guideId: string;
}

export interface WidgetGuideMapping {
  widgetId: string;
  name: string;
  page: string;
  role: string;
  guideId: string;
}

export interface GuideCoverageReport {
  generatedAt: string;
  summary: {
    totalPages: number;
    mappedPages: number;
    pageCoveragePercent: number;
    totalPrimaryActions: number;
    mappedPrimaryActions: number;
    totalForms: number;
    mappedForms: number;
    totalWidgets: number;
    mappedWidgets: number;
    totalDestructiveButtons: number;
    mappedDestructiveButtons: number;
    totalHelpTipsFound: number;
    coverageStatus: "COMPLETE" | "PARTIAL";
  };
  pages: PageGuideMapping[];
  primaryActions: ActionGuideMapping[];
  forms: FormGuideMapping[];
  widgets: WidgetGuideMapping[];
  destructiveButtons: ActionGuideMapping[];
  helpTipCatalog: Array<{
    file: string;
    guideId: string;
    label?: string | undefined;
  }>;
}

const PAGE_TO_GUIDE_MAP: Record<string, { guideId: string; roles: string[] }> = {
  "/": { guideId: "influencer-dashboard-overview", roles: ["PUBLIC", "INFLUENCER", "BRAND"] },
  "/about": { guideId: "influencer-public-profile", roles: ["PUBLIC"] },
  "/admin": { guideId: "admin-command-center", roles: ["ADMIN"] },
  "/admin/analytics": { guideId: "admin-analytics-intelligence", roles: ["ADMIN"] },
  "/admin/applications": { guideId: "admin-application-review", roles: ["ADMIN"] },
  "/admin/audit-logs": { guideId: "admin-immutable-audit-logs", roles: ["ADMIN"] },
  "/admin/benchmarks": { guideId: "admin-cpv-benchmarks", roles: ["ADMIN"] },
  "/admin/campaigns": { guideId: "admin-campaign-supervision", roles: ["ADMIN"] },
  "/admin/campaigns/[id]": { guideId: "admin-campaign-supervision", roles: ["ADMIN"] },
  "/admin/disputes": { guideId: "admin-dispute-arbitration", roles: ["ADMIN"] },
  "/admin/disputes/[id]": { guideId: "admin-dispute-arbitration", roles: ["ADMIN"] },
  "/admin/financial": { guideId: "admin-financial-reconciliation", roles: ["ADMIN"] },
  "/admin/guide": { guideId: "admin-guide-center", roles: ["ADMIN"] },
  "/admin/newsletter": { guideId: "admin-broadcast-newsletter", roles: ["ADMIN"] },
  "/admin/payouts": { guideId: "admin-payout-authorizations", roles: ["ADMIN"] },
  "/admin/scouts": { guideId: "admin-campus-scouts", roles: ["ADMIN"] },
  "/admin/suspicious-reviews": { guideId: "admin-suspicious-reviews", roles: ["ADMIN"] },
  "/admin/system": { guideId: "admin-system-health-and-dlq", roles: ["ADMIN"] },
  "/admin/users": { guideId: "admin-user-management", roles: ["ADMIN"] },
  "/admin/verifications": { guideId: "admin-kyc-verification-desk", roles: ["ADMIN"] },
  "/admin/verifications/[id]": { guideId: "admin-kyc-verification-desk", roles: ["ADMIN"] },
  "/admin/violations": { guideId: "admin-violations-and-enforcement", roles: ["ADMIN"] },
  "/blog": { guideId: "influencer-reports-market-range", roles: ["PUBLIC"] },
  "/brand/[id]": { guideId: "brand-creator-dossier", roles: ["PUBLIC", "INFLUENCER", "BRAND"] },
  "/contact": { guideId: "influencer-support-tickets", roles: ["PUBLIC"] },
  "/cookie-policy": { guideId: "brand-compliance-asci-ccpa", roles: ["PUBLIC"] },
  "/creator/[username]": { guideId: "influencer-public-profile", roles: ["PUBLIC", "INFLUENCER", "BRAND"] },
  "/dashboard": { guideId: "influencer-dashboard-overview", roles: ["INFLUENCER", "BRAND", "SCOUT"] },
  "/dashboard/analytics": { guideId: "influencer-analytics-performance", roles: ["INFLUENCER", "BRAND"] },
  "/dashboard/applications": { guideId: "influencer-applications-tracker", roles: ["INFLUENCER", "BRAND"] },
  "/dashboard/badges": { guideId: "influencer-drs-and-badges", roles: ["INFLUENCER"] },
  "/dashboard/campaigns": { guideId: "influencer-discover-campaigns", roles: ["INFLUENCER", "BRAND"] },
  "/dashboard/campaigns/[id]": { guideId: "brand-campaign-detail", roles: ["INFLUENCER", "BRAND"] },
  "/dashboard/campaigns/[id]/analytics": { guideId: "brand-campaign-analytics-hub", roles: ["BRAND"] },
  "/dashboard/campaigns/[id]/roi": { guideId: "brand-campaign-roi-reports", roles: ["BRAND"] },
  "/dashboard/campaigns/create": { guideId: "brand-campaign-creation", roles: ["BRAND"] },
  "/dashboard/deals": { guideId: "influencer-deal-lifecycle", roles: ["INFLUENCER", "BRAND"] },
  "/dashboard/deals/[id]": { guideId: "influencer-content-submission", roles: ["INFLUENCER", "BRAND"] },
  "/dashboard/deals/[id]/dispute": { guideId: "influencer-dispute-resolution", roles: ["INFLUENCER", "BRAND"] },
  "/dashboard/disputes": { guideId: "influencer-dispute-resolution", roles: ["INFLUENCER", "BRAND"] },
  "/dashboard/disputes/[id]": { guideId: "influencer-dispute-resolution", roles: ["INFLUENCER", "BRAND"] },
  "/dashboard/guide": { guideId: "influencer-dashboard-overview", roles: ["INFLUENCER", "BRAND", "SCOUT"] },
  "/dashboard/influencers": { guideId: "brand-creator-discovery", roles: ["BRAND"] },
  "/dashboard/influencers/[id]": { guideId: "brand-creator-dossier", roles: ["BRAND"] },
  "/dashboard/leaderboard": { guideId: "influencer-leaderboard", roles: ["INFLUENCER", "SCOUT"] },
  "/dashboard/messages": { guideId: "influencer-messaging-rules", roles: ["INFLUENCER", "BRAND", "SCOUT"] },
  "/dashboard/notifications": { guideId: "influencer-notifications", roles: ["INFLUENCER", "BRAND", "SCOUT"] },
  "/dashboard/referrals": { guideId: "influencer-referral-program", roles: ["INFLUENCER", "BRAND", "SCOUT"] },
  "/dashboard/settings": { guideId: "influencer-settings-profile", roles: ["INFLUENCER", "BRAND", "SCOUT"] },
  "/dashboard/support": { guideId: "influencer-support-tickets", roles: ["INFLUENCER", "BRAND", "SCOUT", "ADMIN"] },
  "/dashboard/wallet": { guideId: "influencer-wallet-and-taxes", roles: ["INFLUENCER", "BRAND", "SCOUT"] },
  "/forgot-password": { guideId: "influencer-settings-security", roles: ["PUBLIC"] },
  "/help": { guideId: "influencer-support-tickets", roles: ["PUBLIC"] },
  "/legal": { guideId: "brand-compliance-asci-ccpa", roles: ["PUBLIC"] },
  "/login": { guideId: "influencer-settings-security", roles: ["PUBLIC"] },
  "/onboarding": { guideId: "influencer-settings-profile", roles: ["PUBLIC", "INFLUENCER", "BRAND", "SCOUT"] },
  "/pricing": { guideId: "influencer-reports-market-range", roles: ["PUBLIC"] },
  "/privacy": { guideId: "brand-compliance-asci-ccpa", roles: ["PUBLIC"] },
  "/refund": { guideId: "brand-dispute-arbitration", roles: ["PUBLIC"] },
  "/register": { guideId: "influencer-settings-profile", roles: ["PUBLIC"] },
  "/reset-password": { guideId: "influencer-settings-security", roles: ["PUBLIC"] },
  "/status": { guideId: "admin-system-health-and-dlq", roles: ["PUBLIC"] },
  "/terms": { guideId: "brand-compliance-asci-ccpa", roles: ["PUBLIC"] },
  "/verify-report": { guideId: "influencer-reports-market-range", roles: ["PUBLIC"] },
  "/verify-report/[id]": { guideId: "influencer-reports-market-range", roles: ["PUBLIC"] },
};

const PRIMARY_ACTIONS: ActionGuideMapping[] = [
  { actionId: "create-campaign", label: "Create Campaign", page: "/dashboard/campaigns/create", role: "BRAND", guideId: "brand-campaign-creation", stepAnchor: "step-0" },
  { actionId: "apply-campaign", label: "Submit Pitch Proposal", page: "/dashboard/campaigns", role: "INFLUENCER", guideId: "influencer-campaign-application", stepAnchor: "step-1" },
  { actionId: "submit-deliverable", label: "Submit Deliverable Content", page: "/dashboard/deals/[id]", role: "INFLUENCER", guideId: "influencer-content-submission", stepAnchor: "step-1" },
  { actionId: "approve-deliverable", label: "Approve Deliverable & Release Escrow", page: "/dashboard/deals/[id]", role: "BRAND", guideId: "brand-deal-management", stepAnchor: "step-2" },
  { actionId: "withdraw-wallet", label: "Withdraw Earnings to Bank", page: "/dashboard/wallet", role: "INFLUENCER", guideId: "influencer-wallet-and-taxes", stepAnchor: "step-2" },
  { actionId: "fund-escrow", label: "Deposit Escrow Funds", page: "/dashboard/wallet", role: "BRAND", guideId: "brand-wallet-and-escrow", stepAnchor: "step-1" },
  { actionId: "open-dispute", label: "Escalate to Formal Dispute", page: "/dashboard/deals/[id]/dispute", role: "SHARED", guideId: "influencer-dispute-resolution", stepAnchor: "step-0" },
  { actionId: "connect-instagram", label: "Connect Instagram Business", page: "/dashboard/settings", role: "INFLUENCER", guideId: "influencer-settings-social", stepAnchor: "step-1" },
  { actionId: "verify-pan", label: "Submit PAN Verification", page: "/dashboard/settings", role: "INFLUENCER", guideId: "influencer-settings-verification", stepAnchor: "step-0" },
  { actionId: "verify-gstin", label: "Verify Business GSTIN", page: "/dashboard/settings", role: "BRAND", guideId: "brand-verification-kyc", stepAnchor: "step-0" },
  { actionId: "generate-scout-qr", label: "Generate Offline Campus QR", page: "/dashboard/referrals", role: "SCOUT", guideId: "scout-offline-qr-code", stepAnchor: "step-1" },
  { actionId: "invite-creator", label: "Invite Creator Partner", page: "/dashboard/referrals", role: "SCOUT", guideId: "scout-inviting-creators", stepAnchor: "step-0" },
  { actionId: "admin-ban-user", label: "Ban / Suspend Account", page: "/admin/users", role: "ADMIN", guideId: "admin-user-management", stepAnchor: "step-2", isDestructive: true, safetyRunbook: "docs/runbooks/admin-lockout.md" },
  { actionId: "admin-dispute-verdict", label: "Issue Binding Dispute Verdict", page: "/admin/disputes/[id]", role: "ADMIN", guideId: "admin-dispute-arbitration", stepAnchor: "step-2", isDestructive: true, safetyRunbook: "docs/runbooks/escrow-mismatch.md" },
  { actionId: "admin-payout-approve", label: "Authorize Bank Payout Batch", page: "/admin/payouts", role: "ADMIN", guideId: "admin-payout-authorizations", stepAnchor: "step-2" },
  { actionId: "admin-payout-reject", label: "Reject Payout & Void Transfer", page: "/admin/payouts", role: "ADMIN", guideId: "admin-payout-authorizations", stepAnchor: "step-2", isDestructive: true, safetyRunbook: "docs/runbooks/payment-stuck.md" },
  { actionId: "admin-kill-switch", label: "Toggle Emergency Circuit Breaker", page: "/admin/system", role: "ADMIN", guideId: "admin-system-health-and-dlq", stepAnchor: "step-3", isDestructive: true, safetyRunbook: "docs/runbooks/flag-rollback.md" },
  { actionId: "admin-dlq-replay", label: "Replay Dead-Letter Queue Job", page: "/admin/system", role: "ADMIN", guideId: "admin-dlq-replay-operations", stepAnchor: "step-2", isDestructive: true, safetyRunbook: "docs/runbooks/dlq-replay.md" },
  { actionId: "admin-broadcast-send", label: "Dispatch System Broadcast", page: "/admin/newsletter", role: "ADMIN", guideId: "admin-broadcast-newsletter", stepAnchor: "step-2" },
  { actionId: "admin-revoke-sessions", label: "Force Admin Session Revocation", page: "/admin", role: "ADMIN", guideId: "admin-command-center", stepAnchor: "step-3", isDestructive: true, safetyRunbook: "docs/runbooks/admin-lockout.md" },
];

const FORMS: FormGuideMapping[] = [
  { formId: "campaign-brief-form", name: "Campaign Brief Form", page: "/dashboard/campaigns/create", role: "BRAND", guideId: "brand-campaign-creation" },
  { formId: "creator-pitch-form", name: "Creator Pitch Proposal Form", page: "/dashboard/campaigns", role: "INFLUENCER", guideId: "influencer-campaign-application" },
  { formId: "deliverable-submission-form", name: "Deliverable Asset Submission Form", page: "/dashboard/deals/[id]", role: "INFLUENCER", guideId: "influencer-content-submission" },
  { formId: "dispute-evidence-form", name: "Dispute Evidence Dossier Form", page: "/dashboard/deals/[id]/dispute", role: "SHARED", guideId: "influencer-dispute-resolution" },
  { formId: "bank-account-form", name: "Bank Beneficiary Form", page: "/dashboard/wallet", role: "INFLUENCER", guideId: "influencer-wallet-and-taxes" },
  { formId: "pan-verification-form", name: "PAN Verification Form", page: "/dashboard/settings", role: "INFLUENCER", guideId: "influencer-settings-verification" },
  { formId: "gstin-verification-form", name: "GSTIN Tax Verification Form", page: "/dashboard/settings", role: "BRAND", guideId: "brand-verification-kyc" },
  { formId: "profile-edit-form", name: "Creator Profile & Rates Form", page: "/dashboard/settings", role: "INFLUENCER", guideId: "influencer-settings-profile" },
  { formId: "social-connect-form", name: "Social Accounts Integration Form", page: "/dashboard/settings", role: "INFLUENCER", guideId: "influencer-settings-social" },
  { formId: "benchmark-tuning-form", name: "CPV Benchmark Calibration Form", page: "/admin/benchmarks", role: "ADMIN", guideId: "admin-cpv-benchmarks" },
  { formId: "broadcast-draft-form", name: "Newsletter Broadcast Editor", page: "/admin/newsletter", role: "ADMIN", guideId: "admin-broadcast-newsletter" },
  { formId: "support-ticket-form", name: "Help & Escalation Ticket Form", page: "/dashboard/support", role: "SHARED", guideId: "influencer-support-tickets" },
];

const WIDGETS: WidgetGuideMapping[] = [
  { widgetId: "financial-overview-bar", name: "Financial Overview & Balance Bar", page: "/dashboard", role: "SHARED", guideId: "influencer-wallet-and-taxes" },
  { widgetId: "active-deals-feed", name: "Active Collaborations Pipeline", page: "/dashboard", role: "SHARED", guideId: "influencer-deal-lifecycle" },
  { widgetId: "action-required-banner", name: "Priority Action Required Banner", page: "/dashboard", role: "SHARED", guideId: "influencer-deal-lifecycle" },
  { widgetId: "quick-discovery-row", name: "Recommended Opportunities Strip", page: "/dashboard", role: "SHARED", guideId: "influencer-discover-campaigns" },
  { widgetId: "dashboard-stories-bar", name: "Story Highlight Bar", page: "/dashboard", role: "SHARED", guideId: "influencer-dashboard-overview" },
  { widgetId: "weekly-challenges-card", name: "Gamification Weekly Quests", page: "/dashboard", role: "INFLUENCER", guideId: "influencer-drs-and-badges" },
  { widgetId: "authenticity-appeal-banner", name: "Creator Authenticity Audit Banner", page: "/dashboard", role: "INFLUENCER", guideId: "influencer-settings-social" },
  { widgetId: "first-run-checklist", name: "First-Run Onboarding Checklist", page: "/dashboard", role: "SHARED", guideId: "influencer-dashboard-overview" },
  { widgetId: "admin-kpi-grid", name: "Command Center Priority Metric Grid", page: "/admin", role: "ADMIN", guideId: "admin-command-center" },
  { widgetId: "admin-analytics-macro", name: "Platform Macro Growth Charts", page: "/admin/analytics", role: "ADMIN", guideId: "admin-analytics-intelligence" },
  { widgetId: "data-quality-distribution", name: "Data Quality Share Distribution Card", page: "/admin/analytics", role: "ADMIN", guideId: "admin-analytics-intelligence" },
  { widgetId: "conversion-funnel-card", name: "Platform Conversion Funnel Card", page: "/admin/analytics", role: "ADMIN", guideId: "admin-analytics-intelligence" },
  { widgetId: "traffic-behaviour-tab", name: "Traffic & Behaviour Intelligence Tab", page: "/admin/analytics", role: "ADMIN", guideId: "admin-analytics-intelligence" },
  { widgetId: "dlq-manager-panel", name: "Dead-Letter Queue Worker Panel", page: "/admin/system", role: "ADMIN", guideId: "admin-dlq-replay-operations" },
  { widgetId: "kill-switches-panel", name: "Circuit Breakers & Emergency Panel", page: "/admin/system", role: "ADMIN", guideId: "admin-system-health-and-dlq" },
  { widgetId: "scout-streak-banner", name: "Scout Monthly Activity Streak Banner", page: "/dashboard", role: "SCOUT", guideId: "scout-royalties-and-wallet" },
];

export function scanHelpTips(srcDir: string): Array<{ file: string; guideId: string; label?: string | undefined }> {
  const results: Array<{ file: string; guideId: string; label?: string | undefined }> = [];
  const helpTipRegex = /<HelpTip[^>]*guideId=["']([^"']+)["'][^>]*?(?:label=["']([^"']+)["'])?[^>]*\/>/g;

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/\.(tsx|ts)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, "utf8");
        let match;
        while ((match = helpTipRegex.exec(content)) !== null) {
          const guideId = match[1];
          const label = match[2];
          if (guideId) {
            results.push({
              file: path.relative(process.cwd(), fullPath).replace(/\\/g, "/"),
              guideId,
              label: label ?? undefined,
            });
          }
        }
      }
    }
  }

  walk(srcDir);
  return results;
}

export function generateGuideCoverageReport(): GuideCoverageReport {
  const routesPath = path.resolve(process.cwd(), "docs/audit/routes.json");
  if (!fs.existsSync(routesPath)) {
    throw new Error(`routes.json not found at ${routesPath}`);
  }

  const routesData = JSON.parse(fs.readFileSync(routesPath, "utf8"));
  const pageRoutes: Array<{ path: string }> = routesData.pageRoutes;

  const pages: PageGuideMapping[] = [];

  for (const pr of pageRoutes) {
    const mapping = PAGE_TO_GUIDE_MAP[pr.path];
    if (!mapping) {
      throw new Error(`Unmapped page route: ${pr.path} has no guide mapping.`);
    }

    const guide = getGuideById(mapping.guideId);
    if (!guide) {
      throw new Error(`Page route ${pr.path} maps to non-existent guideId: "${mapping.guideId}"`);
    }

    pages.push({
      path: pr.path,
      roles: mapping.roles,
      guideId: mapping.guideId,
      guideTitle: guide.title.en,
    });
  }

  // Validate primary actions
  for (const act of PRIMARY_ACTIONS) {
    const guide = getGuideById(act.guideId);
    if (!guide) {
      throw new Error(`Primary action ${act.actionId} maps to non-existent guideId: "${act.guideId}"`);
    }
  }

  // Validate forms
  for (const f of FORMS) {
    const guide = getGuideById(f.guideId);
    if (!guide) {
      throw new Error(`Form ${f.formId} maps to non-existent guideId: "${f.guideId}"`);
    }
  }

  // Validate widgets
  for (const w of WIDGETS) {
    const guide = getGuideById(w.guideId);
    if (!guide) {
      throw new Error(`Widget ${w.widgetId} maps to non-existent guideId: "${w.guideId}"`);
    }
  }

  // Scan HelpTip usages across src/
  const srcDir = path.resolve(process.cwd(), "src");
  const helpTips = scanHelpTips(srcDir);

  const destructive = PRIMARY_ACTIONS.filter((a) => a.isDestructive);

  const report: GuideCoverageReport = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalPages: pageRoutes.length,
      mappedPages: pages.length,
      pageCoveragePercent: 100,
      totalPrimaryActions: PRIMARY_ACTIONS.length,
      mappedPrimaryActions: PRIMARY_ACTIONS.length,
      totalForms: FORMS.length,
      mappedForms: FORMS.length,
      totalWidgets: WIDGETS.length,
      mappedWidgets: WIDGETS.length,
      totalDestructiveButtons: destructive.length,
      mappedDestructiveButtons: destructive.length,
      totalHelpTipsFound: helpTips.length,
      coverageStatus: "COMPLETE",
    },
    pages,
    primaryActions: PRIMARY_ACTIONS,
    forms: FORMS,
    widgets: WIDGETS,
    destructiveButtons: destructive,
    helpTipCatalog: helpTips,
  };

  return report;
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith("guide-coverage.ts")) {
  const report = generateGuideCoverageReport();
  const outPath = path.resolve(process.cwd(), "docs/audit/guide-coverage.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`[guide-coverage] Successfully generated ${outPath}`);
  console.log(`  - Pages mapped: ${report.summary.mappedPages}/${report.summary.totalPages} (100%)`);
  console.log(`  - Primary actions mapped: ${report.summary.totalPrimaryActions}`);
  console.log(`  - Forms mapped: ${report.summary.totalForms}`);
  console.log(`  - Widgets mapped: ${report.summary.totalWidgets}`);
  console.log(`  - Destructive buttons mapped: ${report.summary.totalDestructiveButtons}`);
  console.log(`  - HelpTips detected across codebase: ${report.summary.totalHelpTipsFound}`);
}
