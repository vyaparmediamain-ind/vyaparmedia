import type { Guide } from "@/lib/guides/schema";

export const ADMIN_GUIDES: Guide[] = [
  {
    id: "admin-command-center",
    roles: ["ADMIN"],
    area: "admin",
    routes: ["/admin"],
    title: {
      en: "Platform Administration Command Center",
      hinglish: "Platform Administration Command Center",
    },
    summary: {
      en: "Real-time oversight of escrow health, pending identity verifications, dispute arbitrations, system alerts, and staff security.",
      hinglish: "Escrow health, pending identity verifications, disputes, system alerts aur staff security ka real-time control room.",
    },
    whenToUse: {
      en: "Use as your daily home base to assess platform liquidity, resolve pending review queues, and monitor critical operational health.",
      hinglish: "Rozana platform liquidity check karne, pending review queues clear karne aur system operational status monitor karne ke liye use karein.",
    },
    steps: [
      {
        title: {
          en: "Inspect System Health & Background Queue Depth",
          hinglish: "System Health aur Queue Depth Dekhein",
        },
        body: {
          en: "Review the top status cards showing active background QStash workers, dead-letter queues (DLQ), and Redis cache health.",
          hinglish: "Status cards se active workers, dead letter queues aur Redis cache ki health check karein.",
        },
        uiRef: "SystemHealthBar",
      },
      {
        title: {
          en: "Review Urgent Action Queues",
          hinglish: "Urgent Action Queues Check Karein",
        },
        body: {
          en: "Check pending KYC verifications, escalated deal disputes, and flagged suspicious reviews requiring staff intervention within SLA bounds.",
          hinglish: "Pending KYC, badhte huye disputes aur suspicious reviews ki queue check karein aur SLA ke mutabiq act karein.",
        },
        uiRef: "PendingQueuesList",
      },
      {
        title: {
          en: "Monitor Platform Escrow Liquidity",
          hinglish: "Platform Escrow Liquidity Monitor Karein",
        },
        body: {
          en: "Verify that all user escrow balances are 100% matched with nodal bank reserve accounts without ledger variance.",
          hinglish: "Check karein ki user escrow balances nodal bank account ke sath 100% reconcile hain bina kisi discrepancy ke.",
        },
        uiRef: "LiquidityMetricCard",
      },
      {
        title: {
          en: "Review Emergency Admin Lockout & Recovery Status",
          hinglish: "Emergency Admin Lockout aur Recovery Status Check Karein",
        },
        body: {
          en: "Verify active admin sessions and 2FA credential health. In event of admin account compromise or lockout, follow docs/runbooks/admin-lockout.md.",
          hinglish: "Admin sessions aur 2FA health dekhein. Account compromise ya lockout hone par docs/runbooks/admin-lockout.md follow karein.",
        },
        uiRef: "AdminSecurityCard",
      },
    ],
    rules: [
      {
        en: "Admin actions are permanently recorded in the immutable audit log with cryptographic signing.",
        hinglish: "Admin dwara kiye gaye sabhi actions tamper-evident audit log me permanently record hote hain.",
      },
      {
        en: "Super-admin authorization (2FA) is required for system configuration changes, financial manual adjustments, and user suspensions.",
        hinglish: "System settings, financial adjustments aur user suspensions ke liye mandatory 2FA security zaroori hai.",
      },
      {
        en: "[DESTRUCTIVE ACTION: Force Admin Session Revocation] What this does: Purges all active Redis session keys and authorization caches for staff members. Who is notified: Affected administrators receive immediate session termination prompts and security alerts. Can it be undone: NO. All staff must re-authenticate with credentials and TOTP 2FA.",
        hinglish: "[DESTRUCTIVE ACTION: Force Admin Session Revocation] What this does: Staff members ke sabhi active Redis sessions aur tokens turant terminate karta hai. Who is notified: Affected admins ko turant logout prompt aur security alert milta hai. Can it be undone: NAHI. Sabhi staff ko fresh credentials aur 2FA ke sath login karna hoga.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Escrow Balance", hinglish: "Escrow Balance" },
        description: {
          en: "Total liquidity currently held in active deal contracts awaiting milestone delivery.",
          hinglish: "Active deals me locked total funds jo deliverables complete hone par release honge.",
        },
      },
      {
        label: { en: "Active Disputes", hinglish: "Active Disputes" },
        description: {
          en: "Deals currently halted awaiting mediator evidence review and binding resolution.",
          hinglish: "Vo deals jin par brand ya creator ne dispute raise kiya hai aur admin review baki hai.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "403 Forbidden on admin action", hinglish: "Admin action par 403 Forbidden error" },
        cause: { en: "User lacks requireActiveAdmin status or active role has expired", hinglish: "Admin session expire ho gayi ya specific action ki permission nahi hai" },
        fix: { en: "Re-authenticate using TOTP 2FA or verify role assignment in staff directory", hinglish: "2FA se dobara login karein aur staff permissions verify karein" },
      },
    ],
    faqs: [
      {
        question: { en: "Where do I find the emergency kill-switch?", hinglish: "Emergency kill switch kahan milta hai?" },
        answer: {
          en: "Navigate to System Controls (/admin/system) to toggle feature flags or pause payment webhooks under disaster recovery protocols.",
          hinglish: "System Controls (/admin/system) me jakar aap feature flags ya webhooks ko emergency pause kar sakte hain.",
        },
      },
      {
        question: { en: "What runbook governs admin account lockout?", hinglish: "Admin lockout hone par kaunsa runbook follow karein?" },
        answer: {
          en: "Refer to docs/runbooks/admin-lockout.md for clearing Redis rate-limit keys and recovering TOTP seeds.",
          hinglish: "Redis rate limits clear karne aur TOTP seeds recover karne ke liye docs/runbooks/admin-lockout.md follow karein.",
        },
      },
    ],
    related: ["admin-system-health-and-dlq", "admin-financial-reconciliation", "admin-immutable-audit-logs"],
    supportCta: {
      label: { en: "System Status", hinglish: "System Status" },
      href: "/admin/system",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "admin-analytics-intelligence",
    roles: ["ADMIN"],
    area: "analytics",
    routes: ["/admin/analytics"],
    title: {
      en: "Platform Analytics & Macro Intelligence",
      hinglish: "Platform Analytics aur Macro Intelligence",
    },
    summary: {
      en: "Analyze GMV, platform fee revenues, creator churn rates, traffic behaviour, and data-quality share across India.",
      hinglish: "Gross merchandise value (GMV), platform fee revenue, creator churn, traffic behaviour aur data-quality share analyze karein.",
    },
    whenToUse: {
      en: "Use to evaluate monthly platform growth, regional influencer supply vs brand demand, fee margins, and funnel drop-offs.",
      hinglish: "Monthly growth, state-wise creator supply, brand demand, fee margins aur user funnels analyze karne ke liye use karein.",
    },
    steps: [
      {
        title: {
          en: "Inspect GMV & Platform Fee Yields",
          hinglish: "GMV aur Platform Fee Yields Dekhein",
        },
        body: {
          en: "Track Gross Merchandise Value alongside net platform take rate (standard {{fee.min}} - {{fee.brand_default}}).",
          hinglish: "Total deal volume (GMV) aur net fee margins (standard {{fee.min}} - {{fee.brand_default}}) track karein.",
        },
        uiRef: "GmvRevenueChart",
      },
      {
        title: {
          en: "Analyze Traffic & Behaviour Funnels",
          hinglish: "Traffic aur User Behaviour Funnels Analyze Karein",
        },
        body: {
          en: "Review the Traffic & Behaviour tab to monitor conversion rates from landing page visits to campaign pitch submissions and contract execution.",
          hinglish: "Traffic & Behaviour tab se visitor drop-offs, pitch conversion rates aur deal completion rates monitor karein.",
        },
        uiRef: "TrafficBehaviourTab",
      },
      {
        title: {
          en: "Audit Data Quality Share",
          hinglish: "Data Quality Share Audit Karein",
        },
        body: {
          en: "Examine metrics breakdown by confidence tag: VERIFIED (OAuth insights), ESTIMATED (statistical reach model), SELF_REPORTED, or UNAVAILABLE.",
          hinglish: "Data reliability tags dekhein: VERIFIED (Instagram OAuth), ESTIMATED (statistical models), SELF_REPORTED ya UNAVAILABLE.",
        },
        uiRef: "DataQualityBadge",
      },
      {
        title: {
          en: "Handle Telemetry Pipeline Anomalies",
          hinglish: "Telemetry Pipeline Anomalies Handle Karein",
        },
        body: {
          en: "If analytics tracking drops or event batches fail schema validation, execute procedures in docs/runbooks/telemetry-incident.md and review docs/meta-app-review.md.",
          hinglish: "Telemetry data drop hone par docs/runbooks/telemetry-incident.md runbook aur docs/meta-app-review.md guidelines follow karein.",
        },
        uiRef: "TelemetryHealthStatus",
      },
    ],
    rules: [
      {
        en: "Missing analytics data must explicitly display 'UNAVAILABLE' with quality flag, never fabricated placeholder metrics.",
        hinglish: "Data na hone par explicit 'UNAVAILABLE' flag show karein, kabhi fabricated ya fake numbers render na karein.",
      },
      {
        en: "Data retention window for high-resolution analytics events is strictly {{analytics.retention_days}}.",
        hinglish: "Detailed user event tracking logs platform par strictly {{analytics.retention_days}} tak retain hote hain.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Platform Take Rate", hinglish: "Platform Take Rate" },
        description: {
          en: "Effective percentage of GMV retained by the platform after escrow fee deductions (minimum {{fee.min}}).",
          hinglish: "Deals par platform dwara charge kiye gaye net fee margins (minimum {{fee.min}}).",
        },
      },
      {
        label: { en: "Verified Metrics Share", hinglish: "Verified Metrics Share" },
        description: {
          en: "Proportion of active creator accounts with live Graph API OAuth connections providing first-party telemetry.",
          hinglish: "Vo creators jinka Instagram business account direct API se connected hai.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Analytics charts showing zero data for current day", hinglish: "Current day analytics chart par zero show ho raha hai" },
        cause: { en: "Daily aggregation cron job delayed or timezone mismatch between UTC and Asia/Kolkata", hinglish: "Nightly aggregation job pending hai ya UTC to Asia/Kolkata timezone lag hai" },
        fix: { en: "Trigger manual aggregation job in System Controls or consult docs/runbooks/telemetry-incident.md", hinglish: "System Controls se manual aggregation run karein ya docs/runbooks/telemetry-incident.md follow karein" },
      },
    ],
    faqs: [
      {
        question: { en: "How can I export raw analytics for external BI?", hinglish: "External BI ke liye raw data kaise export karein?" },
        answer: {
          en: "Click the Export CSV button on any chart widget to download sanitized aggregates without PII.",
          hinglish: "Kisi bhi widget par Export CSV click karein taaki bina personal PII ke aggregated data download ho sake.",
        },
      },
      {
        question: { en: "What if Meta Graph API rate-limits our insights pipeline?", hinglish: "Agar Meta API rate limit ho jaye toh kya karein?" },
        answer: {
          en: "Follow docs/meta-app-review.md and docs/runbooks/instagram-reconnect-storm.md for quota backoff and permission maintenance.",
          hinglish: "Rate-limits aur token refresh ke liye docs/meta-app-review.md aur docs/runbooks/instagram-reconnect-storm.md dekhein.",
        },
      },
    ],
    related: ["admin-cpv-benchmarks", "admin-system-health-and-dlq", "admin-campaign-supervision"],
    supportCta: {
      label: { en: "Export Reports", hinglish: "Reports Export Karein" },
      href: "/admin/analytics",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "admin-application-review",
    roles: ["ADMIN"],
    area: "compliance",
    routes: ["/admin/applications"],
    title: {
      en: "Campaign Creator Application Moderation & Audit",
      hinglish: "Campaign Creator Application Moderation aur Audit",
    },
    summary: {
      en: "Audit creator pitches, proposed deliverables, brand terms, and detect bot applications or fraud rings.",
      hinglish: "Creator pitches, deliverables, pricing compliance audit karein aur fraud/bot applications detect karein.",
    },
    whenToUse: {
      en: "Use when reviewing flagged applications, investigating brand rejection complaints, or monitoring application fraud velocity.",
      hinglish: "Flagged applications check karne, fake pitches investigate karne ya high rejection complaints verify karne ke liye use karein.",
    },
    steps: [
      {
        title: {
          en: "Filter Applications by Fraud Risk Score",
          hinglish: "Fraud Risk Score se Filter Karein",
        },
        body: {
          en: "Sort pending applications by automated anomaly score (velocity check, IP subnet matching, new account age).",
          hinglish: "Applications ko automated risk score, IP clusters aur account age ke hisab se sort karein.",
        },
        uiRef: "ApplicationFilterBar",
      },
      {
        title: {
          en: "Inspect Deliverables & Quotation Compliance",
          hinglish: "Deliverables aur Pricing Check Karein",
        },
        body: {
          en: "Ensure proposed creator compensation aligns with CPV benchmark ranges and campaign budget boundaries.",
          hinglish: "Dekhein ki creator pricing CPV guidelines aur brand budget ke rules ke anusaar hai ya nahi.",
        },
        uiRef: "PitchDetailView",
      },
      {
        title: {
          en: "Audit Brand Approval Turnaround SLAs",
          hinglish: "Brand Approval Turnaround SLAs Check Karein",
        },
        body: {
          en: "Identify brands that leave creator pitches unreviewed beyond the standard review window of {{deals.review_hours}}.",
          hinglish: "Un brands ko flag karein jo pitches ko {{deals.review_hours}} tak review nahi karte.",
        },
        uiRef: "SlaTimerBadge",
      },
    ],
    rules: [
      {
        en: "Creators submitting identical copied pitch text across >10 campaigns in 1 hour are automatically flagged for spam.",
        hinglish: "Ek ghante me 10 se zyada campaigns me same copied pitch bhejne wale creators spam radar me aate hain.",
      },
      {
        en: "Staff cannot approve an application on behalf of a brand without explicit written brand consent on record.",
        hinglish: "Brand ki explicit permission ke bina staff kisi bhi application ko accept nahi kar sakta.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Application Acceptance Rate", hinglish: "Application Acceptance Rate" },
        description: {
          en: "Percentage of creator applications that convert into signed deal contracts.",
          hinglish: "Total applications me se vo percentage jo accepted deals me convert hui.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Creator complains their pitch disappeared", hinglish: "Creator bol raha hai ki pitch show nahi ho rahi" },
        cause: { en: "Campaign reached maximum applicant capacity or was paused by brand", hinglish: "Campaign ki applicant limit reach ho chuki thi ya brand ne campaign pause kiya" },
        fix: { en: "Check campaign audit log for status transitions from OPEN to FILLED or PAUSED", hinglish: "Campaign audit log me transitions verify karein aur creator ko inform karein" },
      },
    ],
    faqs: [
      {
        question: { en: "Can an admin reject an abusive application directly?", hinglish: "Kya admin kisi abusive pitch ko reject kar sakta hai?" },
        answer: {
          en: "Yes. Admins can reject any application that violates ASCI guidelines or community standards, citing reason codes.",
          hinglish: "Haan, community guidelines ya ASCI rules violate karne par admin pitch ko direct reject kar sakta hai.",
        },
      },
    ],
    related: ["admin-campaign-supervision", "admin-violations-and-enforcement"],
    supportCta: {
      label: { en: "Moderate Pitches", hinglish: "Pitches Moderate Karein" },
      href: "/admin/applications",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "admin-immutable-audit-logs",
    roles: ["ADMIN"],
    area: "security",
    routes: ["/admin/audit-logs"],
    title: {
      en: "Cryptographic Tamper-Evident Audit Logs",
      hinglish: "Cryptographic Tamper-Evident Audit Logs",
    },
    summary: {
      en: "Inspect cryptographic audit trails verifying every privileged staff action, balance mutation, and role upgrade.",
      hinglish: "Staff actions, balance mutations aur role changes ki cryptographic audit trails inspect karein.",
    },
    whenToUse: {
      en: "Use during security investigations, financial ledger audits, dispute post-mortems, or compliance verification.",
      hinglish: "Security investigations, financial audits ya dispute post-mortems ke waqt exact timeline verify karne ke liye use karein.",
    },
    steps: [
      {
        title: {
          en: "Filter Audit Stream by Actor, Entity, or Action",
          hinglish: "Actor, Entity ya Action se Filter Karein",
        },
        body: {
          en: "Search for specific admin emails, user IDs, deal IDs, or action types (e.g., USER_SUSPEND, ESCROW_RELEASE, ROLE_OVERRIDE).",
          hinglish: "Admin email, user ID, deal ID ya sensitive actions ke basis par records search karein.",
        },
        uiRef: "AuditLogFilter",
      },
      {
        title: {
          en: "Verify SHA-256 Hash Chain Integrity",
          hinglish: "SHA-256 Hash Chain Integrity Verify Karein",
        },
        body: {
          en: "Confirm that log sequence numbers and parent hashes are unbroken, proving records have not been altered or deleted.",
          hinglish: "Check karein ki cryptographic hash chain bilkul intact hai aur koi log delete ya modify nahi hua hai.",
        },
        uiRef: "HashIntegrityBadge",
      },
      {
        title: {
          en: "Export Immutable Audit Package for Compliance",
          hinglish: "Compliance ke liye Audit Report Export Karein",
        },
        body: {
          en: "Generate digitally signed JSON/CSV bundles for statutory tax audits, SOC2 verification, or legal proceedings.",
          hinglish: "Audits aur legal compliance ke liye digitally signed logs bundle export karein.",
        },
        uiRef: "ExportAuditBundleButton",
      },
    ],
    rules: [
      {
        en: "Audit log entries are append-only. Hard deletion or SQL updates of audit logs is programmatically blocked.",
        hinglish: "Audit log append-only hai. Inhe database se update ya delete karna technically impossible hai.",
      },
      {
        en: "No sensitive secrets (passwords, tokens, PAN, bank account numbers) may be recorded in cleartext within log payloads.",
        hinglish: "Passwords, API keys ya sensitive financial data ko logs me cleartext record karna mana hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Sequence Hash", hinglish: "Sequence Hash" },
        description: {
          en: "Cryptographic digest linking current entry to the preceding log record.",
          hinglish: "Cryptographic hash jo is record ko pichle record se link karke chain banata hai.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Audit log hash verification warning in console", hinglish: "Audit log hash warning console me dikh rahi hai" },
        cause: { en: "Manual database row insertion or clock skew between application nodes", hinglish: "Database me direct manual entry ya servers ke beech clock mismatch" },
        fix: { en: "Immediately alert security team and check docs/runbooks/telemetry-incident.md for forensic inspection", hinglish: "Turant security team ko notify karein aur forensics check karein" },
      },
    ],
    faqs: [
      {
        question: { en: "How long are audit records retained?", hinglish: "Audit logs kitne time tak store rehte hain?" },
        answer: {
          en: "All audit records are archived for 7 years to comply with Indian Companies Act and taxation statutes.",
          hinglish: "Indian statutory compliance ke mutabiq audit records 7 saal tak permanently store rehte hain.",
        },
      },
    ],
    related: ["admin-command-center", "admin-user-management", "admin-financial-reconciliation"],
    supportCta: {
      label: { en: "Inspect Logs", hinglish: "Logs Inspect Karein" },
      href: "/admin/audit-logs",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "admin-cpv-benchmarks",
    roles: ["ADMIN"],
    area: "admin",
    routes: ["/admin/benchmarks"],
    title: {
      en: "Cost-Per-View (CPV) Baselines & Pricing Calibration",
      hinglish: "Cost-Per-View (CPV) Baselines aur Pricing Calibration",
    },
    summary: {
      en: "Configure tier factors, reach-rate bands, add-on percentages, simulate creator valuations, and audit pricing curves.",
      hinglish: "CPV baselines, tier factors, reach bands, add-on % configure karein aur creator pricing curves simulate karein.",
    },
    whenToUse: {
      en: "Use when market rates shift, new deliverable types are introduced, or creator fair-market rate calculations need recalibration.",
      hinglish: "Jab market rates change ho, naye deliverables launch ho ya creator pricing bands adjust karne ho.",
    },
    steps: [
      {
        title: {
          en: "Adjust Base CPV Rates by Creator Tier",
          hinglish: "Tier-wise Base CPV Rates Adjust Karein",
        },
        body: {
          en: "Review baseline CPV in paise for Nano, Micro, Mid, and Macro tiers based on current market dynamics.",
          hinglish: "Nano, Micro, Mid aur Macro creators ke base CPV paise me calibrate karein.",
        },
        uiRef: "TierRateMatrix",
      },
      {
        title: {
          en: "Calibrate Deliverable Add-on Multipliers",
          hinglish: "Deliverable Add-on Multipliers Set Karein",
        },
        body: {
          en: "Set percentage add-ons for brand whitelisting, category exclusivity, raw footage handover, and 24-hour turnaround.",
          hinglish: "Exclusivity, whitelisting aur raw footage ke liye extra percentage add-ons configure karein.",
        },
        uiRef: "AddonPricingForm",
      },
      {
        title: {
          en: "Simulate a Creator Price Calculation",
          hinglish: "Creator Price Calculation Simulate Karein",
        },
        body: {
          en: "Use the live simulator to plug in sample follower counts, engagement rates, and format types to preview the resulting price range.",
          hinglish: "Followers aur engagement daal kar live simulator se price range preview karein.",
        },
        uiRef: "BenchmarkSimulator",
      },
    ],
    rules: [
      {
        en: "Price baseline adjustments require two-party confirmation: the proposing admin and a reviewing super-admin.",
        hinglish: "Baseline changes ke liye proposing admin aur super-admin dono ka approval mandatory hai.",
      },
      {
        en: "Benchmark adjustments immediately affect newly created offers; active deal contracts retain their signed values.",
        hinglish: "Naye rates sirf aage ki deals par apply hote hain; pehle se signed deals unke purane amount par hi rehti hain.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Base CPV", hinglish: "Base CPV" },
        description: {
          en: "Expected cost per median reel/video view in Indian paise (e.g., 25 paise = ₹0.25).",
          hinglish: "Per view expected cost paise me (jaise 25 paise = ₹0.25).",
        },
      },
      {
        label: { en: "Range Width", hinglish: "Range Width" },
        description: {
          en: "Spread between recommended minimum and maximum fair rate (typically ±20%).",
          hinglish: "Recommended minimum aur maximum fair rate ka difference (usually ±20%).",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Simulated creator rate is unrealistically high or low", hinglish: "Simulated rate bohot zyada ya bohot kam aa raha hai" },
        cause: { en: "Extreme engagement rate anomaly in creator profile distorting reach calculation", hinglish: "Follower count ya engagement percentage me abnormal input" },
        fix: { en: "Cap engagement multipliers at 15% ceiling in benchmark configuration", hinglish: "Engagement multipliers ko benchmark config me 15% par cap karein" },
      },
    ],
    faqs: [
      {
        question: { en: "How often should benchmarks be updated?", hinglish: "Benchmarks kitni baar update karne chahiye?" },
        answer: {
          en: "VyaparMedia pricing committee reviews CPV baselines on the 1st of every calendar quarter.",
          hinglish: "Quarterly review meeting me market trends ke according baselines update ki jaati hain.",
        },
      },
    ],
    related: ["admin-analytics-intelligence", "admin-campaign-supervision"],
    supportCta: {
      label: { en: "Edit Benchmarks", hinglish: "Benchmarks Edit Karein" },
      href: "/admin/benchmarks",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "admin-campaign-supervision",
    roles: ["ADMIN"],
    area: "campaigns",
    routes: ["/admin/campaigns", "/admin/campaigns/[id]"],
    title: {
      en: "Platform Campaign Supervision & Governance Reports",
      hinglish: "Platform Campaign Supervision aur Governance Reports",
    },
    summary: {
      en: "Oversee active campaigns, track revenue yield, monitor milestone SLA risks, detect off-platform leak attempts, and generate governance reports.",
      hinglish: "Active campaigns monitor karein, revenue yield track karein, milestone delays pakdein aur governance reports generate karein.",
    },
    whenToUse: {
      en: "Use to investigate delinquent campaigns, verify milestone deliverables on escalation, or generate brand governance audits.",
      hinglish: "Delay ho rahe campaigns check karne, contested deliverables verify karne ya brand audit reports nikalne ke liye use karein.",
    },
    steps: [
      {
        title: {
          en: "Monitor Campaign Milestone Delivery SLAs",
          hinglish: "Milestone Delivery SLAs Track Karein",
        },
        body: {
          en: "Filter active campaigns by milestone health to catch creators at risk of breaching submission deadlines.",
          hinglish: "Campaigns ko milestone status se filter karke deadline breach hone se pehle alerts check karein.",
        },
        uiRef: "CampaignSlaTracker",
      },
      {
        title: {
          en: "Inspect Campaign Revenue Strip & Platform Fees",
          hinglish: "Campaign Revenue aur Platform Fees Inspect Karein",
        },
        body: {
          en: "On /admin/campaigns/[id], view the financial summary strip displaying gross budget, allocated escrow, platform fees (min {{fee.min}}), and disbursed creator funds.",
          hinglish: "/admin/campaigns/[id] par gross budget, escrow balance, platform fees (min {{fee.min}}) aur payout disbursement status dekhein.",
        },
        uiRef: "CampaignRevenueStrip",
      },
      {
        title: {
          en: "Review Contact Leakage & Off-Platform Flags",
          hinglish: "Contact Leakage aur Off-Platform Flags Check Karein",
        },
        body: {
          en: "Inspect automatic regex flags where phone numbers, UPI IDs, or external emails were exchanged in campaign comments.",
          hinglish: "Chat logs me phone number, email ya UPI ID share karne par lage auto-flags inspect karein.",
        },
        uiRef: "LeakFlagBadge",
      },
      {
        title: {
          en: "Export Campaign Governance Audit Report",
          hinglish: "Campaign Governance Audit Report Export Karein",
        },
        body: {
          en: "Download the formal campaign governance PDF containing verified impression tallies, creator contracts, and financial settlements.",
          hinglish: "Official governance report download karein jisme verified metrics, contracts aur payment settlements shaamil hain.",
        },
        uiRef: "ExportGovernanceButton",
      },
    ],
    rules: [
      {
        en: "Admins can pause a campaign if the brand fails to respond to creator deliverable submissions within {{deals.review_hours}}.",
        hinglish: "Agar brand {{deals.review_hours}} tak deliverable par reply na kare toh admin campaign ko hold par daal sakta hai.",
      },
      {
        en: "Platform fee collected on campaigns adheres strictly to tier thresholds, with minimum take rate of {{fee.min}}.",
        hinglish: "Campaigns par collect hone wali fee minimum {{fee.min}} policy ke anusaar hi deduct hoti hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Escrow Locked", hinglish: "Escrow Locked" },
        description: {
          en: "Total brand money deposited in bank escrow awaiting deliverable completion for this campaign.",
          hinglish: "Is campaign ke liye bank escrow me locked funds jo abhi release nahi hue hain.",
        },
      },
      {
        label: { en: "SLA Risk Index", hinglish: "SLA Risk Index" },
        description: {
          en: "Algorithmic rating indicating likelihood of creator missing agreed publishing date.",
          hinglish: "Creator dwara deadline miss karne ke probability score ka indicator.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Campaign shows complete but escrow funds remaining", hinglish: "Campaign complete ho gaya par escrow me paise bache hain" },
        cause: { en: "Unused budget balance after creator slots were not fully filled", hinglish: "Unused campaign balance jo creator slots khali rehne ki wajah se release nahi hua" },
        fix: { en: "Trigger automated escrow refund of unallocated balance back to brand wallet", hinglish: "Unallocated funds ko brand wallet me refund karne ka action trigger karein" },
      },
    ],
    faqs: [
      {
        question: { en: "Can an admin force-cancel a fraudulent campaign?", hinglish: "Kya admin kisi fraud campaign ko cancel kar sakta hai?" },
        answer: {
          en: "Yes. Admins can terminate rogue campaigns, which freezes active deals and initiates audit review.",
          hinglish: "Haan, policy violation par admin campaign terminate kar sakta hai aur funds secure kar sakta hai.",
        },
      },
    ],
    related: ["admin-dispute-arbitration", "admin-financial-reconciliation"],
    supportCta: {
      label: { en: "Manage Campaigns", hinglish: "Campaigns Manage Karein" },
      href: "/admin/campaigns",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "admin-dispute-arbitration",
    roles: ["ADMIN"],
    area: "disputes",
    routes: ["/admin/disputes", "/admin/disputes/[id]"],
    title: {
      en: "Deal Dispute Arbitration & Escrow Division",
      hinglish: "Deal Dispute Arbitration aur Escrow Division",
    },
    summary: {
      en: "Mediate deal disputes, evaluate submitted deliverable evidence, issue binding escrow release/refund rulings, and enforce arbitration consequences.",
      hinglish: "Deal disputes mediate karein, deliverable evidence check karein, binding release/refund ruling de aur arbitration enforce karein.",
    },
    whenToUse: {
      en: "Use when brand or creator escalates an unresolvable conflict after revision limits or delivery deadline breaches.",
      hinglish: "Jab brand aur creator aapas me settle na kar paye aur deal formal dispute me escalate ho jaye.",
    },
    steps: [
      {
        title: {
          en: "Examine Dispute Docket & Evidence Dossier",
          hinglish: "Dispute Evidence aur Chat Logs Review Karein",
        },
        body: {
          en: "On /admin/disputes/[id], review uploaded content assets, screen recordings, chat message transcripts, and contracted brief terms.",
          hinglish: "/admin/disputes/[id] par upload kiya gaya content, chat history, revision count aur contract requirements match karein.",
        },
        uiRef: "DisputeEvidenceViewer",
      },
      {
        title: {
          en: "Apply Arbitration Guidelines & Responsibility Ratio",
          hinglish: "Arbitration Rules aur Fault Ratio Apply Karein",
        },
        body: {
          en: "Assess whether deliverable met objective brief criteria. Determine fair allocation: full release to creator, full refund to brand, or custom split.",
          hinglish: "Check karein ki kya briefs follow huye the. Pura payment creator ko, pura refund brand ko ya custom split select karein.",
        },
        uiRef: "SettlementSlider",
      },
      {
        title: {
          en: "Execute Binding Ruling & Escrow Settlement",
          hinglish: "Binding Settlement Execute Karein",
        },
        body: {
          en: "Record formal arbitration notes and execute settlement. If ledger discrepancies occur, consult docs/runbooks/escrow-mismatch.md.",
          hinglish: "Official ruling notes likhein aur transaction finalize karein. Variance aane par docs/runbooks/escrow-mismatch.md follow karein.",
        },
        uiRef: "ResolveDisputeButton",
      },
    ],
    rules: [
      {
        en: "[DESTRUCTIVE ACTION: Dispute Binding Verdict / Escrow Split] What this does: Irreversibly splits or releases locked escrow funds between brand and creator via atomic database transaction. Who is notified: Both brand and creator receive email and in-app verdict notifications with legal mediation notes. Can it be undone: NO. Escrow releases are permanent and binding under Indian Contract Act §10 arbitration terms.",
        hinglish: "[DESTRUCTIVE ACTION: Dispute Binding Verdict / Escrow Split] What this does: Atomic DB transaction ke through escrow funds ko brand aur creator ke beech permanently release ya refund karta hai. Who is notified: Brand aur creator dono ko formal verdict email aur in-app notification bheji jaati hai. Can it be undone: NAHI. Escrow settlement final aur legally binding hota hai, isse reverse nahi kiya ja sakta.",
      },
      {
        en: "Dispute verdicts directly impact the creator's Deal Reliability Score (DRS) and the brand's dispute history rating.",
        hinglish: "Ruling ke mutabiq creator ke DRS score aur brand ki platform reputation par direct impact padta hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Escrow Under Dispute", hinglish: "Escrow Under Dispute" },
        description: {
          en: "Total locked transaction amount currently frozen in nodal escrow pending administrative ruling.",
          hinglish: "Disputed deal ka total amount jo faisla aane tak platform escrow me locked hai.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Escrow split percentage total does not equal 100%", hinglish: "Split percentages ka total 100% nahi ban raha" },
        cause: { en: "Rounding precision in percentage slider leaving fractional paise unmatched", hinglish: "Slider precision me rounding issue jis se fractions of paise mismatch ho rahe hain" },
        fix: { en: "Use exact rupee inputs; system automatically assigns rounding difference to brand refund component", hinglish: "Exact rupee amount enter karein, system automatically paise balance tally karega" },
      },
    ],
    faqs: [
      {
        question: { en: "Can a user appeal an admin dispute verdict?", hinglish: "Kya user dispute ruling ke khilaaf appeal kar sakta hai?" },
        answer: {
          en: "Administrative rulings are final within the app. Legal remedies remain open in civil jurisdiction under Indian arbitration law.",
          hinglish: "Platform par ruling final hoti hai, par users legal jurisdiction ke under court me ja sakte hain.",
        },
      },
      {
        question: { en: "What if escrow balance does not match dispute amount?", hinglish: "Agar escrow balance dispute amount se match na kare toh?" },
        answer: {
          en: "Follow docs/runbooks/escrow-mismatch.md immediately to reconcile ledger entries with the nodal bank.",
          hinglish: "Turant docs/runbooks/escrow-mismatch.md follow karein aur bank ledger verify karein.",
        },
      },
    ],
    related: ["admin-financial-reconciliation", "admin-campaign-supervision"],
    supportCta: {
      label: { en: "Arbitrate Disputes", hinglish: "Disputes Settle Karein" },
      href: "/admin/disputes",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "admin-financial-reconciliation",
    roles: ["ADMIN"],
    area: "wallet",
    routes: ["/admin/financial"],
    title: {
      en: "Platform Financial Ledger & Escrow Reconciliation",
      hinglish: "Platform Financial Ledger aur Escrow Reconciliation",
    },
    summary: {
      en: "Audit double-entry bookkeeping, reconcile nodal bank accounts, track fee margins, verify statutory tax reports, and ensure ledger integrity.",
      hinglish: "Double-entry ledger audit karein, nodal bank reconcile karein, fee margins track karein aur statutory tax reports verify karein.",
    },
    whenToUse: {
      en: "Use for daily treasury balancing, monthly closing, quarterly CA financial reports, and investigating payment gateway mismatches.",
      hinglish: "Daily nodal balance milane, monthly closing, CA reports download karne aur gateway errors check karne ke liye use karein.",
    },
    steps: [
      {
        title: {
          en: "Verify Daily Nodal Escrow Reconciliation",
          hinglish: "Daily Nodal Escrow Reconciliation Verify Karein",
        },
        body: {
          en: "Compare total platform user liability against nodal bank statement balance. Any variance must trigger docs/runbooks/escrow-mismatch.md.",
          hinglish: "Platform user liability ko nodal bank statement ke sath verify karein. Difference aane par docs/runbooks/escrow-mismatch.md follow karein.",
        },
        uiRef: "NodalReconciliationCard",
      },
      {
        title: {
          en: "Inspect Fee Margins & Treasury Yield",
          hinglish: "Fee Margins aur Treasury Yield Dekhein",
        },
        body: {
          en: "Review net platform fee income (minimum {{fee.min}}, default {{fee.brand_default}}) deducted at deal escrow release.",
          hinglish: "Escrow release ke waqt deduct huyi platform fees (minimum {{fee.min}}, default {{fee.brand_default}}) check karein.",
        },
        uiRef: "TreasuryIncomeSummary",
      },
      {
        title: {
          en: "Generate Statutory TDS & GST Tax Bundles",
          hinglish: "TDS aur GST Tax Reports Generate Karein",
        },
        body: {
          en: "Export Form 26Q Section 194-O ({{tax.tds_194o}}) schedules and Section 206AA ({{tax.tds_206aa}}) deduction logs for chartered accountants.",
          hinglish: "CA ke liye Section 194-O ({{tax.tds_194o}}) aur Section 206AA ({{tax.tds_206aa}}) ke quarterly tax bundles generate karein.",
        },
        uiRef: "TaxReportExportButton",
      },
      {
        title: {
          en: "Investigate Stuck Payment Gateway Transfers",
          hinglish: "Stuck Payment Gateway Transfers Investigate Karein",
        },
        body: {
          en: "For webhooks dropped by Razorpay or Cashfree, review pending deposits and follow docs/runbooks/payment-stuck.md.",
          hinglish: "Dropped webhooks ya stuck payments ke liye docs/runbooks/payment-stuck.md ke mutabiq verify karein.",
        },
        uiRef: "StuckPaymentsMonitor",
      },
    ],
    rules: [
      {
        en: "VyaparMedia operates an exact double-entry ledger in integer paise. Floating-point arithmetic on currency is strictly forbidden.",
        hinglish: "Sabhi financial records integer paise me double-entry format me hote hain. Float calculations strictly prohibited hain.",
      },
      {
        en: "Platform fees (min {{fee.min}}) and TDS deductions are booked atomically at the millisecond of deal settlement.",
        hinglish: "Platform fee aur TDS deduction deal settlement ke millisecond par atomically record hoti hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Nodal Variance", hinglish: "Nodal Variance" },
        description: {
          en: "Difference between internal database escrow liability and external nodal bank account balance (must always be zero).",
          hinglish: "Database escrow balance aur nodal bank balance ka difference (hamesha ₹0 hona chahiye).",
        },
      },
      {
        label: { en: "TDS 194-O Accrual", hinglish: "TDS 194-O Accrual" },
        description: {
          en: "Cumulative TDS deducted at {{tax.tds_194o}} from creator payouts for government remittance.",
          hinglish: "Creators ke payouts se {{tax.tds_194o}} par deduct kiya gaya TDS jo sarkari treasury me jama hoga.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Ledger imbalance alert: debits do not match credits", hinglish: "Ledger imbalance alert: debits aur credits match nahi kar rahe" },
        cause: { en: "Interrupted multi-wallet batch transfer or database deadlock during concurrent payouts", hinglish: "Concurrent payouts ke waqt transaction deadlock ya network timeout" },
        fix: { en: "Execute reconciliation script in docs/runbooks/escrow-mismatch.md to identify unmatched journal entry", hinglish: "docs/runbooks/escrow-mismatch.md follow karke audit journal balance karein" },
      },
    ],
    faqs: [
      {
        question: { en: "What runbook governs stuck payment gateway orders?", hinglish: "Stuck payment orders ke liye kaunsa runbook use karein?" },
        answer: {
          en: "Refer to docs/runbooks/payment-stuck.md for verifying gateway reference IDs and manual state capture.",
          hinglish: "Gateway transactions reconcile karne ke liye docs/runbooks/payment-stuck.md follow karein.",
        },
      },
    ],
    related: ["admin-payout-authorizations", "admin-command-center"],
    supportCta: {
      label: { en: "Financial Reports", hinglish: "Financial Reports" },
      href: "/admin/financial",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "admin-broadcast-newsletter",
    roles: ["ADMIN"],
    area: "admin",
    routes: ["/admin/newsletter"],
    title: {
      en: "Platform Broadcasts & Newsletter Dispatch",
      hinglish: "Platform Broadcasts aur Newsletter Dispatch",
    },
    summary: {
      en: "Author announcements, filter recipient cohorts, dispatch bulk system emails and push notifications, and monitor delivery telemetry.",
      hinglish: "Platform updates draft karein, target audiences select karein, bulk broadcasts send karein aur delivery metrics dekhein.",
    },
    whenToUse: {
      en: "Use to communicate policy revisions, platform fee updates, festival campaigns, maintenance windows, or regulatory tax advisories.",
      hinglish: "Policy changes, platform updates, festival campaigns ya maintenance alerts sabhi users tak pahunchane ke liye use karein.",
    },
    steps: [
      {
        title: {
          en: "Select Target User Cohorts",
          hinglish: "Target User Cohort Select Karein",
        },
        body: {
          en: "Segment recipients by role (INFLUENCER, BRAND, SCOUT), KYC verification status, or tier (Nano, Micro, Mid, Macro).",
          hinglish: "Audience select karein: role ke according, KYC verified status ya creator tier ke basis par.",
        },
        uiRef: "CohortSelector",
      },
      {
        title: {
          en: "Draft Bilingual Content & Test Dispatch",
          hinglish: "Bilingual Message Likhein aur Test Karein",
        },
        body: {
          en: "Compose message in English and Hinglish. Send test dispatch to admin staff before triggering mass queue.",
          hinglish: "English aur Hinglish dono me draft karein aur bulk dispatch se pehle test email bhej kar verify karein.",
        },
        uiRef: "NewsletterEditor",
      },
      {
        title: {
          en: "Queue Bulk Dispatch & Monitor Delivery Health",
          hinglish: "Queue Bulk Dispatch aur Health Monitor Karein",
        },
        body: {
          en: "Trigger background delivery via QStash. Monitor bounce rates and unsubscribe requests in real time.",
          hinglish: "Background queue me dispatch karein aur bounce rate ya delivery rate track karein.",
        },
        uiRef: "DispatchProgressBar",
      },
    ],
    rules: [
      {
        en: "Promotional broadcasts must include mandatory unsubscribe link in compliance with CCPA and Indian telecommunication guidelines.",
        hinglish: "Promotional emails me mandatory unsubscribe link hona legal guidelines ke anusaar zaroori hai.",
      },
      {
        en: "Broadcast sending rate is throttled at 500 emails/minute to protect platform domain reputation.",
        hinglish: "Domain reputation bachaane ke liye email dispatch rate 500 emails/min par throttle hota hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Open Rate", hinglish: "Open Rate" },
        description: {
          en: "Percentage of delivered broadcast emails successfully opened by recipients.",
          hinglish: "Bheji gayi emails me se kitne percent users ne open kiya.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "High bounce rate alert (>3%) on email batch", hinglish: "Email batch par high bounce rate alert" },
        cause: { en: "Outdated unverified email addresses in inactive user accounts", hinglish: "Inactive ya invalid email accounts par message deliver hona" },
        fix: { en: "Filter cohort to only include users active within the last 90 days", hinglish: "Audience ko last 90 days me active users tak filter karein" },
      },
    ],
    faqs: [
      {
        question: { en: "Can I broadcast push notifications without email?", hinglish: "Kya bina email ke sirf push notification bhej sakte hain?" },
        answer: {
          en: "Yes, select 'Push Notification Only' channel mode in the dispatch settings.",
          hinglish: "Haan, dispatch options me 'Push Notification Only' choose kar sakte hain.",
        },
      },
    ],
    related: ["admin-user-management", "admin-command-center"],
    supportCta: {
      label: { en: "Send Broadcast", hinglish: "Broadcast Bhejein" },
      href: "/admin/newsletter",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "admin-payout-authorizations",
    roles: ["ADMIN"],
    area: "wallet",
    routes: ["/admin/payouts", "/admin/payouts/[id]"],
    title: {
      en: "Batch Payout Authorization & Bank Approvals",
      hinglish: "Batch Payout Authorization aur Bank Approvals",
    },
    summary: {
      en: "Review daily creator withdrawal requests, verify risk badges, approve banking batches, and investigate stuck or rejected transfers.",
      hinglish: "Creators ke daily withdrawal requests review karein, risk flags check karein, bank transfers approve karein aur stuck payouts resolve karein.",
    },
    whenToUse: {
      en: "Use during the daily payout processing window to authorize creator earnings withdrawals above the minimum {{wallet.min_withdrawal}} threshold.",
      hinglish: "Daily payout processing time par withdrawals approve karne aur bank batches release karne ke liye use karein.",
    },
    steps: [
      {
        title: {
          en: "Review Payout Risk Badges & Velocity Flags",
          hinglish: "Risk Badges aur Velocity Flags Review Karein",
        },
        body: {
          en: "Check risk badges on each request: High Velocity, Recently Changed Bank Details, or Name Mismatch against verified PAN.",
          hinglish: "Har withdrawal par risk flags check karein: recent bank change, sudden high amount ya PAN name mismatch.",
        },
        uiRef: "PayoutRiskBadgeList",
      },
      {
        title: {
          en: "Verify Bank Account Penny-Drop & IFSC Verification",
          hinglish: "Penny-Drop aur Bank Verification Status Check Karein",
        },
        body: {
          en: "Confirm that destination account has passed penny-drop validation with matching account holder name.",
          hinglish: "Confirm karein ki bank account penny-drop test pass kar chuka hai aur name match valid hai.",
        },
        uiRef: "BankVerificationStatus",
      },
      {
        title: {
          en: "Authorize Batch Transfer via Banking Partner API",
          hinglish: "Banking API ke through Batch Transfer Approve Karein",
        },
        body: {
          en: "Submit authorized batch with mandatory 2FA. For delayed transfers, investigate using docs/runbooks/payment-stuck.md.",
          hinglish: "2FA enter karke batch bank ko submit karein. Stuck payments ke liye docs/runbooks/payment-stuck.md follow karein.",
        },
        uiRef: "AuthorizeBatchButton",
      },
    ],
    rules: [
      {
        en: "[DESTRUCTIVE ACTION: Payout Rejection / Fund Clawback] What this does: Cancels pending bank wire transfer, releases transaction lock, and returns funds to user wallet balance with audit annotation. Who is notified: The creator is notified via email with the exact rejection reason and KYC/bank remediations. Can it be undone: NO. Once rejected, the payout request is voided; the creator must initiate a new payout request after fixing bank details.",
        hinglish: "[DESTRUCTIVE ACTION: Payout Rejection / Fund Clawback] What this does: Bank transfer request cancel karke funds ko creator ke wallet balance me return karta hai audit log ke sath. Who is notified: Creator ko rejection reason aur bank corrections ke sath formal notification milta hai. Can it be undone: NAHI. Payout cancel hone ke baad creator ko correct details daal kar fresh withdrawal request karni hogi.",
      },
      {
        en: "Minimum withdrawal threshold is strictly {{wallet.min_withdrawal}}; requests below this amount are rejected at API gateway.",
        hinglish: "Minimum withdrawal limit strictly {{wallet.min_withdrawal}} hai; is se kam ke requests system allow nahi karta.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Pending Payout Volume", hinglish: "Pending Payout Volume" },
        description: {
          en: "Total INR sum of creator withdrawal requests awaiting admin sign-off.",
          hinglish: "Approval ka wait kar rahe sabhi withdrawals ka total rupee amount.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Bank transfer returns 'Beneficiary Bank Offline' error", hinglish: "Bank transfer par 'Beneficiary Bank Offline' error" },
        cause: { en: "Recipient bank NEFT/IMPS switch is temporarily down for maintenance", hinglish: "Creator ke bank ka server ya IMPS network temporary maintenance par hai" },
        fix: { en: "Do not reject; system retries up to 3 times before placing into manual review", hinglish: "Reject na karein; system retry karega ya manual review queue me dalega" },
      },
    ],
    faqs: [
      {
        question: { en: "What runbook governs stuck bank payouts?", hinglish: "Bank payout atka ho toh kaunsa runbook use karein?" },
        answer: {
          en: "Consult docs/runbooks/payment-stuck.md for step-by-step resolution of pending UTR numbers and gateway states.",
          hinglish: "Pending UTR aur stuck gateway transactions ke liye docs/runbooks/payment-stuck.md check karein.",
        },
      },
    ],
    related: ["admin-financial-reconciliation", "admin-kyc-verification-desk"],
    supportCta: {
      label: { en: "Review Payouts", hinglish: "Payouts Review Karein" },
      href: "/admin/payouts",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "admin-campus-scouts",
    roles: ["ADMIN"],
    area: "scout",
    routes: ["/admin/scouts", "/admin/scouts/[id]"],
    title: {
      en: "Campus Scout Partner Network Administration",
      hinglish: "Campus Scout Partner Network Administration",
    },
    summary: {
      en: "Oversee campus student ambassadors, verify college ID proofs, audit multi-tier affiliate trees, and monitor 5% royalty disbursements.",
      hinglish: "College campus scouts manage karein, student IDs verify karein, referral network audit karein aur 5% royalties monitor karein.",
    },
    whenToUse: {
      en: "Use to approve incoming student scout applications, investigate circular self-referral rings, or issue campus certificates.",
      hinglish: "Naye scout applications approve karne, self-referral fraud check karne ya graduation certificates issue karne ke liye use karein.",
    },
    steps: [
      {
        title: {
          en: "Verify College Enrollment & Student Identity",
          hinglish: "College ID aur Enrollment Verify Karein",
        },
        body: {
          en: "On /admin/scouts/[id], verify scanned college ID card, current academic year, and university accreditation status.",
          hinglish: "/admin/scouts/[id] par student ka college identity card, current year aur institution check karein.",
        },
        uiRef: "ScoutIdVerificationCard",
      },
      {
        title: {
          en: "Audit Affiliate Referral Tree & Circularity Detection",
          hinglish: "Referral Network aur Fake Accounts Audit Karein",
        },
        body: {
          en: "Inspect creators onboarded by the scout. Verify device fingerprint and IP separation to prevent self-referral fraud.",
          hinglish: "Scout dwara invite kiye gaye creators ka IP aur device match karein taaki duplicate account fraud pakda ja sake.",
        },
        uiRef: "ReferralTreeView",
      },
      {
        title: {
          en: "Monitor 5% Lifetime Royalty Accruals",
          hinglish: "5% Lifetime Royalties Monitor Karein",
        },
        body: {
          en: "Verify that 5% commissions are correctly credited to scout wallets upon successful deal completion.",
          hinglish: "Check karein ki deals complete hone par scouts ko 5% commission sahi calculate hokar wallet me gaya hai.",
        },
        uiRef: "RoyaltyEarningsTable",
      },
    ],
    rules: [
      {
        en: "Scouts detected creating dummy creator profiles from the same device face immediate termination and royalty forfeiture.",
        hinglish: "Fake creator accounts banane wale scouts ka account turant terminate aur unpaid royalties cancel ho jaati hain.",
      },
      {
        en: "Official VyaparMedia Campus Ambassador Certificate requires minimum 5 active creator deals delivered.",
        hinglish: "Campus certificate paane ke liye scout ke referred creators dwara minimum 5 successful deals zaroori hain.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Active Campus Network", hinglish: "Active Campus Network" },
        description: {
          en: "Total verified college ambassadors actively onboarding regional creators.",
          hinglish: "Platform par active college student scouts ki total sankhya.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Scout royalty credited twice for same deal", hinglish: "Ek hi deal par scout ko do baar commission gaya" },
        cause: { en: "Non-idempotent webhook retry in legacy referral service", hinglish: "Referral engine me webhook retry ke waqt idempotency key miss hona" },
        fix: { en: "Deduplicate in financial ledger; current version uses strict transaction UUID locks", hinglish: "Ledger me duplicate credit adjust karein; system strict locks enforce karta hai" },
      },
    ],
    faqs: [
      {
        question: { en: "Can a student scout transition to full creator or brand role?", hinglish: "Kya student scout creator ya brand me convert ho sakta hai?" },
        answer: {
          en: "Yes, users can hold multiple sub-profiles under single KYC credentials; see /dashboard/settings.",
          hinglish: "Haan, single login se users scout aur creator dono roles use kar sakte hain.",
        },
      },
    ],
    related: ["admin-user-management", "admin-financial-reconciliation"],
    supportCta: {
      label: { en: "Manage Scouts", hinglish: "Scouts Manage Karein" },
      href: "/admin/scouts",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "admin-suspicious-reviews",
    roles: ["ADMIN"],
    area: "compliance",
    routes: ["/admin/suspicious-reviews"],
    title: {
      en: "Review Collusion & Rating Manipulation Radar",
      hinglish: "Review Collusion aur Rating Manipulation Radar",
    },
    summary: {
      en: "Detect coordinated rating rings, reciprocal 5-star swaps, review extortion, and fraudulent DRS score inflation.",
      hinglish: "Coordinated fake reviews, reciprocal 5-star swaps, review blackmail aur fake rating inflation detect karein.",
    },
    whenToUse: {
      en: "Use to investigate anomalous rating spikes, brand retaliation reports, or flagged creator review clusters.",
      hinglish: "Jab kisi brand ya creator ke ratings me abnormal jump aaye ya retaliation review ki complaint mile.",
    },
    steps: [
      {
        title: {
          en: "Analyze Collusion Clustering Radar",
          hinglish: "Collusion Clustering Radar Analyze Karein",
        },
        body: {
          en: "Review pairs of brands and creators with reciprocal 5-star reviews on deals with minimal deliverable substance.",
          hinglish: "Check karein ki kya kisi brand aur creator ne aapas me fake transactions karke ratings badhayi hain.",
        },
        uiRef: "CollusionRadarGraph",
      },
      {
        title: {
          en: "Inspect Review Text & Sentiment Anomalies",
          hinglish: "Review Text aur Sentiment Anomalies Dekhein",
        },
        body: {
          en: "Flag automated AI-generated positive reviews or negative reviews containing prohibited extortion language.",
          hinglish: "AI generated fake feedback ya blackmail wale negative reviews ko review queue me inspect karein.",
        },
        uiRef: "ReviewInspectionPanel",
      },
      {
        title: {
          en: "Enforce Score Adjustment or Review Expungement",
          hinglish: "Rating Adjustment ya Review Delete Karein",
        },
        body: {
          en: "Expunge fraudulent reviews from public profiles and recalculate the affected user's Deal Reliability Score (DRS).",
          hinglish: "Fake reviews ko remove karein aur creator ya brand ke DRS score ko automatically recalculate karein.",
        },
        uiRef: "ExpungeReviewButton",
      },
    ],
    rules: [
      {
        en: "Deleting a review permanently recalculates the user's DRS score and records an immutable entry in the audit log.",
        hinglish: "Review delete karne par user ka score automatically recalculate hota hai aur audit log me save hota hai.",
      },
      {
        en: "Users found exchanging money outside the platform for 5-star ratings receive a 30-day suspension and public warning badge.",
        hinglish: "Paid review collusion me pakde gaye accounts ko 30 din ke liye suspend kiya jata hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Suspicion Index", hinglish: "Suspicion Index" },
        description: {
          en: "Algorithmic probability that a review was written under coercive, reciprocal, or fake terms.",
          hinglish: "Probability score jo batata hai ki review fake ya manipulated hone ke kitne chances hain.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Expunged review still visible on creator public page", hinglish: "Delete kiya hua review abhi bhi profile par dikh raha hai" },
        cause: { en: "Edge CDN cache or Redis profile cache not yet invalidated", hinglish: "CDN ya Redis cache me purana page store hai jo invalidate nahi hua" },
        fix: { en: "Purge profile cache key via System Controls or wait for 5-minute TTL expiry", hinglish: "System Controls se profile cache purge karein ya 5 min wait karein" },
      },
    ],
    faqs: [
      {
        question: { en: "Can a brand demand deletion of an honest negative review?", hinglish: "Kya brand genuine negative review delete karwa sakta hai?" },
        answer: {
          en: "No. Honest factual reviews describing genuine contract performance cannot be deleted simply because a party dislikes them.",
          hinglish: "Nahi, contract ke mutabiq sachhe reviews ko sirf brand ke bolne par delete nahi kiya jata.",
        },
      },
    ],
    related: ["admin-violations-and-enforcement", "admin-immutable-audit-logs"],
    supportCta: {
      label: { en: "Inspect Reviews", hinglish: "Reviews Inspect Karein" },
      href: "/admin/suspicious-reviews",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "admin-system-health-and-dlq",
    roles: ["ADMIN"],
    area: "system",
    routes: ["/admin/system"],
    title: {
      en: "System Health, Circuit Breakers & Incident Controls",
      hinglish: "System Health, Circuit Breakers aur Incident Controls",
    },
    summary: {
      en: "Monitor background cron heartbeats, Redis memory, feature flag toggles, report config completeness, Meta Graph sync, and emergency kill switches.",
      hinglish: "Background crons, Redis memory, feature flags console, report config status, Meta sync aur emergency kill switches monitor karein.",
    },
    whenToUse: {
      en: "Use during incident response, system maintenance windows, feature rollouts, or operational pipeline disruptions.",
      hinglish: "Incident response ke waqt, system maintenance me, feature release ke time ya pipeline delay hone par use karein.",
    },
    steps: [
      {
        title: {
          en: "Check Background Cron Heartbeats & Worker Concurrency",
          hinglish: "Background Crons aur Worker Status Dekhein",
        },
        body: {
          en: "Verify that daily aggregation, payout batching, and Instagram sync workers have checked in within their expected heartbeat intervals.",
          hinglish: "Daily aggregation, payouts aur Instagram sync jobs ke heartbeats verify karein.",
        },
        uiRef: "CronHeartbeatGrid",
      },
      {
        title: {
          en: "Manage Feature Flags & Rollback Protocols",
          hinglish: "Feature Flags aur Rollback Protocols Manage Karein",
        },
        body: {
          en: "Toggle platform capabilities globally or per role. In case of unexpected regression, execute docs/runbooks/flag-rollback.md.",
          hinglish: "Platform features toggle karein. Koi issue aane par docs/runbooks/flag-rollback.md runbook ke mutabiq rollback karein.",
        },
        uiRef: "FeatureFlagsConsole",
      },
      {
        title: {
          en: "Monitor Instagram Graph API Coverage & Sync Health",
          hinglish: "Instagram Graph API Coverage aur Sync Health Check Karein",
        },
        body: {
          en: "Inspect percentage of active creators with valid OAuth tokens. In event of bulk token expiry, follow docs/runbooks/instagram-reconnect-storm.md and docs/meta-app-review.md.",
          hinglish: "Active OAuth connections track karein. Bulk token expiry hone par docs/runbooks/instagram-reconnect-storm.md aur docs/meta-app-review.md follow karein.",
        },
        uiRef: "InstagramSyncCoverage",
      },
      {
        title: {
          en: "Engage Emergency Kill Switches If Necessary",
          hinglish: "Emergency Kill Switches Check Karein",
        },
        body: {
          en: "Instantly halt payment gateway webhooks, withdrawals, or registration APIs across all server instances during critical incidents.",
          hinglish: "Critical incidents ke time payment webhooks ya withdrawals ko globally suspend karne ke controls inspect karein.",
        },
        uiRef: "KillSwitchesPanel",
      },
    ],
    rules: [
      {
        en: "[DESTRUCTIVE ACTION: Emergency Kill Switches & Feature Flag Toggles] What this does: Globally halts specific platform subsystems (e.g., payment webhooks, payout processing, or OAuth sync) within 500ms across all worker instances. Who is notified: Engineering on-call team and CTO via PagerDuty incident alert; all staff via broadcast channel. Can it be undone: Yes, flags can be toggled back on once the underlying operational incident is mitigated.",
        hinglish: "[DESTRUCTIVE ACTION: Emergency Kill Switches & Feature Flag Toggles] What this does: Platform ke specific modules (jaise payment webhooks ya payouts) ko sabhi server instances par 500ms ke andar turant suspend karta hai. Who is notified: On-call engineering team aur CTO ko PagerDuty alert milta hai. Can it be undone: Haan, incident resolve hone par switch ko dobara on kiya ja sakta hai.",
      },
      {
        en: "[DESTRUCTIVE ACTION: Invalidate Admin Cache & Force Session Revocation] What this does: Purges all active Redis session keys and authorization caches for specified user or globally across all staff. Who is notified: Affected users receive session expiry prompts; security team receives token revocation log. Can it be undone: NO. All invalidated users must re-authenticate with credentials and TOTP 2FA.",
        hinglish: "[DESTRUCTIVE ACTION: Invalidate Admin Cache & Force Session Revocation] What this does: Redis session keys aur permissions cache ko flush karke sabhi active logins ko turant expire karta hai. Who is notified: Users ko session expired ka alert aata hai; security team ko revocation report milti hai. Can it be undone: NAHI. Sabhi users ko 2FA se fresh login karna padega.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Heartbeat Lag", hinglish: "Heartbeat Lag" },
        description: {
          en: "Seconds elapsed since the background scheduler last pinged the central coordinator.",
          hinglish: "Background scheduler dwara last ping bheje jaane ke baad se beete huye seconds.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Telemetry metrics dropped to zero across all users", hinglish: "Sabhi users ke analytics sudden zero ho gaye" },
        cause: { en: "Ingestion pipeline queue overflow or Kafka/Redis broker partition failure", hinglish: "Ingestion pipeline queue me overflow ya broker connection fail" },
        fix: { en: "Immediately execute emergency procedures in docs/runbooks/telemetry-incident.md", hinglish: "Turant docs/runbooks/telemetry-incident.md runbook execute karein" },
      },
    ],
    faqs: [
      {
        question: { en: "What runbook governs feature flag rollbacks?", hinglish: "Feature flag rollback ke liye kaunsa runbook follow karein?" },
        answer: {
          en: "Consult docs/runbooks/flag-rollback.md for safe toggles, cache purging, and post-rollback verification.",
          hinglish: "Feature flags ko safely rollback karne ke liye docs/runbooks/flag-rollback.md follow karein.",
        },
      },
      {
        question: { en: "What is the procedure for an Instagram reconnect storm?", hinglish: "Mass Instagram disconnect hone par kya karein?" },
        answer: {
          en: "Follow docs/runbooks/instagram-reconnect-storm.md to throttle reconnection emails and prevent Meta API rate limits.",
          hinglish: "Reconnection emails throttle karne aur Meta limits manage karne ke liye docs/runbooks/instagram-reconnect-storm.md follow karein.",
        },
      },
    ],
    related: ["admin-dlq-replay-operations", "admin-command-center"],
    supportCta: {
      label: { en: "System Controls", hinglish: "System Controls" },
      href: "/admin/system",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "admin-dlq-replay-operations",
    roles: ["ADMIN"],
    area: "system",
    routes: ["/admin/system"],
    title: {
      en: "Dead-Letter Queue (DLQ) Replay & Worker Recovery",
      hinglish: "Dead-Letter Queue (DLQ) Replay aur Worker Recovery",
    },
    summary: {
      en: "Inspect failed background jobs, debug stack traces, verify job idempotency, safely replay queued payloads, and manage dead letters.",
      hinglish: "Failed background jobs inspect karein, stack traces debug karein, idempotency verify karein aur DLQ messages safe replay karein.",
    },
    whenToUse: {
      en: "Use when background worker jobs (payout dispatches, webhook relays, Instagram metrics syncs) fail after max retry attempts.",
      hinglish: "Jab background jobs (payouts, webhooks ya sync) max retries ke baad fail hokar dead letter queue me jama ho jayein.",
    },
    steps: [
      {
        title: {
          en: "Inspect Dead-Letter Queue Depth & Exception Types",
          hinglish: "DLQ Depth aur Error Types Check Karein",
        },
        body: {
          en: "Navigate to /admin/system#dlq to review failed job payloads, root causes (e.g., downstream 500 error, network timeout), and timestamp of failure.",
          hinglish: "/admin/system#dlq par jakar failed jobs, unke error stack traces aur failure time inspect karein.",
        },
        uiRef: "DlqJobTable",
      },
      {
        title: {
          en: "Sanitize Payloads & Verify Consumer Idempotency",
          hinglish: "Payloads Sanitize Karein aur Idempotency Check Karein",
        },
        body: {
          en: "Ensure consumer handlers use unique transaction IDs so re-running a job does not create duplicate database records or double payments.",
          hinglish: "Confirm karein ki job handler idempotent hai taaki replay karne se duplicate database entry ya double payout na ho.",
        },
        uiRef: "PayloadDetailModal",
      },
      {
        title: {
          en: "Trigger Controlled Replay Batch via Admin API",
          hinglish: "Controlled Replay Batch Run Karein",
        },
        body: {
          en: "Execute replay for selected job IDs using /api/admin/jobs/dlq in accordance with docs/runbooks/dlq-replay.md.",
          hinglish: "docs/runbooks/dlq-replay.md runbook ke mutabiq /api/admin/jobs/dlq endpoint se jobs re-queue karein.",
        },
        uiRef: "DlqReplayButton",
      },
    ],
    rules: [
      {
        en: "[DESTRUCTIVE ACTION: DLQ Message Replay] What this does: Re-injects failed dead-letter queue payloads into the active QStash message broker queue for retry processing. Who is notified: System audit log records staff member ID, timestamp, job payload hash, and replay batch size. Can it be undone: NO. Once dispatched into the active worker queue, consumer jobs execute immediately and mutate downstream database states.",
        hinglish: "[DESTRUCTIVE ACTION: DLQ Message Replay] What this does: Dead letter queue ke failed background jobs ko wapas active processing pipeline me inject karta hai. Who is notified: Audit log me staff ID, timestamp aur job payload hash record hota hai. Can it be undone: NAHI. Active queue me jane ke baad worker process job ko execute kar dega.",
      },
      {
        en: "Replaying payment or payout jobs requires explicit confirmation of banking partner status to avoid double credits.",
        hinglish: "Payment ya payout jobs replay karne se pehle bank partner dashboard par status check karna mandatory hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "DLQ Message Count", hinglish: "DLQ Message Count" },
        description: {
          en: "Number of background jobs currently halted in the dead-letter queue requiring staff attention.",
          hinglish: "Failed background jobs ki total sankhya jo staff intervention ka wait kar rahi hai.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Replayed job fails immediately with same error", hinglish: "Replay kiya hua job wapas turant fail ho gaya" },
        cause: { en: "Underlying external service (e.g., third-party API) is still unreachable or payload data is fundamentally malformed", hinglish: "External API abhi bhi down hai ya payload me missing parameters hain" },
        fix: { en: "Verify downstream connectivity before replaying; consult docs/runbooks/dlq-replay.md for payload editing", hinglish: "External service health check karein aur docs/runbooks/dlq-replay.md follow karein" },
      },
    ],
    faqs: [
      {
        question: { en: "What runbook governs DLQ replays?", hinglish: "DLQ replay ke liye kaunsa runbook follow karein?" },
        answer: {
          en: "Refer to docs/runbooks/dlq-replay.md for step-by-step procedures, safety checks, and payload verification.",
          hinglish: "Safety checks aur step-by-step process ke liye docs/runbooks/dlq-replay.md runbook check karein.",
        },
      },
    ],
    related: ["admin-system-health-and-dlq", "admin-financial-reconciliation"],
    supportCta: {
      label: { en: "Manage DLQ", hinglish: "DLQ Manage Karein" },
      href: "/admin/system#dlq",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "admin-user-management",
    roles: ["ADMIN"],
    area: "admin",
    routes: ["/admin/users", "/admin/users/[id]"],
    title: {
      en: "Platform Users Directory & Role Governance",
      hinglish: "Platform Users Directory aur Role Governance",
    },
    summary: {
      en: "Search user accounts across roles, manage profile overrides, enforce suspensions/bans, invalidate Redis auth caches, and investigate account takeovers.",
      hinglish: "Sabhi user accounts search karein, profile overrides manage karein, ban/suspensions enforce karein aur auth caches flush karein.",
    },
    whenToUse: {
      en: "Use to investigate suspicious account activity, enforce policy bans, reset compromised credentials, or assign verified staff roles.",
      hinglish: "Suspicious user activity check karne, policy violator ko ban karne, password reset karne ya staff roles update karne ke liye use karein.",
    },
    steps: [
      {
        title: {
          en: "Search User Dossier & Profile Record",
          hinglish: "User Dossier aur Profile Search Karein",
        },
        body: {
          en: "Search users by email, phone, Instagram handle, PAN number, or internal UUID to pull full cross-role history.",
          hinglish: "Email, phone, handle, PAN ya user ID se search karke full account profile open karein.",
        },
        uiRef: "UserSearchInput",
      },
      {
        title: {
          en: "Inspect Active Sessions & Connected Socials",
          hinglish: "Active Sessions aur Connected Accounts Dekhein",
        },
        body: {
          en: "On /admin/users/[id], review active IP logins, OAuth credentials, and role assignments. In case of Instagram token storm, follow docs/runbooks/instagram-reconnect-storm.md.",
          hinglish: "/admin/users/[id] par active sessions, Instagram OAuth status aur roles dekhein. Token issues me docs/runbooks/instagram-reconnect-storm.md follow karein.",
        },
        uiRef: "UserSecurityPanel",
      },
      {
        title: {
          en: "Apply Suspension, Ban, or Role Override",
          hinglish: "Suspension, Ban ya Role Override Apply Karein",
        },
        body: {
          en: "Execute account suspension with mandatory reason logging. System instantly purges Redis tokens and locks user from API access.",
          hinglish: "Reason record karke user ko suspend karein. System turant session token invalidate kar deta hai.",
        },
        uiRef: "UserActionDropdown",
      },
    ],
    rules: [
      {
        en: "[DESTRUCTIVE ACTION: User Ban / Suspension] What this does: Immediately terminates active sessions, invalidates Redis auth tokens, and blocks login. Who is notified: The affected user receives a formal account suspension email; security admins are alerted via Slack/PagerDuty. Can it be undone: Yes, an admin can manually lift the suspension with mandatory reason logging in the immutable audit log.",
        hinglish: "[DESTRUCTIVE ACTION: User Ban / Suspension] What this does: User ki active sessions turant terminate karta hai, Redis auth cache invalidate karta hai aur login block karta hai. Who is notified: Affected user ko official suspension email bheja jata hai; security admins ko Slack/PagerDuty par alert milta hai. Can it be undone: Haan, admin immutable audit log me valid reason record karke suspension hata sakte hain.",
      },
      {
        en: "Super-admin role assignment cannot be performed by standard admins; requires dual-key authorization.",
        hinglish: "Super-admin permission sirf existing super-admins hi assign kar sakte hain mandatory 2FA ke sath.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Total Platform Users", hinglish: "Total Platform Users" },
        description: {
          en: "Count of all registered accounts across Influencer, Brand, Scout, and Admin user types.",
          hinglish: "Platform par registered sabhi creators, brands, scouts aur admins ki total sankhya.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Suspended user can still browse cached public pages", hinglish: "Suspended user abhi bhi cached public pages dekh paa raha hai" },
        cause: { en: "Public edge caching serving stale profile view; user is blocked from all authenticated API calls", hinglish: "Public CDN cache me page store hai; user ki authenticated access completely blocked hai" },
        fix: { en: "Trigger edge cache purge for user public URL via System Controls", hinglish: "System Controls se user URL ka CDN cache flush karein" },
      },
    ],
    faqs: [
      {
        question: { en: "What runbook governs locked-out admin accounts?", hinglish: "Admin account lock ho jaye toh kaunsa runbook follow karein?" },
        answer: {
          en: "Follow docs/runbooks/admin-lockout.md to clear rate limit keys in Redis or reset TOTP secret keys safely.",
          hinglish: "Lockout reset karne ke liye docs/runbooks/admin-lockout.md runbook ke steps follow karein.",
        },
      },
    ],
    related: ["admin-immutable-audit-logs", "admin-violations-and-enforcement"],
    supportCta: {
      label: { en: "Directory", hinglish: "Directory" },
      href: "/admin/users",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "admin-kyc-verification-desk",
    roles: ["ADMIN"],
    area: "kyc",
    routes: ["/admin/verifications", "/admin/verifications/[id]"],
    title: {
      en: "PAN & GSTIN Identity Verification Desk",
      hinglish: "PAN aur GSTIN Identity Verification Desk",
    },
    summary: {
      en: "Review uploaded PAN cards, GSTIN certificates, and penny-drop bank validations against government databases to ensure full tax compliance.",
      hinglish: "PAN cards, GST certificates aur bank account details verify karein taaki platform tax compliance 100% accurate rahe.",
    },
    whenToUse: {
      en: "Use to clear the daily queue of pending identity documents submitted by creators and brands before they can transact.",
      hinglish: "Creators aur brands dwara submit kiye gaye KYC documents review aur approve karne ke liye use karein.",
    },
    steps: [
      {
        title: {
          en: "Verify PAN Card Name & Date of Birth",
          hinglish: "PAN Card Name aur DOB Match Karein",
        },
        body: {
          en: "On /admin/verifications/[id], check uploaded document image against NSDL database record for exact name and DOB alignment.",
          hinglish: "/admin/verifications/[id] par uploaded image ko NSDL record ke sath name aur DOB verify karein.",
        },
        uiRef: "PanDocumentViewer",
      },
      {
        title: {
          en: "Check GSTIN Certificate & Active Filing Status",
          hinglish: "GSTIN Certificate aur Status Check Karein",
        },
        body: {
          en: "For brands and registered creators, verify trade name, registered address, and active tax filing status on GST portal.",
          hinglish: "Brands aur registered creators ke GSTIN number ka legal name aur active status verify karein.",
        },
        uiRef: "GstStatusCard",
      },
      {
        title: {
          en: "Approve or Reject with Actionable Remediation Notes",
          hinglish: "Specific Reason ke Sath Approve ya Reject Karein",
        },
        body: {
          en: "If rejecting, choose standard rejection code (e.g., BLURRY_DOCUMENT, NAME_MISMATCH) so user can re-upload correctly.",
          hinglish: "Reject karne par exact reason code select karein taaki user correct document upload kar sake.",
        },
        uiRef: "KycDecisionButtons",
      },
    ],
    rules: [
      {
        en: "Without verified PAN, creator withdrawals are subject to higher TDS of {{tax.tds_206aa}} under Section 206AA of Income Tax Act.",
        hinglish: "Bina verified PAN ke Section 206AA ke tehat maximum {{tax.tds_206aa}} TDS deduct hota hai.",
      },
      {
        en: "Admin KYC decisions must be completed within 24 hours of submission to maintain platform onboarding SLAs.",
        hinglish: "User onboarding smooth rakhne ke liye KYC review 24 hours ke andar complete hona zaroori hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Verification Queue Depth", hinglish: "Verification Queue Depth" },
        description: {
          en: "Number of pending user identity submissions awaiting human staff review.",
          hinglish: "Review ka wait kar rahe pending KYC documents ki total ginti.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "NSDL PAN verification API timeout during verification", hinglish: "NSDL API timeout error verification ke waqt" },
        cause: { en: "Government income tax server maintenance or network latency", hinglish: "Sarkari NSDL portal server temporary down hai" },
        fix: { en: "Manually cross-verify document visual details and mark 'MANUALLY_VERIFIED' with audit note", hinglish: "Image details visually verify karein aur audit note ke sath manually approve karein" },
      },
    ],
    faqs: [
      {
        question: { en: "Can a creator withdraw money before KYC is verified?", hinglish: "Kya KYC verify hone se pehle creator paise nikal sakta hai?" },
        answer: {
          en: "No. Bank account withdrawals are hard-blocked until PAN verification and bank penny-drop succeed.",
          hinglish: "Nahi, withdrawal ke liye PAN aur bank verification complete hona mandatory hai.",
        },
      },
    ],
    related: ["admin-payout-authorizations", "admin-financial-reconciliation"],
    supportCta: {
      label: { en: "Review Queue", hinglish: "Review Queue" },
      href: "/admin/verifications",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "admin-violations-and-enforcement",
    roles: ["ADMIN"],
    area: "compliance",
    routes: ["/admin/violations"],
    title: {
      en: "Policy Violations, Contact Leaks & Enforcement Actions",
      hinglish: "Policy Violations, Contact Leaks aur Enforcement Actions",
    },
    summary: {
      en: "Enforce community guidelines, penalize off-platform transaction attempts, address ASCI disclosure failures, and apply progressive strikes.",
      hinglish: "Community guidelines enforce karein, contact leak attempts pakdein, ASCI violations par action le aur warning strikes lagayein.",
    },
    whenToUse: {
      en: "Use to investigate system-flagged chats, review brand contact evasion, or apply account strikes and penalties.",
      hinglish: "Chat me phone/email share hone ke alerts aane par ya policy breach ki complaints investigate karne ke liye use karein.",
    },
    steps: [
      {
        title: {
          en: "Review Flagged Chat Transcripts & Leak Detection",
          hinglish: "Flagged Chat Messages aur Contact Leaks Dekhein",
        },
        body: {
          en: "Examine messages flagged by automated filters for masked phone numbers, WhatsApp links, or off-platform payment solicitations.",
          hinglish: "Chat logs me phone number, WhatsApp links ya direct payment ke bahane dhundhne wale messages inspect karein.",
        },
        uiRef: "FlaggedTranscriptViewer",
      },
      {
        title: {
          en: "Audit ASCI Compliance & Disclosure Tags",
          hinglish: "ASCI Ad Disclosures Check Karein",
        },
        body: {
          en: "Verify published campaign posts include statutory '#Ad' or '#Sponsored' tags in accordance with Indian consumer protection rules.",
          hinglish: "Check karein ki creator ke published post me mandatory '#Ad' ya '#Collab' tag laga hai ya nahi.",
        },
        uiRef: "AsciComplianceStatus",
      },
      {
        title: {
          en: "Apply Progressive Strike or Account Penalty",
          hinglish: "Strike Lagayein ya Penalty Apply Karein",
        },
        body: {
          en: "Issue Strike 1 (Warning), Strike 2 (7-day shadowban from marketplace), or Strike 3 (Permanent termination and escrow freeze).",
          hinglish: "Strike 1 (Warning), Strike 2 (7-day temporary restriction) ya Strike 3 (permanent ban) assign karein.",
        },
        uiRef: "StrikeActionForm",
      },
    ],
    rules: [
      {
        en: "Three confirmed strikes within 90 days result in automated account termination and forfeiture of referral privileges.",
        hinglish: "90 din me 3 strikes milne par account automatically terminate ho jata hai.",
      },
      {
        en: "All enforcement decisions must cite the specific clause of VyaparMedia Terms of Service in the notification to the user.",
        hinglish: "User ko bheje jaane wale notice me platform terms ka specific clause mention karna zaroori hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Active Strikes", hinglish: "Active Strikes" },
        description: {
          en: "Count of unexpired policy violations currently recorded against user profile.",
          hinglish: "User ke account par lage active policy warning strikes ki sankhya.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "User claims innocent message was falsely flagged as contact leak", hinglish: "User keh raha hai ki normal message galti se leak flag ho gaya" },
        cause: { en: "Regex false positive on alphanumeric order code or tracking number", hinglish: "Order ID ya tracking number ko system ne phone number samajh liya" },
        fix: { en: "Dismiss violation flag with 'FALSE_POSITIVE' tag; system updates filter exclusion rules", hinglish: "Violation ko 'FALSE_POSITIVE' mark karein taaki filter automatically learn kare" },
      },
    ],
    faqs: [
      {
        question: { en: "Does an enforcement strike expire automatically?", hinglish: "Kya warning strike automatically expire hoti hai?" },
        answer: {
          en: "Yes, Strike 1 and Strike 2 decay after 90 days of clean platform behavior without repeat infractions.",
          hinglish: "Haan, 90 din tak koi nayi violation na hone par purani strikes automatically clear ho jaati hain.",
        },
      },
    ],
    related: ["admin-user-management", "admin-suspicious-reviews"],
    supportCta: {
      label: { en: "Violations Radar", hinglish: "Violations Radar" },
      href: "/admin/violations",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "admin-support-desk",
    roles: ["ADMIN"],
    area: "admin",
    routes: ["/dashboard/support"],
    title: {
      en: "Staff Support Desk & Escalation Triage",
      hinglish: "Staff Support Desk aur Escalation Triage",
    },
    summary: {
      en: "Triage support tickets from creators, brands, and campus scouts, assign priority levels (P0-P3), investigate transaction traces, and maintain SLAs.",
      hinglish: "Creators, brands aur scouts ke help tickets triage karein, priority levels set karein, issue investigate karein aur resolution dein.",
    },
    whenToUse: {
      en: "Use when responding to user help tickets, troubleshooting stuck deal workflows, or handling payment inquiries.",
      hinglish: "Jab users support par contact karein ya platform par kisi stuck deal ya payment ka issue report karein.",
    },
    steps: [
      {
        title: {
          en: "Filter & Triage Tickets by Severity",
          hinglish: "Tickets ko Severity ke Anusaar Triage Karein",
        },
        body: {
          en: "Sort incoming tickets by urgency: P0 (Critical escrow or security flaw), P1 (Stuck payment or active dispute), P2 (General feature query), P3 (Feedback).",
          hinglish: "Tickets ko priority ke hisab se sort karein: P0 (Urgent security/escrow), P1 (Payment issue), P2 (General help), P3 (Feedback).",
        },
        uiRef: "SupportQueueFilter",
      },
      {
        title: {
          en: "Cross-Reference Ticket with User History Dossier",
          hinglish: "User History aur Transactions Cross-Check Karein",
        },
        body: {
          en: "Inspect user role, verification status, active deals, and recent audit logs before replying to understand the operational context.",
          hinglish: "User ki profile, recent deals aur audit logs dekh kar exact problem samjhein.",
        },
        uiRef: "UserContextFlyout",
      },
      {
        title: {
          en: "Respond with Standard Operating Guidance",
          hinglish: "Guidance aur Solution ke Sath Reply Karein",
        },
        body: {
          en: "Provide clear resolution or reference canonical guides and runbooks. Close ticket when user confirms resolution.",
          hinglish: "Clear solution dein ya relevant guide share karein. Problem solve hone par ticket close karein.",
        },
        uiRef: "TicketResponseForm",
      },
    ],
    rules: [
      {
        en: "Critical P0 security or financial tickets must receive initial staff acknowledgement within 15 minutes.",
        hinglish: "P0 level ke critical tickets par staff dwara 15 minute ke andar response aana mandatory hai.",
      },
      {
        en: "Staff must never ask users for their passwords, OTPs, or private UPI PINs in support ticket conversations.",
        hinglish: "Staff kisi bhi user se unka password, OTP ya UPI PIN nahi maang sakta.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "First Response Time (FRT)", hinglish: "First Response Time (FRT)" },
        description: {
          en: "Average minutes taken by staff to acknowledge and triage a newly opened ticket.",
          hinglish: "User ke ticket create karne ke baad staff dwara pehla reply aane ka average time.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Ticket reopened immediately after closing", hinglish: "Ticket close karne ke turant baad user ne reopen kar diya" },
        cause: { en: "Root cause not fully resolved before marking ticket as solved", hinglish: "Problem puri tarah solve hone se pehle ticket close kar diya gaya tha" },
        fix: { en: "Always verify underlying database transaction status before marking ticket resolved", hinglish: "Database me status verify karke hi ticket resolve karein" },
      },
    ],
    faqs: [
      {
        question: { en: "Can staff convert a support ticket into a formal dispute?", hinglish: "Kya staff support ticket ko dispute me convert kar sakta hai?" },
        answer: {
          en: "Yes, if an unresolved deliverable disagreement exists on an active contract, escalate ticket to /admin/disputes.",
          hinglish: "Haan, active contract me dispute hone par ticket ko direct /admin/disputes me escalate kiya ja sakta hai.",
        },
      },
    ],
    related: ["admin-command-center", "admin-user-management"],
    supportCta: {
      label: { en: "Support Queue", hinglish: "Support Queue" },
      href: "/dashboard/support",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "admin-guide-center",
    roles: ["ADMIN"],
    area: "admin",
    routes: ["/admin/guide"],
    title: {
      en: "Administrative Knowledge Base & Standard Operating Procedures",
      hinglish: "Administrative Knowledge Base aur SOPs",
    },
    summary: {
      en: "Browse operational SOPs, regulatory tax guidelines, incident runbooks, and staff guidelines across all platform modules.",
      hinglish: "Platform ke sabhi SOPs, regulatory tax rules, runbooks aur staff guides yahan search karein.",
    },
    whenToUse: {
      en: "Use to onboard new platform administrators, review compliance standards, or look up operational instructions.",
      hinglish: "Naye staff ko train karne, statutory rules samajhne ya operating procedure check karne ke liye use karein.",
    },
    steps: [
      {
        title: {
          en: "Search Operational Runbooks by Topic",
          hinglish: "Topic ke Anusaar Runbooks Search Karein",
        },
        body: {
          en: "Use keyword search to jump directly to specific runbooks or compliance procedures (e.g., payment stuck, escrow mismatch, DLQ replay).",
          hinglish: "Keywords daal kar specific runbook ya operating procedure turant khojein (jaise payment stuck ya DLQ replay).",
        },
        uiRef: "GuideSearchBar",
      },
      {
        title: {
          en: "Verify In-Product Documentation Currency",
          hinglish: "Documentation Version aur Dates Check Karein",
        },
        body: {
          en: "Ensure all guides show current review dates and match the latest platform statutory tax regulations.",
          hinglish: "Check karein ki sabhi guides updated hain aur latest tax rules ke anusaar hain.",
        },
        uiRef: "GuideVersionTag",
      },
      {
        title: {
          en: "Audit Runbooks & Architecture References",
          hinglish: "Runbooks aur Architecture References Audit Karein",
        },
        body: {
          en: "Access and review technical runbooks in docs/runbooks/ (payment-stuck, escrow-mismatch, instagram-reconnect-storm, telemetry-incident, admin-lockout, flag-rollback, dlq-replay) and docs/meta-app-review.md.",
          hinglish: "docs/runbooks/ ke sabhi runbooks aur docs/meta-app-review.md guidelines ko yahan se inspect aur verify karein.",
        },
        uiRef: "RunbookLinksPanel",
      },
    ],
    rules: [
      {
        en: "All operational procedures must be reviewed and re-certified at least once per calendar quarter.",
        hinglish: "Sabhi SOPs aur guides ko har quarter me kam se kam ek baar review aur certify karna mandatory hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Operational Coverage", hinglish: "Operational Coverage" },
        description: {
          en: "100% of admin dashboard screens and sensitive operations are backed by documented standard operating procedures.",
          hinglish: "Platform ke sabhi admin pages aur critical actions ke detailed SOPs yahan documented hain.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Guide shows outdated fee or tax percentage", hinglish: "Guide me purani fee ya tax percentage dikh rahi hai" },
        cause: { en: "Dynamic token template not used or static string hardcoded in legacy content", hinglish: "Dynamic token use nahi kiya gaya tha" },
        fix: { en: "Bind value to canonical GUIDE_TOKENS object to ensure single source of truth", hinglish: "GUIDE_TOKENS use karein taaki value centrally update ho sake" },
      },
    ],
    faqs: [
      {
        question: { en: "Where are operational runbooks maintained?", hinglish: "Operational runbooks kahan maintain hote hain?" },
        answer: {
          en: "Runbooks are maintained in the repository under docs/runbooks/ alongside architecture patterns.",
          hinglish: "Repository ke docs/runbooks/ folder me sabhi technical runbooks store rehte hain.",
        },
      },
      {
        question: { en: "Which runbooks are officially published?", hinglish: "Kaun-kaun se runbooks officially published hain?" },
        answer: {
          en: "docs/runbooks/payment-stuck.md, docs/runbooks/escrow-mismatch.md, docs/runbooks/instagram-reconnect-storm.md, docs/runbooks/telemetry-incident.md, docs/runbooks/admin-lockout.md, docs/runbooks/flag-rollback.md, docs/runbooks/dlq-replay.md, and docs/meta-app-review.md.",
          hinglish: "Platform par 7 operational runbooks (payment-stuck, escrow-mismatch, instagram-reconnect-storm, telemetry-incident, admin-lockout, flag-rollback, dlq-replay) aur docs/meta-app-review.md available hain.",
        },
      },
    ],
    related: ["admin-command-center", "admin-immutable-audit-logs"],
    supportCta: {
      label: { en: "Knowledge Base", hinglish: "Knowledge Base" },
      href: "/admin/guide",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
];
