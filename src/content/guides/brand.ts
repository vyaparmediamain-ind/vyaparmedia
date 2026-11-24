import type { Guide } from "@/lib/guides/schema";

export const BRAND_GUIDES: Guide[] = [
  // 1. Home / Command Center
  {
    id: "brand-dashboard-overview",
    roles: ["BRAND"],
    area: "general",
    routes: ["/dashboard"],
    title: {
      en: "Brand Command Center & Escrow Portfolio Overview",
      hinglish: "Brand Command Center aur Escrow Portfolio Overview",
    },
    summary: {
      en: "Monitor active campaign budgets, review incoming creator submissions within SLA deadlines, and oversee locked escrow commitments.",
      hinglish: "Apne active campaign budgets, pending creator drafts aur locked escrow balance ko ek hi jagah manage karein.",
    },
    whenToUse: {
      en: "When logging in to review campaign health, new creator proposals, and pending draft reviews.",
      hinglish: "Jab aapko apne live campaigns ka status, naye applications aur creator submissions check karne ho.",
    },
    steps: [
      {
        title: {
          en: "Review Urgent Action Cards",
          hinglish: "Urgent Action Alerts Check Karein",
        },
        body: {
          en: "Action cards alert you when creators submit drafts requiring review within the {{deals.review_hours}} review window.",
          hinglish: "Alerts aapko batate hain jab creator draft submit kare, jise {{deals.review_hours}} me review karna anivarya hota hai.",
        },
        uiRef: "BrandActionFeed",
      },
      {
        title: {
          en: "Monitor Escrow Portfolio Health",
          hinglish: "Escrow Portfolio Health Dekhein",
        },
        body: {
          en: "Track Available Wallet Balance vs Escrow Locked Funds across all active campaign cohorts.",
          hinglish: "Available Wallet Balance aur Escrow me locked funds ka real-time hisab dekhein.",
        },
        uiRef: "BrandEscrowSummaryCard",
      },
      {
        title: {
          en: "Inspect Active Campaigns Roster",
          hinglish: "Active Campaigns Roster Track Karein",
        },
        body: {
          en: "Quickly view slot filling percentages (e.g. 8 of 10 creators onboarded) and upcoming posting deadlines.",
          hinglish: "Dekhein kitne creator slots bhar chuke hain aur aane wali posting deadlines kab hain.",
        },
        uiRef: "ActiveCampaignsWidget",
      },
    ],
    rules: [
      {
        en: "Brand review SLA is strictly {{deals.review_hours}}. Auto-approval triggers after {{deals.auto_approve_hours}} if no feedback is submitted.",
        hinglish: "Brand review ka SLA {{deals.review_hours}} hai. {{deals.auto_approve_hours}} me response na dene par system auto-approve kar deta hai.",
      },
      {
        en: "Platform fees range from {{fee.min}} to {{fee.brand_default}}, reduced by accumulated brand XP and referral rewards.",
        hinglish: "Brand platform fee {{fee.min}} se {{fee.brand_default}} ke beech hoti hai, jo XP aur referral points se kam ho jati hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Escrow Locked Funds", hinglish: "Escrow Locked Funds" },
        description: {
          en: "Total capital legally locked in platform custody for creators whose deliverables are currently in production or review.",
          hinglish: "Active signed deals ke liye platform escrow me advance jama kiya gaya safe budget.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Banner warns 'Review Window Expiring Soon'", hinglish: "Banner par 'Review Window Expiring Soon' ka alert aa raha hai" },
        cause: { en: "A creator submitted draft deliverables more than 36 hours ago without brand action", hinglish: "Creator ne draft submit kiya tha aur {{deals.review_hours}} ka samay khatam hone wala hai" },
        fix: { en: "Open the Deal Room immediately to approve the draft or request specific minor revisions", hinglish: "Deal Room kholein aur draft approve karein ya revision request bhejein" },
      },
    ],
    faqs: [
      {
        question: { en: "Can a brand withdraw funds already in escrow?", hinglish: "Kya escrow me dale hue paise wapas nikaale ja sakte hain?" },
        answer: {
          en: "Only if the creator agrees to mutual cancellation, fails to deliver before the deadline, or if a mediator rules in your favor.",
          hinglish: "Sirf tab jab creator mutual cancel kare, deadline miss kare ya dispute mediator brand ke paksh me faisla kare.",
        },
      },
    ],
    related: ["brand-campaign-creation", "brand-deal-management"],
    supportCta: {
      label: { en: "Contact Help Desk", hinglish: "Help Desk se Baat Karein" },
      href: "/dashboard/support",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 2. Creators Discovery (Filters, Match Score, ROI Score, Market Range, DRS Trust Strip, Shortlisting)
  {
    id: "brand-creator-discovery",
    roles: ["BRAND"],
    area: "campaigns",
    routes: ["/dashboard/influencers"],
    title: {
      en: "Creator Discovery, AI Match Scores & DRS™ Trust Strip",
      hinglish: "Creator Discovery, AI Match Score aur DRS™ Trust Strip",
    },
    summary: {
      en: "Discover verified influencers using multi-faceted filters, understand relative ROI scores, inspect DRS reputation strips, and shortlist candidates.",
      hinglish: "Naye creators dhoondhein, AI match score aur ROI prediction dekhein aur DRS trust score verify karein.",
    },
    whenToUse: {
      en: "When scouting creators for invite-only campaigns, direct offers, or exploring talent in specific niches.",
      hinglish: "Jab aapko campaign ke liye creators dhoondhne ho ya kisi specific category ke top talent ko shortlist karna ho.",
    },
    steps: [
      {
        title: {
          en: "Apply Smart Filters",
          hinglish: "Smart Filters Apply Karein",
        },
        body: {
          en: "Filter by content category (Fashion, Tech, Finance, Food), primary platform (Instagram Reels, YouTube), city, and follower tier.",
          hinglish: "Category, platform (Reels/YouTube), city aur follower count ke hisaab se talent filter karein.",
        },
        uiRef: "CreatorDiscoveryFeed",
      },
      {
        title: {
          en: "Evaluate Match & ROI Scores",
          hinglish: "Match Score aur ROI Score Check Karein",
        },
        body: {
          en: "Inspect the 0–100% Match Score indicating audience overlap, and the relative ROI Score benchmarked against category baseline CPV.",
          hinglish: "0-100% Match Score aur category baseline ke hisab se calculated ROI Score card par dekhein.",
        },
        uiRef: "CreatorDiscoveryCard",
      },
      {
        title: {
          en: "Verify DRS™ Trust Strip & Market Range",
          hinglish: "DRS™ Strip aur Market Range Verify Karein",
        },
        body: {
          en: "Examine the creator's Dynamic Reliability Score (300–900). Scores above 750 represent elite on-time delivery track records.",
          hinglish: "Creator ka DRS Trust Score (300-900) dekhein taaki pata chale ki wo time par kaam deliver karta hai ya nahi.",
        },
        uiRef: "DrsTrustStrip",
      },
      {
        title: {
          en: "Shortlist Talent or Direct Invite",
          hinglish: "Shortlist Karein ya Direct Invite Bhejein",
        },
        body: {
          en: "Bookmark profiles to your brand shortlist or click 'Make Offer' to invite them directly to an active campaign.",
          hinglish: "Creators ko shortlist me save karein ya 'Make Offer' par click karke direct proposal bhejein.",
        },
        uiRef: "BookmarkButton",
      },
    ],
    rules: [
      {
        en: "All creator follower metrics are synchronized via official Meta Graph API or YouTube Data API.",
        hinglish: "Sabhi creators ke follower stats official Meta aur YouTube API se verified hote hain.",
      },
      {
        en: "Creators below 600 DRS cannot be assigned deals exceeding ₹25,000 for brand risk mitigation.",
        hinglish: "600 se kam DRS wale creators ko ₹25,000 se badi deals assign karna restricted hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "ROI Score (0–100)", hinglish: "ROI Score (0–100)" },
        description: {
          en: "Relative efficiency metric comparing expected creator CPV against category baseline benchmarks (₹0.15 to ₹1.50 CPV).",
          hinglish: "Category ke average cost-per-view ke mukable creator kitna cost-effective hai, uska rating.",
        },
      },
      {
        label: { en: "Estimated Market Range", hinglish: "Estimated Market Range" },
        description: {
          en: "Statistical pricing bracket recommended for this creator based on verified median views and engagement rates.",
          hinglish: "Creator ke verified views ke hisaab se recommended commercial price range.",
        },
      },
    ],
    commonErrors: [],
    faqs: [
      {
        question: { en: "What does the 'Verified Views' badge mean?", hinglish: "'Verified Views' badge ka kya matlab hai?" },
        answer: {
          en: "It means the creator's video views are validated directly via OAuth token synchronization, not estimated or self-reported.",
          hinglish: "Iska matlab hai ki view counts official API se check kiye gaye hain aur 100% genuine hain.",
        },
      },
    ],
    related: ["brand-creator-dossier", "brand-make-offer"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 3. Creator Dossier Page
  {
    id: "brand-creator-dossier",
    roles: ["BRAND"],
    area: "campaigns",
    routes: ["/dashboard/influencers/[id]", "/creator/[username]"],
    title: {
      en: "Creator Dossier, Historical Performance & Media Kit",
      hinglish: "Creator Dossier, Past Performance aur Media Kit",
    },
    summary: {
      en: "Inspect in-depth creator dossiers: 12-week delivery history, verified CPM/CPV economics, audience demographics, and past brand ratings.",
      hinglish: "Creator ka poora profile dekhein: 12-week historical delivery, CPV economics, audience data aur brand ratings.",
    },
    whenToUse: {
      en: "Before sending direct offers or accepting creator applications for high-budget campaigns.",
      hinglish: "Kisi creator ko bada campaign offer dene se pehle uska poora performance record check karne ke liye.",
    },
    steps: [
      {
        title: {
          en: "Inspect 12-Week Delivery History",
          hinglish: "12-Week Delivery History Dekhein",
        },
        body: {
          en: "Review weekly CreatorMetricSnapshot rows displaying actual post views, engagement rates, and data quality tags (VERIFIED | ESTIMATED | SELF_REPORTED).",
          hinglish: "Pichle 12 hafton ke actual video views, engagement rate aur data quality tags check karein.",
        },
        uiRef: "CreatorHistoricalMetricsTable",
      },
      {
        title: {
          en: "Check Verified Audience Demographics",
          hinglish: "Audience Demographics Verify Karein",
        },
        body: {
          en: "Verify top follower cities (e.g. Mumbai, Delhi, Bengaluru) and primary language concentrations.",
          hinglish: "Dekhein ki creator ki audience kin shehron me rehti hai aur unka primary demographic kya hai.",
        },
        uiRef: "AudienceDemographicsCard",
      },
      {
        title: {
          en: "Review Brand Testimonials & On-Time Rate",
          hinglish: "Brand Reviews aur On-Time Delivery Rate",
        },
        body: {
          en: "Examine past brand ratings, dispute-free badges, and the creator's on-time draft delivery percentage.",
          hinglish: "Dusre brands ke reviews aur creator ka on-time draft submission percentage check karein.",
        },
        uiRef: "BrandReviewsCard",
      },
    ],
    rules: [
      {
        en: "Data quality chips transparently distinguish between API-verified telemetry and estimated benchmarks.",
        hinglish: "Data quality chips saaf batate hain ki data API verified hai ya estimated.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "On-Time Milestone Rate", hinglish: "On-Time Milestone Rate" },
        description: {
          en: "Percentage of contract draft submissions delivered prior to the initial agreed deadline.",
          hinglish: "Creator dwara deadline se pehle draft jama karne ka percentage track record.",
        },
      },
    ],
    commonErrors: [],
    faqs: [],
    related: ["brand-creator-discovery", "brand-make-offer"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 4. Creating a Campaign (3-Step Wizard: Deliverables, Budget, Categories, Slots, Live Preview)
  {
    id: "brand-campaign-creation",
    roles: ["BRAND"],
    area: "campaigns",
    routes: ["/dashboard/campaigns", "/dashboard/campaigns/create"],
    title: {
      en: "Campaign Creation Wizard: Deliverables, Slots & Escrow Budget",
      hinglish: "Campaign Creation Wizard: Deliverables, Slots aur Budget",
    },
    summary: {
      en: "Step-by-step guide to building campaign briefs: configure deliverables, allocate per-creator budgets, set matching priority sliders, and preview live.",
      hinglish: "3-step wizard me campaign brief banayein: deliverables chunein, slots decide karein aur live preview dekhein.",
    },
    whenToUse: {
      en: "When launching a new marketing campaign to solicit creator applications across India.",
      hinglish: "Jab aapko naya influencer marketing campaign launch karna ho.",
    },
    steps: [
      {
        title: {
          en: "Step 1: Brief & Deliverables Builder",
          hinglish: "Step 1: Brief aur Deliverables Builder",
        },
        body: {
          en: "Define campaign title, target categories, content requirements, and specific deliverables (e.g. 1 Instagram Reel + 2 Stories).",
          hinglish: "Title, target niche aur deliverables (jaise 1 Reel aur 2 Stories) configure karein.",
        },
        uiRef: "DeliverablesList",
      },
      {
        title: {
          en: "Step 2: Slots, Budget & Market Range Guidance",
          hinglish: "Step 2: Slots, Budget aur Pricing Guidance",
        },
        body: {
          en: "Set number of creator slots (e.g. 5 creators) and per-creator budget. The MarketRangeCard shows suggested pricing based on category CPV baselines.",
          hinglish: "Creator slots (kitne creators chahiye) aur per-creator budget dalein. Card par category ka suggested price range dikhega.",
        },
        uiRef: "MarketRangeCard",
      },
      {
        title: {
          en: "Step 3: Matching Priority Sliders & Live Preview",
          hinglish: "Step 3: Matching Sliders aur Live Preview",
        },
        body: {
          en: "Adjust weightings for Engagement Rate, Follower Count, and Niche Affinity. Review the live creator-facing card before publishing.",
          hinglish: "Matching priority sliders set karein aur creator ko kaisa card dikhega uska live preview check karein.",
        },
        uiRef: "MatchingPrioritySliders",
      },
    ],
    rules: [
      {
        en: "Minimum campaign budget must cover at least 1 creator slot at standard platform minimums.",
        hinglish: "Kam se kam ek creator slot ka budget hona zaroori hai.",
      },
      {
        en: "Public campaigns require at least {{deals.min_followers}} minimum follower threshold for applicants.",
        hinglish: "Public campaigns me apply karne ke liye creator ke kam se kam {{deals.min_followers}} followers hone chahiye.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Total Campaign Escrow Budget", hinglish: "Total Campaign Escrow Budget" },
        description: {
          en: "Equal to (Max Influencers × Per-Influencer Budget) plus applicable platform and gateway fees.",
          hinglish: "Kul budget jo slots aur per-creator rate ko multiply karke banta hai.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Publish button is disabled", hinglish: "Publish button click nahi ho raha" },
        cause: { en: "Missing required dates (application deadline, content submission deadline) or budget is below minimum", hinglish: "Deadlines select nahi ki gayi hain ya budget minimum limit se kam hai" },
        fix: { en: "Select valid calendar dates for application and content review windows in Step 2", hinglish: "Calendar se deadlines select karein aur budget verify karein" },
      },
    ],
    faqs: [
      {
        question: { en: "Can I save as draft without publishing?", hinglish: "Kya draft save kar sakte hain bina publish kiye?" },
        answer: {
          en: "Yes. Click 'Save Draft' at any step to preserve your deliverables and settings for later review.",
          hinglish: "Haan, 'Save Draft' par tap karke aap brief baad me complete kar sakte hain.",
        },
      },
    ],
    related: ["brand-campaign-detail", "brand-deal-management"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 5. Campaign Detail (Applicant Roster, Accept/Reject, Slot Progress, Sticky Escrow Budget)
  {
    id: "brand-campaign-detail",
    roles: ["BRAND"],
    area: "campaigns",
    routes: ["/dashboard/campaigns/[id]", "/dashboard/applications"],
    title: {
      en: "Campaign Detail: Applicant Roster, Slots & Proposal Approvals",
      hinglish: "Campaign Detail: Applicants Roster, Slots aur Selection",
    },
    summary: {
      en: "Review incoming creator proposals, evaluate custom quotes against market ranges, accept or reject pitches, and track slot fill progress.",
      hinglish: "Aaye hue creator proposals review karein, rate compare karein aur best creators ko accept karein.",
    },
    whenToUse: {
      en: "When reviewing applications received for your live campaign and converting top pitches into signed deals.",
      hinglish: "Jab aapko campaign ke applicants me se creators approve karne hon.",
    },
    steps: [
      {
        title: {
          en: "Inspect Applicant Roster",
          hinglish: "Applicant Roster Check Karein",
        },
        body: {
          en: "Sort applicants by AI Match Score, DRS Reliability Score, or Quoted Commercial Rate.",
          hinglish: "Applicants ko Match Score, DRS score ya unke rate ke hisaab se sort karein.",
        },
        uiRef: "ApplicantRosterTable",
      },
      {
        title: {
          en: "Evaluate Pitch & Sample Portfolio",
          hinglish: "Pitch aur Past Work Dekhein",
        },
        body: {
          en: "Read the creator's creative concept pitch and inspect sample reel links attached to the proposal.",
          hinglish: "Creator ka concept idea padhein aur unke sample videos check karein.",
        },
      },
      {
        title: {
          en: "Accept Pitch to Generate Deal",
          hinglish: "Accept karke Deal Lock Karein",
        },
        body: {
          en: "Clicking 'Accept Application' immediately locks one campaign slot and generates a formal Deal Room with digital contract terms.",
          hinglish: "'Accept' par click karte hi slot lock ho jata hai aur digital contract generate ho jata hai.",
        },
        uiRef: "AcceptApplicantButton",
      },
    ],
    rules: [
      {
        en: "Accepting an application commits one available slot in your campaign roster.",
        hinglish: "Application accept karne se campaign ka ek slot fill ho jata hai.",
      },
      {
        en: "Once all slots are accepted, the campaign brief automatically transitions from 'RECRUITING' to 'ACTIVE'.",
        hinglish: "Sabhi slots bharne par campaign automatically 'ACTIVE' status me chala jata hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Slot Fill Progress (e.g. 4/5 Filled)", hinglish: "Slot Fill Progress (jaise 4/5 Filled)" },
        description: {
          en: "Tracks accepted creators against total budgeted capacity.",
          hinglish: "Kitne creators accept ho chuke hain aur kitni seats bachi hain.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Cannot accept applicant; 'Slots Full' error", hinglish: "Accept nahi ho raha; 'Slots Full' ka error aa raha hai" },
        cause: { en: "All budgeted influencer slots have already been accepted", hinglish: "Campaign ke sabhi slots already bhar chuke hain" },
        fix: { en: "Edit the campaign budget to add more creator slots or decline an unconfirmed applicant", hinglish: "Campaign settings me jaakar slots badhayein ya kisi pending offer ko cancel karein" },
      },
    ],
    faqs: [],
    related: ["brand-deal-management", "brand-make-offer"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 6. Making an Offer
  {
    id: "brand-make-offer",
    roles: ["BRAND"],
    area: "deals",
    routes: ["/dashboard/influencers/[id]", "/dashboard/deals"],
    title: {
      en: "Making Direct Offers & Custom Invites",
      hinglish: "Direct Offers aur Custom Creator Invites",
    },
    summary: {
      en: "Send targeted commercial offers directly to specific creators outside public briefs with custom deliverables and fixed rates.",
      hinglish: "Kisi bhi creator ko direct custom collaboration offer bhejein aur private terms set karein.",
    },
    whenToUse: {
      en: "When you discover a top creator on the discovery feed and want to collaborate immediately without running a public brief.",
      hinglish: "Jab aapko koi specific creator pasand aaye aur aap use direct deal offer bhejna chahein.",
    },
    steps: [
      {
        title: {
          en: "Click 'Make Offer' on Creator Dossier",
          hinglish: "'Make Offer' par Click Karein",
        },
        body: {
          en: "From the creator's profile, click 'Make Offer'. Select an existing campaign brief or create a standalone 1-on-1 collaboration.",
          hinglish: "Creator profile se 'Make Offer' dabayein aur campaign select karein.",
        },
        uiRef: "MakeOfferModal",
      },
      {
        title: {
          en: "Specify Deliverables & Commercial Terms",
          hinglish: "Deliverables aur Amount Dalein",
        },
        body: {
          en: "Define the deliverable format (Reels, Shorts, Video), posting deadline, and offered payment in INR.",
          hinglish: "Video format, required date aur apna commercial offer amount enter karein.",
        },
      },
      {
        title: {
          en: "Send Invitation",
          hinglish: "Invitation Bhejein",
        },
        body: {
          en: "The creator receives an instant push and email alert. They have {{deals.signing_hours}} to accept or counter-propose.",
          hinglish: "Creator ko alert milta hai aur uske paas accept karne ke liye {{deals.signing_hours}} hote hain.",
        },
      },
    ],
    rules: [
      {
        en: "Direct offers expire automatically after {{deals.signing_hours}} if unresponded to by the creator.",
        hinglish: "Agar creator {{deals.signing_hours}} me respond nahi karta to invite expire ho jata hai.",
      },
    ],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["brand-deal-management", "brand-creator-dossier"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 7. Deals (Contract, Funding Escrow via Razorpay, Platform Fees 7-10%, XP/Referral, Milestones, Approvals, Auto-Approve, Refund)
  {
    id: "brand-deal-management",
    roles: ["BRAND"],
    area: "deals",
    routes: ["/dashboard/deals", "/dashboard/deals/[id]"],
    title: {
      en: "Deal Operations: Escrow Funding, Fee Tiers & Draft Reviews",
      hinglish: "Deal Operations: Escrow Funding, Fees aur Draft Review",
    },
    summary: {
      en: "Comprehensive guide to deal execution: Razorpay escrow deposit, 7–10% fee tiers, draft review approvals, auto-approve SLAs, and refund policies.",
      hinglish: "Deal lifecycle samjhein: Razorpay escrow funding, 7-10% fee tiers, draft review aur auto-approval.",
    },
    whenToUse: {
      en: "When an accepted application moves into deal execution, funding escrow, or reviewing submitted content drafts.",
      hinglish: "Jab deal confirm ho jaye aur aapko escrow fund karna ho ya creator ka draft check karna ho.",
    },
    steps: [
      {
        title: {
          en: "Countersign Digital Contract",
          hinglish: "Digital Contract Sign Karein",
        },
        body: {
          en: "Verify commercial terms, revision limits ({{deals.included_revisions}} included), and sign electronically within {{deals.signing_hours}}.",
          hinglish: "Terms verify karein aur {{deals.signing_hours}} ke andar contract electronically sign karein.",
        },
        uiRef: "DealContractCard",
      },
      {
        title: {
          en: "Fund Escrow via Razorpay",
          hinglish: "Razorpay se Escrow Fund Karein",
        },
        body: {
          en: "Deposit 100% of the deal payout into platform escrow using UPI, NetBanking, or Corporate Credit Card. Funds are held safely in custody.",
          hinglish: "UPI ya NetBanking se deal amount platform escrow me jama karein. Creator ko payment tabhi milegi jab aap draft approve karenge.",
        },
        uiRef: "FundEscrowButton",
      },
      {
        title: {
          en: "Review Creator Drafts within SLA",
          hinglish: "Creator Drafts ko Review Karein",
        },
        body: {
          en: "When a creator uploads preview links, review within {{deals.review_hours}}. Click 'Approve' to authorize public posting, or 'Request Revision' for minor edits.",
          hinglish: "Creator dwara draft aane par {{deals.review_hours}} me feedback dein. Kaam sahi ho to 'Approve' karein ya revision maangein.",
        },
        uiRef: "DraftReviewActionCard",
      },
      {
        title: {
          en: "Automated Escrow Release",
          hinglish: "Escrow Release aur Completion",
        },
        body: {
          en: "Once you approve the live published link (or upon the {{deals.auto_approve_hours}} review timeout), escrow releases to the creator wallet.",
          hinglish: "Live link approve hone par escrow payment creator ko release ho jati hai.",
        },
      },
    ],
    rules: [
      {
        en: "Platform fees range between {{fee.min}} and {{fee.brand_default}}. Achieving higher brand XP levels or referring peers reduces your effective fee towards {{fee.min}}.",
        hinglish: "Platform fee {{fee.min}} se {{fee.brand_default}} hoti hai, jo XP aur referral points se ghata kar {{fee.min}} tak ho sakti hai.",
      },
      {
        en: "Payment gateway processing fee is {{fee.gateway}} across standard corporate payment rails.",
        hinglish: "Standard payment gateway fee {{fee.gateway}} hoti hai.",
      },
      {
        en: "If a brand takes no action on a submitted draft within {{deals.auto_approve_hours}}, the system auto-approves the deliverable to protect creator livelihoods.",
        hinglish: "Agar brand {{deals.auto_approve_hours}} tak koi action nahi leta, to system creator ki payment auto-approve kar deta hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Included Revisions ({{deals.included_revisions}})", hinglish: "Included Revisions ({{deals.included_revisions}})" },
        description: {
          en: "Every deal legally includes {{deals.included_revisions}} minor feedback cycles. Additional revisions cost {{fee.extra_revision}} each to prevent scope creep.",
          hinglish: "Deal me {{deals.included_revisions}} free revisions shamil hain. Extra revision maangne par {{fee.extra_revision}} per edit lagta hai.",
        },
      },
      {
        label: { en: "Review Window ({{deals.review_hours}})", hinglish: "Review Window ({{deals.review_hours}})" },
        description: {
          en: "Mandatory SLA for brands to provide actionable feedback on submitted preview drafts.",
          hinglish: "Creator ke draft par feedback dene ke liye diya gaya maximum samay.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Draft auto-approved unexpectedly", hinglish: "Draft achanak auto-approve ho gaya" },
        cause: { en: "The {{deals.auto_approve_hours}} review countdown expired without brand approval or revision submission", hinglish: "{{deals.auto_approve_hours}} ka review countdown bina kisi feedback ke expire ho gaya" },
        fix: { en: "Always set calendar reminders upon receiving draft notification emails to review within 24–48 hours", hinglish: "Draft submit hone par turant email check karke 48 ghante me review karein" },
      },
    ],
    faqs: [
      {
        question: { en: "What if a creator fails to post after escrow is funded?", hinglish: "Agar creator deadline tak post na kare?" },
        answer: {
          en: "If the creator misses the agreed deadline without communication, you can trigger a 1-click refund to return 100% of escrow funds to your wallet.",
          hinglish: "Agar creator deadline miss karta hai to aap 100% escrow refund claim kar sakte hain.",
        },
      },
    ],
    related: ["brand-wallet-and-escrow", "brand-dispute-arbitration"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 8. Wallet (Add Funds, Withdrawals, Statements/Print)
  {
    id: "brand-wallet-and-escrow",
    roles: ["BRAND"],
    area: "wallet",
    routes: ["/dashboard/wallet"],
    title: {
      en: "Brand Wallet: Pre-Funding Escrow, Top-Ups & Financial Statements",
      hinglish: "Brand Wallet: Escrow Funding, Top-Up aur Statements",
    },
    summary: {
      en: "Add funds via Razorpay, manage pre-funded campaign reserves, initiate unallocated balance withdrawals, and print official financial ledgers.",
      hinglish: "Wallet me funds add karein, campaign budget reserve karein aur financial statements print karein.",
    },
    whenToUse: {
      en: "When adding funds for upcoming campaigns, checking escrow ledger splits, or exporting GST statement records.",
      hinglish: "Jab aapko wallet me paise add karne hon ya monthly account statement download karni ho.",
    },
    steps: [
      {
        title: {
          en: "Add Funds to Wallet Reserve",
          hinglish: "Wallet me Funds Add Karein",
        },
        body: {
          en: "Top up any amount between {{wallet.min_topup}} and {{wallet.max_topup}} via UPI, NetBanking, or corporate cards for instant deal checkout.",
          hinglish: "{{wallet.min_topup}} se lekar {{wallet.max_topup}} tak ka top-up karein taaki deals turant fund ho sakein.",
        },
        uiRef: "AddFundsModal",
      },
      {
        title: {
          en: "Inspect Ledger & Balances",
          hinglish: "Ledger aur Balances Dekhein",
        },
        body: {
          en: "Track unallocated Available Funds (ready for new deals or withdrawal) and In-Escrow Funds currently assigned to active creators.",
          hinglish: "Available Balance aur Active Escrow Balance ka separate hisaab dekhein.",
        },
        uiRef: "WalletBalancesWidget",
      },
      {
        title: {
          en: "Export Financial Statement",
          hinglish: "Statement Export Karein",
        },
        body: {
          en: "Download branded transaction receipts and monthly CSV/PDF ledgers complete with GSTIN breakdown for company accounting.",
          hinglish: "GST number ke sath official statement download karein jo accounting aur tax audit me kaam aati hai.",
        },
        uiRef: "ExportStatementsButton",
      },
    ],
    rules: [
      {
        en: "Unallocated wallet balances can be withdrawn back to the original source bank account within 2–4 business days.",
        hinglish: "Unallocated wallet balance ko aap kisi bhi samay apne source bank account me wapas transfer kar sakte hain.",
      },
      {
        en: "Funds locked in active escrow milestones cannot be withdrawn until deal completion or cancellation.",
        hinglish: "Jo paise active deals me lock hain, unhe deal khatam hone tak withdraw nahi kiya ja sakta.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Minimum Top-up ({{wallet.min_topup}})", hinglish: "Minimum Top-up ({{wallet.min_topup}})" },
        description: {
          en: "Smallest incremental deposit supported by the platform payment gateway.",
          hinglish: "Sabse chhota top-up amount jo aap wallet me add kar sakte hain.",
        },
      },
    ],
    commonErrors: [],
    faqs: [],
    related: ["brand-deal-management", "brand-finance-ca-export"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 9. Messages (Anti-Leak)
  {
    id: "brand-messaging-guidelines",
    roles: ["BRAND"],
    area: "messages",
    routes: ["/dashboard/messages"],
    title: {
      en: "Deal Messaging Protocols & Anti-Disintermediation Rules",
      hinglish: "Deal Chat Protocols aur Anti-Leak Niyam",
    },
    summary: {
      en: "Safely communicate creative feedback, schedule deliverable dates, and understand why off-platform contact sharing is restricted.",
      hinglish: "Creator ke sath brief discuss karein aur off-platform contact sharing ke niyam samjhein.",
    },
    whenToUse: {
      en: "When communicating with creators regarding content briefs, revision notes, or sample shipping.",
      hinglish: "Jab aap creator se content concept, sample shipping ya revision par baat kar rahe hon.",
    },
    steps: [
      {
        title: {
          en: "Communicate Exclusively In Deal Chat",
          hinglish: "Sirf Official Deal Chat me Baat Karein",
        },
        body: {
          en: "All messages are encrypted and timestamped. Official platform mediation relies strictly on in-app chat history in the event of a dispute.",
          hinglish: "Sabhi messages secure rehte hain. Kal ko dispute hone par mediator sirf in-app chat records ko valid saboot manta hai.",
        },
        uiRef: "DealChatFeed",
      },
      {
        title: {
          en: "Use Shipping Vault for Physical Products",
          hinglish: "Product Bhejne ke Liye Shipping Vault Use Karein",
        },
        body: {
          en: "Do not request phone numbers for couriers. Creators submit physical addresses via the Deal Room, which automatically integrates with Shiprocket.",
          hinglish: "Address mangne ke liye phone number na maangein; creator secure Shipping Vault me address daalta hai jisse Shiprocket tracking jud jati hai.",
        },
      },
    ],
    rules: [
      {
        en: "Solicting personal WhatsApp numbers or external bank payments triggers automated warning strikes and risks account suspension.",
        hinglish: "Bahar WhatsApp par payment lene ya dene ki baat karne par account par penalty lag sakti hai.",
      },
    ],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["brand-deal-management", "brand-dispute-arbitration"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 10. Disputes (Open, Evidence, Mediator, Outcomes)
  {
    id: "brand-dispute-arbitration",
    roles: ["BRAND"],
    area: "disputes",
    routes: ["/dashboard/deals/[id]/dispute", "/dashboard/disputes", "/dashboard/disputes/[id]"],
    title: {
      en: "Dispute Arbitration: Resolution Protocols & Refund Claims",
      hinglish: "Dispute Arbitration: Resolution aur Refund Claims",
    },
    summary: {
      en: "How to handle non-responsive creators, substandard deliverables, or contract breaches through impartial 3-tier arbitration.",
      hinglish: "Agar creator brief follow na kare ya kaam na kare to dispute kaise raise karein aur refund kaise paayein.",
    },
    whenToUse: {
      en: "When a creator stops communicating, refuses legitimate revisions, or delivers content violating agreed guidelines.",
      hinglish: "Jab creator brief ke anusar kaam na kare aur aapas me baat na ban rahi ho.",
    },
    steps: [
      {
        title: {
          en: "File Formal Dispute",
          hinglish: "Dispute File Karein",
        },
        body: {
          en: "Select dispute category (Missed Deadline, Breach of Brief, Plagiarism, Unresponsive) and summarize the breach.",
          hinglish: "Dispute category chunein aur batayein ki creator ne brief ki kaunsi term violate ki hai.",
        },
        uiRef: "DisputeWizardModal",
      },
      {
        title: {
          en: "Submit Brief Evidence",
          hinglish: "Brief aur Chat ke Saboot Dalein",
        },
        body: {
          en: "Upload original campaign guidelines, feedback messages, and screenshots demonstrating where the deliverable fell short.",
          hinglish: "Original brief, chat screenshots aur feedback proof attach karein.",
        },
      },
      {
        title: {
          en: "Mediator Ruling & Escrow Disposition",
          hinglish: "Mediator ka Final Decision",
        },
        body: {
          en: "Neutral platform mediators evaluate the documentary record to rule on a 100% refund, reshoot mandate, or proportional split.",
          hinglish: "Platform mediator saboot dekh kar 100% refund ya proportional payment split decide karta hai.",
        },
      },
    ],
    rules: [
      {
        en: "Escrow funds remain 100% protected and frozen during dispute proceedings until an official verdict is rendered.",
        hinglish: "Dispute chalte waqt payment lock rehti hai taaki kisi ka nuksaan na ho.",
      },
    ],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["brand-deal-management"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 11. Campaign Analytics Hub (Overview, Funnel, Creators Table, Finance, Audience; what "Estimated" means)
  {
    id: "brand-campaign-analytics-hub",
    roles: ["BRAND"],
    area: "analytics",
    routes: ["/dashboard/campaigns/[id]/analytics"],
    title: {
      en: "Campaign Analytics Hub: Funnels, Creator Tables & Financial Ledgers",
      hinglish: "Campaign Analytics Hub: Funnels, Creator Stats aur Finance",
    },
    summary: {
      en: "Deep-dive into 5 analytics views: Overview KPIs, Conversion Funnel, Creator Performance Matrix, Audience Demographics, and Financial Reconciliations.",
      hinglish: "5 tabs me campaign performance samjhein: Overview, Funnel, Creators Matrix, Audience Demographics aur Finance.",
    },
    whenToUse: {
      en: "When analyzing aggregate campaign ROI, tracking creator-by-creator view deliveries, or auditing campaign financial ledgers.",
      hinglish: "Jab aapko campaign ki overall performance, views, ROI aur financial statements check karne hon.",
    },
    steps: [
      {
        title: {
          en: "Overview Tab: Macro KPIs",
          hinglish: "Overview Tab: Top KPIs",
        },
        body: {
          en: "Inspect aggregate views, blended Cost-Per-View (CPV), total engagement count, and overall campaign delivery percentage.",
          hinglish: "Kul views, average CPV, total engagement aur delivery progress ek nazar me dekhein.",
        },
        uiRef: "OverviewTab",
      },
      {
        title: {
          en: "Creators Tab: Creator Performance Matrix",
          hinglish: "Creators Tab: Har Creator ki Performance",
        },
        body: {
          en: "Sort creators by Views Delivered, Individual CPV, and DRS Score. Quickly identify top-performing ambassadors for future retainer deals.",
          hinglish: "Creators ko views aur CPV ke hisaab se sort karein aur top performers ko identify karein.",
        },
        uiRef: "CreatorsTable",
      },
      {
        title: {
          en: "Finance Tab: Escrow & Tax Breakdown",
          hinglish: "Finance Tab: Tax aur Payment Breakdown",
        },
        body: {
          en: "Review gross creator payouts, Section 194-O TDS deductions, platform fees, and export complete CA-ready accounting tables.",
          hinglish: "Gross payout, TDS deduction aur platform fee ka detailed audit hisaab dekhein.",
        },
        uiRef: "FinanceTab",
      },
    ],
    rules: [
      {
        en: "Metrics labeled 'ESTIMATED' indicate posts awaiting final API batch indexing or newly published reels.",
        hinglish: "'ESTIMATED' tag ka matlab hai ki post ka live API sync abhi process ho raha hai.",
      },
      {
        en: "Audience demographic cards remain hidden until aggregated campaign views reach statistical significance (minimum 1,000 views).",
        hinglish: "Jab tak campaign me kam se kam 1,000 views na ho jayein, demographic cards privacy aur accuracy ke liye hide rehte hain.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Blended CPV (Cost Per View)", hinglish: "Blended CPV (Cost Per View)" },
        description: {
          en: "Total verified campaign spend divided by cumulative verified organic post views.",
          hinglish: "Kul kharch ko kul verified views se divide karke nikali gayi per-view cost.",
        },
      },
    ],
    commonErrors: [],
    faqs: [],
    related: ["brand-campaign-roi-reports", "brand-finance-ca-export"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 12. Campaign ROI Report (CPV vs Category Benchmark, ROI Score Bands, Data Quality)
  {
    id: "brand-campaign-roi-reports",
    roles: ["BRAND"],
    area: "analytics",
    routes: ["/dashboard/campaigns/[id]/roi"],
    title: {
      en: "Campaign ROI Valuation & Category Benchmark Comparison",
      hinglish: "Campaign ROI Valuation aur Category Benchmarks",
    },
    summary: {
      en: "Benchmark your campaign CPV against industry category averages (Finance ₹1.20, Tech ₹0.65, Fashion ₹0.25) and interpret ROI score bands.",
      hinglish: "Apne campaign CPV ko industry benchmark se compare karein aur ROI Score bands samjhein.",
    },
    whenToUse: {
      en: "When presenting marketing efficiency to leadership or assessing whether your campaign delivered above-market return.",
      hinglish: "Jab aapko leadership ko campaign ki marketing efficiency aur cost savings dikhani hon.",
    },
    steps: [
      {
        title: {
          en: "Compare Delivered CPV vs Benchmark",
          hinglish: "Delivered CPV ko Benchmark se Milayein",
        },
        body: {
          en: "The ROI engine benchmarks your delivered CPV against seeded industry category averages (e.g. Beauty ₹0.30 vs Gaming ₹0.18).",
          hinglish: "Engine aapke actual CPV ko category ke standard benchmark se compare karke efficiency score deta hai.",
        },
        uiRef: "CategoryBenchmarkCard",
      },
      {
        title: {
          en: "Interpret ROI Score Bands",
          hinglish: "ROI Score Bands Samjhein",
        },
        body: {
          en: "Scores are banded into: Poor (<40), Fair (40–59), Good (60–79), and Excellent (80–100) based on commercial efficiency.",
          hinglish: "Scores 4 categories me hote hain: Poor (<40), Fair (40-59), Good (60-79) aur Excellent (80-100).",
        },
        uiRef: "RoiScoreGauge",
      },
    ],
    rules: [
      {
        en: "ROI calculations are deterministic and adhere strictly to basis point precision without fabricated estimates.",
        hinglish: "ROI calculation pure mathematical formulas par based hota hai bina kisi artificial guess ke.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "ROI Score (80–100: Excellent)", hinglish: "ROI Score (80–100: Excellent)" },
        description: {
          en: "Achieved when delivered CPV is significantly cheaper than industry paid media baselines.",
          hinglish: "Jab aapko standard market rate se kafi kam cost me zyada views milte hain.",
        },
      },
    ],
    commonErrors: [],
    faqs: [],
    related: ["brand-campaign-analytics-hub", "brand-performance-report-modal"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 13. Finance Tab & CA-Ready CSV (GST, TDS, FY)
  {
    id: "brand-finance-ca-export",
    roles: ["BRAND"],
    area: "compliance",
    routes: ["/dashboard/campaigns/[id]/analytics", "/dashboard/wallet"],
    title: {
      en: "CA-Ready Financial Ledger & Tax Export (GST & TDS)",
      hinglish: "CA-Ready Financial Ledger aur Tax Export (GST aur TDS)",
    },
    summary: {
      en: "Download chartered accountant-ready CSV spreadsheets reconciling gross deals, GST breakdown, Section 194-O TDS withholdings, and net remittances.",
      hinglish: "CA aur audit ke liye official CSV download karein jisme GST, TDS aur deal transactions ka poora hisaab hota hai.",
    },
    whenToUse: {
      en: "During monthly book closing, GST return filing, or annual financial audits.",
      hinglish: "Mahine ke aakhri me ya GST return bharte waqt jab company ke accounts ko reconcile karna ho.",
    },
    steps: [
      {
        title: {
          en: "Navigate to Campaign Finance Tab",
          hinglish: "Finance Tab me Jayein",
        },
        body: {
          en: "Open the Campaign Analytics Hub and switch to the 'Finance' tab to inspect line-item deal ledgers.",
          hinglish: "Campaign Analytics me jakar 'Finance' tab kholein aur transaction details check karein.",
        },
        uiRef: "FinanceTab",
      },
      {
        title: {
          en: "Export CA-Ready CSV",
          hinglish: "CA-Ready CSV Export Karein",
        },
        body: {
          en: "Click 'Export Finance CSV' to download a structured spreadsheet compatible with Tally and ERP systems containing GSTIN, PAN, and TDS details.",
          hinglish: "'Export CSV' par tap karke Tally-compatible spreadsheet download karein.",
        },
        uiRef: "ExportFinanceCsvButton",
      },
    ],
    rules: [
      {
        en: "Financial exports are generated in integer paise and converted to standard 2-decimal INR upon export.",
        hinglish: "Sabhi exports exact paise precision se calculate hote hain taaki koi rounding mismatch na ho.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Section 194-O Withholding", hinglish: "Section 194-O Withholding" },
        description: {
          en: "Statutory {{tax.tds_194o}} TDS deduction deposited on behalf of creators with the Indian Income Tax Department.",
          hinglish: "Creator ki kamai se kata gaya {{tax.tds_194o}} TDS jo govt portal par record hota hai.",
        },
      },
    ],
    commonErrors: [],
    faqs: [],
    related: ["brand-campaign-analytics-hub", "brand-wallet-and-escrow"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 14. Branded Campaign Performance Report (Print/Save PDF, Report ID, Integrity Code, Verify Page)
  {
    id: "brand-performance-report-modal",
    roles: ["BRAND"],
    area: "analytics",
    routes: ["/dashboard/campaigns/[id]/analytics", "/verify-report/[id]"],
    title: {
      en: "Branded Performance Reports & Public Integrity Verification",
      hinglish: "Official Branded Performance Report aur Verification",
    },
    summary: {
      en: "Generate high-resolution executive PDF reports with PLATFORM_CONFIG letterheads, cryptographic SHA-256 integrity hashes, and public /verify-report auditing.",
      hinglish: "Executive PDF presentation report download karein aur cryptographic verification code se authenticity prove karein.",
    },
    whenToUse: {
      en: "When creating formal post-campaign decks for C-suite stakeholders, agency clients, or external audits.",
      hinglish: "Jab clients ya senior management ko official verified campaign report present karni ho.",
    },
    steps: [
      {
        title: {
          en: "Click 'Export Performance PDF'",
          hinglish: "'Export Performance PDF' par Click Karein",
        },
        body: {
          en: "From the Campaign Analytics Hub header, click 'Download Report'. The system renders an executive ReportShell document.",
          hinglish: "Analytics header se 'Download Report' click karein; document executive layout me taiyar ho jata hai.",
        },
        uiRef: "CampaignPerformanceReportModal",
      },
      {
        title: {
          en: "Inspect Cryptographic Report ID",
          hinglish: "Unique Report ID aur QR Code Check Karein",
        },
        body: {
          en: "Locate the unique Report ID (e.g. VM-PERF-202611-X1Y2Z3) and SHA-256 hash printed on the official letterhead footer.",
          hinglish: "Document ke footer me tamper-proof Report ID aur QR code check karein.",
        },
        uiRef: "ReportFooter",
      },
      {
        title: {
          en: "Audit via Public Verification Portal",
          hinglish: "Public Portal se Audit Karein",
        },
        body: {
          en: "Any stakeholder can scan the QR code or visit /verify-report/[id] to independently confirm that the numbers match VyaparMedia's database.",
          hinglish: "Koi bhi client /verify-report par jakar confirm kar sakta hai ki report numbers 100% genuine hain.",
        },
      },
    ],
    rules: [
      {
        en: "Any post-generation modification of the PDF invalidates the cryptographic signature during verification checks.",
        hinglish: "PDF me koi bhi badlav karne par verification portal use 'Tampered / Invalid' dikha dega.",
      },
    ],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["brand-campaign-analytics-hub", "brand-campaign-roi-reports"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 15. Brand Analytics Dashboard (Spend, Campaign Interest, Profile Visibility)
  {
    id: "brand-analytics-dashboard",
    roles: ["BRAND"],
    area: "analytics",
    routes: ["/dashboard/analytics"],
    title: {
      en: "Brand Macro Analytics: Total Spend, Reach & Pipeline Health",
      hinglish: "Brand Macro Analytics: Kul Spend, Reach aur Growth",
    },
    summary: {
      en: "Track multi-campaign spend velocity, cumulative audience reach, creator retention rates, and annual financial allocations.",
      hinglish: "Apne sabhi campaigns ka total spend, cumulative audience reach aur creator partnerships track karein.",
    },
    whenToUse: {
      en: "When reviewing high-level marketing spend trends across quarterly and annual commercial cycles.",
      hinglish: "Jab aapko pooray saal ya quarterly marketing spend aur ROI ka overall overview dekhna ho.",
    },
    steps: [
      {
        title: {
          en: "Inspect Multi-Campaign Spend Metrics",
          hinglish: "Total Spend Metrics Check Karein",
        },
        body: {
          en: "Analyze your cumulative deployed escrow, completed deal count, and blended CPM/CPV trends over time.",
          hinglish: "Ab tak ka total kharch, completed deals ki sankhya aur average CPV trend dekhein.",
        },
        uiRef: "BrandSpendAnalyticsCard",
      },
      {
        title: {
          en: "Review Creator Network Retention",
          hinglish: "Creator Retention aur Repeat Collaborations",
        },
        body: {
          en: "Track which influencers deliver the highest repeat ROI and establish recurring retainer partnerships.",
          hinglish: "Dekhein kin creators ke sath kaam karke sabse best results mile taaki unhe repeat hire kar sakein.",
        },
      },
    ],
    rules: [],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["brand-campaign-analytics-hub", "brand-wallet-and-escrow"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 16. Verification / KYC (PAN / GST)
  {
    id: "brand-verification-kyc",
    roles: ["BRAND"],
    area: "kyc",
    routes: ["/dashboard/settings"],
    title: {
      en: "Business Verification, GSTIN & Corporate Tax Compliance",
      hinglish: "Business Verification, GSTIN aur Corporate Tax",
    },
    summary: {
      en: "Link corporate PAN, verify GSTIN certificates, and establish verified enterprise brand status for large-budget escrow campaigns.",
      hinglish: "Company PAN aur GSTIN verify karein taaki bade budget ke campaigns aasaani se launch ho sakein.",
    },
    whenToUse: {
      en: "When completing enterprise brand onboarding or enabling GST tax invoicing.",
      hinglish: "Jab company ka account verify karna ho aur tax invoices enable karne hon.",
    },
    steps: [
      {
        title: {
          en: "Verify Corporate PAN",
          hinglish: "Company PAN Verify Karein",
        },
        body: {
          en: "Enter your 10-digit company PAN. Instant automated verification aligns company legal entity names.",
          hinglish: "Company ka PAN number dalein; instant verification se registered naam confirm ho jata hai.",
        },
        uiRef: "CorporatePanCard",
      },
      {
        title: {
          en: "Link GSTIN for Input Tax Credit (ITC)",
          hinglish: "Input Tax Credit (ITC) ke Liye GSTIN Jodein",
        },
        body: {
          en: "Provide your 15-digit state GSTIN. Invoices automatically include your GST details for input tax credit claims.",
          hinglish: "15-digit GSTIN dalein taaki har invoice par company ka GST number chhap kar aaye.",
        },
        uiRef: "GstinInputCard",
      },
    ],
    rules: [
      {
        en: "GSTIN state code must match your corporate billing address registration.",
        hinglish: "GSTIN ka state code aapke billing address ke state se match hona chahiye.",
      },
    ],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["brand-finance-ca-export", "brand-wallet-and-escrow"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 17. Settings (Profile, Security, Notifications, Telemetry Consent)
  {
    id: "brand-settings-profile",
    roles: ["BRAND"],
    area: "security",
    routes: ["/dashboard/settings", "/dashboard/notifications"],
    title: {
      en: "Brand Settings: Team Security, 2FA & Telemetry Preferences",
      hinglish: "Brand Settings: Security, 2FA aur Privacy Preferences",
    },
    summary: {
      en: "Configure brand profile details, secure financial transactions with TOTP 2FA, customize notification routing, and manage telemetry consent.",
      hinglish: "Brand profile update karein, 2FA lagakar wallet safe karein aur notifications control karein.",
    },
    whenToUse: {
      en: "When updating company logos, securing payouts, or customizing team alert preferences.",
      hinglish: "Jab company details badalni hon ya account security majboot karni ho.",
    },
    steps: [
      {
        title: {
          en: "Enable 2FA Authenticator",
          hinglish: "2FA Authenticator On Karein",
        },
        body: {
          en: "Protect escrow releases and bank refunds by scanning the TOTP QR code with Google Authenticator or Microsoft Authenticator.",
          hinglish: "Google Authenticator scan karke 2FA activate karein taaki koi unapproved refund na ho sake.",
        },
        uiRef: "TwoFactorAuthCard",
      },
      {
        title: {
          en: "Manage Notification Triggers",
          hinglish: "Notification Triggers Set Karein",
        },
        body: {
          en: "Set instant email and push alerts for draft submissions, revision responses, and escrow funding updates.",
          hinglish: "Draft submissions aur deal alerts ke liye email aur browser push notifications configure karein.",
        },
      },
    ],
    rules: [],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["brand-verification-kyc", "brand-dashboard-overview"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 18. Support Desk
  {
    id: "brand-support-escalation",
    roles: ["BRAND"],
    area: "general",
    routes: ["/dashboard/support"],
    title: {
      en: "Brand Priority Support & Concierge Assistance",
      hinglish: "Brand Priority Support aur Concierge Help",
    },
    summary: {
      en: "Access dedicated enterprise support for billing inquiries, custom contract terms, escrow inquiries, and technical assistance.",
      hinglish: "Billing, custom contracts ya technical help ke liye priority brand support ticket raise karein.",
    },
    whenToUse: {
      en: "When experiencing billing questions, invoice customizations, or requiring urgent mediation.",
      hinglish: "Jab aapko payment, invoice ya platform workflow me kisi help ki zaroorat ho.",
    },
    steps: [
      {
        title: {
          en: "Open Priority Support Ticket",
          hinglish: "Priority Support Ticket Kholein",
        },
        body: {
          en: "Select topic (Escrow Funding, Campaign Assistance, Invoicing/GST, Technical) and specify affected campaign or deal IDs.",
          hinglish: "Category select karein aur affected campaign ya deal ID mention karke ticket submit karein.",
        },
        uiRef: "CreateTicketForm",
      },
    ],
    rules: [],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["brand-dashboard-overview"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 19. Leaderboard / Referrals
  {
    id: "brand-referrals-leaderboard",
    roles: ["BRAND"],
    area: "general",
    routes: ["/dashboard/referrals", "/dashboard/leaderboard"],
    title: {
      en: "Brand Partner Referrals & Platform Fee Reductions",
      hinglish: "Brand Referrals aur Platform Fee Discounts",
    },
    summary: {
      en: "Invite peer brands or partner creators to earn platform fee discounts that drive your standard fee down towards the {{fee.min}} floor.",
      hinglish: "Dusre brands ko invite karein aur apni platform fee ko ghata kar {{fee.min}} tak le aayein.",
    },
    whenToUse: {
      en: "When sharing your brand invitation link to lower future campaign transaction costs.",
      hinglish: "Jab aap platform referral link share karke future deals par fee discount kamana chahein.",
    },
    steps: [
      {
        title: {
          en: "Share Brand Invite Link",
          hinglish: "Brand Invite Link Share Karein",
        },
        body: {
          en: "Copy your custom referral code from the Referrals dashboard and share with industry founders or marketing colleagues.",
          hinglish: "Referrals page se apna invite link copy karke marketing contacts ke sath share karein.",
        },
        uiRef: "ReferralShareCard",
      },
      {
        title: {
          en: "Track Fee Reductions",
          hinglish: "Fee Reductions Track Karein",
        },
        body: {
          en: "Monitor how referee volume discounts lower your standard {{fee.brand_default}} fee towards the {{fee.min}} enterprise tier.",
          hinglish: "Dekhein kitne brands jud gaye aur aapki platform fee kitni discount hui.",
        },
      },
    ],
    rules: [
      {
        en: "Platform fees can never fall below the absolute statutory minimum floor of {{fee.min}}.",
        hinglish: "Platform fee kisi bhi discount ke baad bhi {{fee.min}} se kam nahi ho sakti.",
      },
    ],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["brand-deal-management"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 20. Compliance (ASCI / CCPA Disclosure Enforcement, What Brand Must Do)
  {
    id: "brand-compliance-asci-ccpa",
    roles: ["BRAND"],
    area: "compliance",
    routes: ["/dashboard/deals", "/dashboard/campaigns/[id]"],
    title: {
      en: "Brand Advertising Compliance: ASCI & CCPA 2024 Legal Mandates",
      hinglish: "Advertising Compliance: ASCI aur CCPA 2024 Kanoon",
    },
    summary: {
      en: "Understand mandatory Indian advertising laws (CCPA 2024 & ASCI): ensuring creator captions contain prominent #ad disclosures, 30-day retention, and brand liability protections.",
      hinglish: "Samjhein ki kanoonan brand ke liye #ad disclosure kyu anivarya hai aur CCPA penalties se kaise bachein.",
    },
    whenToUse: {
      en: "When drafting campaign content briefs and reviewing creator post previews prior to final milestone sign-off.",
      hinglish: "Jab campaign brief likh rahe hon ya creator ka live post review kar rahe hon.",
    },
    steps: [
      {
        title: {
          en: "Mandate #ad in Campaign Briefs",
          hinglish: "Brief me #ad Disclosure Zaroori Likhein",
        },
        body: {
          en: "Under ASCI & Central Consumer Protection Authority (CCPA) 2024 norms, all sponsored posts must feature clear disclosures (#ad, #collab, or #sponsored) above the fold.",
          hinglish: "Brief guidelines me likhein ki caption ki pehli line me #ad ya #collab hona anivarya hai.",
        },
        uiRef: "AsciComplianceBanner",
      },
      {
        title: {
          en: "Verify Prominence During Draft Review",
          hinglish: "Draft Review karte waqt Prominence Check Karein",
        },
        body: {
          en: "Ensure disclosure tags appear within the first 150 characters (before the 'more' button) and do not use forbidden abbreviations like #sp or #partner.",
          hinglish: "Check karein ki #ad pehle 150 characters me ho aur #sp jaise ambiguous short forms na hon.",
        },
      },
      {
        title: {
          en: "Understand Automated 30-Day Post Monitoring",
          hinglish: "30-Din ka Post Monitoring Samjhein",
        },
        body: {
          en: "VyaparMedia's crawler monitors live posts for {{deals.post_monitoring_days}} days. If a creator deletes the post or removes #ad, an automated 24-hour notice and escrow clawback safeguard your brand.",
          hinglish: "Platform {{deals.post_monitoring_days}} din tak crawler se post monitor karta hai taaki koi post delete na kare.",
        },
      },
    ],
    rules: [
      {
        en: "Brands are jointly liable under CCPA regulations if commercial influencer advertisements fail to disclose brand sponsorship clearly.",
        hinglish: "Kanoonan brand aur creator dono par penalty lag sakti hai agar post par #ad na likha ho.",
      },
      {
        en: "Posts must remain publicly accessible for at least {{deals.post_monitoring_days}} days post-publication.",
        hinglish: "Post ko kam se kam {{deals.post_monitoring_days}} din tak public rakhna agreement ke anusar anivarya hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "150-Character Rule", hinglish: "150-Character Rule" },
        description: {
          en: "Disclosures must be prominent and instantly visible without user interaction on mobile devices.",
          hinglish: "Mobile screen par bina 'more' dabaye pehli nazar me sponsorship dikhni chahiye.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Post crawler warns 'Ambiguous Tag Detected'", hinglish: "Crawler ne 'Ambiguous Tag' flag kiya" },
        cause: { en: "Creator used #spon or #partner instead of explicit #ad or #sponsored tags", hinglish: "Creator ne #sp ya #partner likha jo ASCI guidelines me mana hai" },
        fix: { en: "Instruct creator to edit caption line 1 to include explicit #ad or #collab", hinglish: "Creator ko chat me bol kar line 1 me explicit #ad add karwayein" },
      },
    ],
    faqs: [
      {
        question: { en: "Does using Instagram's Paid Partnership label satisfy ASCI?", hinglish: "Kya Instagram ka Paid Partnership label lagana kaafi hai?" },
        answer: {
          en: "Yes! Enabling Instagram's native Paid Partnership tag or placing #ad in the caption satisfies both ASCI and CCPA rules.",
          hinglish: "Haan! Instagram ka native Paid Partnership tag lagana ya caption me #ad likhna dono valid hain.",
        },
      },
    ],
    related: ["brand-deal-management", "brand-campaign-creation"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
];
