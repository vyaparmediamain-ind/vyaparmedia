import type { Guide } from "@/lib/guides/schema";

export const INFLUENCER_GUIDES: Guide[] = [
  // 1. Home / Command Center & Escrow Stories Bar
  {
    id: "influencer-dashboard-overview",
    roles: ["INFLUENCER"],
    area: "general",
    routes: ["/dashboard"],
    title: {
      en: "Home Command Center & Escrow Stories Bar",
      hinglish: "Home Command Center aur Escrow Stories Bar",
    },
    summary: {
      en: "Navigate your active collaborations, live story milestones, pending actions, and instant wallet overview.",
      hinglish: "Apne active deals, live story status, pending tasks aur wallet balance ko ek jagah samjhein.",
    },
    whenToUse: {
      en: "When you first open the dashboard and want a quick snapshot of what requires your attention today.",
      hinglish: "Jab aap dashboard kholein aur dekhna chahein ki aaj kaunsi deals ya submissions pending hain.",
    },
    steps: [
      {
        title: {
          en: "Inspect Escrow Stories Bar",
          hinglish: "Escrow Stories Bar Check Karein",
        },
        body: {
          en: "The top horizontal carousel presents Instagram-style rings showing deal stages: Applied (25%), Escrow Locked (55%), In Review (75%), and Approved (90%).",
          hinglish: "Upar ki story rings aapke har deal ka real-time status dikhati hain: Applied (25%), Escrow Locked (55%), Review (75%) aur Approved (90%).",
        },
        uiRef: "EscrowStoriesBar",
      },
      {
        title: {
          en: "Check Priority Action Feed",
          hinglish: "Priority Action Items Dekhein",
        },
        body: {
          en: "Tasks are sorted by deadline urgency. Always prioritize signing contracts within {{deals.signing_hours}} or submitting drafts before review cutoffs.",
          hinglish: "Zaroori kaam deadline ke anusar arranged hain. {{deals.signing_hours}} me contract sign karna aur draft submit karna sabse pehle karein.",
        },
        uiRef: "PriorityActionFeed",
      },
      {
        title: {
          en: "Monitor Fast Wallet Totals",
          hinglish: "Wallet Balances Par Najar Rakhein",
        },
        body: {
          en: "The overview shows Available Balance (ready to withdraw) and In-Escrow Balance (funds locked by brands for current deliverables).",
          hinglish: "Yahan Available Balance (jo nikal sakte hain) aur In-Escrow Balance (jo brand ne safe lock kiya hai) saaf dikhta hai.",
        },
        uiRef: "WalletSummaryWidget",
      },
    ],
    rules: [
      {
        en: "Contracts must be digitally countersigned within {{deals.signing_hours}} or invitations automatically expire.",
        hinglish: "Contract {{deals.signing_hours}} ke andar sign karna anivarya hai, warna deal automatically cancel ho jati hai.",
      },
      {
        en: "Brand must pre-fund platform escrow before creator is obligated to commence production.",
        hinglish: "Brand dwara escrow me paise jama karne se pehle creator ko kaam shuru karne ki zaroorat nahi hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Escrow Locked Ring", hinglish: "Escrow Locked Ring" },
        description: {
          en: "Shows 55% progress in blue when the brand has deposited 100% funds into platform custody.",
          hinglish: "Blue ring tab dikhti hai jab brand ne 100% payment platform escrow me jama kar di hoti hai.",
        },
      },
      {
        label: { en: "Active Collaborations", hinglish: "Active Collaborations" },
        description: {
          en: "Total count of accepted deals currently moving through contract, production, or post-monitoring phases.",
          hinglish: "Un sabhi deals ki sankhya jin par abhi kaam ya review chal raha hai.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Deal card shows amber warning ring", hinglish: "Deal card par yellow warning ring dikh rahi hai" },
        cause: { en: "Draft deadline or brand revision window is expiring in less than 12 hours", hinglish: "Draft jama karne ya revision ka samay 12 ghante se kam bacha hai" },
        fix: { en: "Click directly on the story bubble to open the Deal Room and upload your deliverables", hinglish: "Story icon par tap karke Deal Room kholein aur draft turant upload karein" },
      },
    ],
    faqs: [
      {
        question: { en: "Can a brand cancel a deal after funds are locked in escrow?", hinglish: "Kya brand escrow lock hone ke baad deal cancel kar sakta hai?" },
        answer: {
          en: "No. Once funds are deposited in escrow, unilateral cancellation is blocked. Any cancellation requires mutual consent or formal dispute arbitration.",
          hinglish: "Nahi. Escrow lock hone ke baad brand akele cancel nahi kar sakta; cancel karne ke liye mutual agreement ya dispute zaroori hai.",
        },
      },
    ],
    related: ["influencer-deal-lifecycle", "influencer-discover-campaigns"],
    supportCta: {
      label: { en: "Contact Help Desk", hinglish: "Help Desk se Baat Karein" },
      href: "/dashboard/support",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 2. Discover Campaigns (Filters, Search, Bookmarks, Match Score)
  {
    id: "influencer-discover-campaigns",
    roles: ["INFLUENCER"],
    area: "campaigns",
    routes: ["/dashboard/campaigns"],
    title: {
      en: "Discovering Campaigns, Search Filters & Match Scores",
      hinglish: "Campaigns Khojna, Search Filters aur Match Score",
    },
    summary: {
      en: "Find curated brand campaigns, understand AI match percentages, bookmark prospects, and apply smart filters.",
      hinglish: "Apni category ke brand campaigns dhoondhein, match score samjhein aur favorite deals bookmark karein.",
    },
    whenToUse: {
      en: "When looking for brand sponsorships that fit your content niche, platform format, and follower count.",
      hinglish: "Jab aapko naye paid sponsorship offers dhoondhne ho jo aapke audience se match karte hon.",
    },
    steps: [
      {
        title: {
          en: "Search & Quick Filters",
          hinglish: "Search aur Quick Filters",
        },
        body: {
          en: "Search by brand name or keyword, and toggle platform filters (Instagram Reels, Stories, YouTube Shorts, Long-form).",
          hinglish: "Brand name ya keyword type karein aur Instagram Reels ya YouTube ke filters select karein.",
        },
        uiRef: "DiscoverySearchInput",
      },
      {
        title: {
          en: "Interpret AI Match Score Badge",
          hinglish: "AI Match Score Badge Samjhein",
        },
        body: {
          en: "Each campaign card features a 0-100% Match Badge calculated from your audience category, location, and past engagement rates.",
          hinglish: "Har campaign par 0-100% ka match score hota hai jo aapke category aur audience engagement par depend karta hai.",
        },
        uiRef: "CampaignMatchBadge",
      },
      {
        title: {
          en: "Bookmark Opportunities",
          hinglish: "Campaigns Bookmark Karein",
        },
        body: {
          en: "Click the bookmark ribbon on any card to save campaigns to your personal shortlist for review before deadlines.",
          hinglish: "Bookmark icon par click karke campaigns ko save karein taaki aap baad me aasaani se apply kar sakein.",
        },
        uiRef: "BookmarkButton",
      },
    ],
    rules: [
      {
        en: "Creators must have at least {{deals.min_followers}} verified followers to apply to campaigns.",
        hinglish: "Campaign me apply karne ke liye account me kam se kam {{deals.min_followers}} followers hone anivarya hain.",
      },
      {
        en: "Campaign budgets displayed are strictly escrow-guaranteed totals.",
        hinglish: "Card par dikhaya gaya budget platform escrow me 100% backed hota hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Match Percentage (e.g. 92% Match)", hinglish: "Match Percentage (jaise 92% Match)" },
        description: {
          en: "Indicates historical suitability based on niche alignment, audience location overlap, and content format compatibility.",
          hinglish: "Yeh batata hai ki brand ki requirements aapke channel ke niche aur audience se kitni match karti hain.",
        },
      },
      {
        label: { en: "Spots Left (e.g. 3 of 10 filled)", hinglish: "Bachi Hui Seats (jaise 3 of 10 filled)" },
        description: {
          en: "The number of creator slots remaining open in this campaign brief before it automatically locks.",
          hinglish: "Is campaign me kitne aur creators approve kiye ja sakte hain.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Campaign card shows 'Not Eligible'", hinglish: "Card par 'Not Eligible' likha aa raha hai" },
        cause: { en: "Your connected platform followers are below {{deals.min_followers}} or category does not match", hinglish: "Aapke followers {{deals.min_followers}} se kam hain ya brand ne alag category maangi hai" },
        fix: { en: "Connect and refresh your active Instagram/YouTube account in Settings ➔ Social Accounts", hinglish: "Settings me Social Accounts me jaakar apna account sync karein" },
      },
    ],
    faqs: [
      {
        question: { en: "Does a high match score guarantee acceptance?", hinglish: "Kya high match score se selection pakka hota hai?" },
        answer: {
          en: "No. A high match score highlights strong compatibility, but the brand ultimately selects creators based on pitch quality and portfolio.",
          hinglish: "Nahi, high match score aapke chances badhata hai, lekin final decision brand aapke pitch aur video quality ko dekh kar leta hai.",
        },
      },
    ],
    related: ["influencer-campaign-application", "influencer-dashboard-overview"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 3. Applying to a Campaign (Pitch, Proposed Rate, MarketRangeCard)
  {
    id: "influencer-campaign-application",
    roles: ["INFLUENCER"],
    area: "campaigns",
    routes: ["/dashboard/campaigns/[id]"],
    title: {
      en: "Applying to Campaigns, Pricing Quotes & Pitch Strategy",
      hinglish: "Campaign me Apply Karna, Rate Quote aur Pitch",
    },
    summary: {
      en: "Submit custom quotes assisted by the Estimated Market Range card, craft persuasive creative proposals, and avoid rejections.",
      hinglish: "Estimated Market Range card ki madad se sahi rate quote karein aur strong proposal pitch bhejein.",
    },
    whenToUse: {
      en: "When viewing a specific campaign detail page and preparing to submit your application.",
      hinglish: "Jab aap kisi campaign brief page par hon aur apply karne ka form bhar rahe hon.",
    },
    steps: [
      {
        title: {
          en: "Review Brief & Deliverables",
          hinglish: "Brief aur Deliverables Padhein",
        },
        body: {
          en: "Carefully read content guidelines, required hashtags, do's & don'ts, and publishing deadlines before applying.",
          hinglish: "Brand ki requirements, hashtags aur guidelines ko dhyaan se check karein.",
        },
        uiRef: "CampaignBriefView",
      },
      {
        title: {
          en: "Consult Estimated Market Range Hint",
          hinglish: "Estimated Market Range Hint Dekhein",
        },
        body: {
          en: "The Estimated Market Range Card displays your recommended pricing band (e.g. ₹4,000 – ₹7,500). Quoting within this band maximizes your acceptance chances.",
          hinglish: "Card par aapke channel ka recommended price range dikhta hai. Iske andar quote karne par brand acceptance rate sabse high hota hai.",
        },
        uiRef: "MarketRangeCard",
      },
      {
        title: {
          en: "Write Concept Pitch & Submit Quote",
          hinglish: "Creative Pitch aur Quote Dalein",
        },
        body: {
          en: "Detail your concept angle, attach links to 1-2 top performing past reels, and input your proposed commercial rate.",
          hinglish: "Apna creative idea batayein, 1-2 best reels ke link add karein aur apna proposed rate submit karein.",
        },
        uiRef: "ApplicationProposalForm",
      },
    ],
    rules: [
      {
        en: "Never quote below standard minimums or promise artificial bot views/likes.",
        hinglish: "Fake views ya likes ka wada karna strict platform ban ka karan ban sakta hai.",
      },
      {
        en: "Do not include personal contact details (phone, email, WhatsApp) inside the proposal pitch text.",
        hinglish: "Proposal pitch ke andar apna phone number ya email likhna allowed nahi hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Proposed Commercial Rate", hinglish: "Proposed Commercial Rate" },
        description: {
          en: "The total gross payment in INR you are quoting to complete all specified deliverables.",
          hinglish: "Wo poora amount jo aap is campaign ke sabhi deliverables ke liye charge karna chahte hain.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Submit Application button is grayed out", hinglish: "Submit button par click nahi ho raha" },
        cause: { en: "Proposed rate is missing or pitch description is shorter than 20 characters", hinglish: "Rate enter nahi kiya ya pitch description bohot chhota hai" },
        fix: { en: "Enter a valid quote in INR and write at least two sentences describing your content idea", hinglish: "Valid amount likhein aur kam se kam 2-3 lines me apna idea describe karein" },
      },
    ],
    faqs: [
      {
        question: { en: "Can I edit my pitch after submitting?", hinglish: "Kya submit karne ke baad pitch edit kar sakte hain?" },
        answer: {
          en: "Yes. As long as the application remains in 'PENDING' review state, you can update your proposed quote and pitch.",
          hinglish: "Haan, jab tak brand ne aapka proposal accept ya reject nahi kiya, aap use edit kar sakte hain.",
        },
      },
    ],
    related: ["influencer-applications-tracker", "influencer-discover-campaigns"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 4. Applications Tracker (Statuses, Withdrawal)
  {
    id: "influencer-applications-tracker",
    roles: ["INFLUENCER"],
    area: "campaigns",
    routes: ["/dashboard/applications"],
    title: {
      en: "Applications Tracker: Statuses & Proposal Withdrawal",
      hinglish: "Applications Tracker: Status aur Proposal Withdraw",
    },
    summary: {
      en: "Track all pending, shortlisted, accepted, and archived proposals with full transparency.",
      hinglish: "Apne sabhi applications ka status track karein aur chahein to proposal withdraw karein.",
    },
    whenToUse: {
      en: "When checking whether brands have reviewed your submissions or when withdrawing an outdated quote.",
      hinglish: "Jab dekhna ho ki brand ne proposal dekha ya nahi, ya date clash hone par application wapas leni ho.",
    },
    steps: [
      {
        title: {
          en: "Filter by Status Tab",
          hinglish: "Status Tabs se Filter Karein",
        },
        body: {
          en: "Tabs categorize applications into Pending Review, Shortlisted, Accepted (deals ready to sign), and Rejected.",
          hinglish: "Tabs ke zariye Pending, Shortlisted, Accepted aur Rejected applications ko alag alag dekhein.",
        },
        uiRef: "ApplicationStatusTabs",
      },
      {
        title: {
          en: "Withdraw Unaccepted Proposal",
          hinglish: "Proposal Withdraw Karein",
        },
        body: {
          en: "If your availability changes before a brand accepts, click 'Withdraw Application' to immediately retract your pitch without penalty.",
          hinglish: "Agar aap busy hain ya date clash ho rahi hai, to 'Withdraw' par click karke application bina penalty ke hata sakte hain.",
        },
        uiRef: "WithdrawProposalButton",
      },
    ],
    rules: [
      {
        en: "Once a brand accepts your application, it converts into a legal deal and cannot be unilaterally withdrawn.",
        hinglish: "Brand dwara accept hone ke baad application deal ban jati hai aur seedha withdraw nahi ki ja sakti.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Shortlisted Status", hinglish: "Shortlisted Status" },
        description: {
          en: "Means the brand has bookmarked your profile as a final contender while finalizing their roster.",
          hinglish: "Iska matlab hai ki brand ko aapka profile pasand aaya hai aur final selection chal raha hai.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Cannot withdraw an application", hinglish: "Withdraw option nahi dikh raha" },
        cause: { en: "The brand has already accepted your pitch, moving the deal to contract signing stage", hinglish: "Brand ne application accept kar li hai aur deal contract stage par pohnch chuki hai" },
        fix: { en: "Navigate to Dashboard ➔ Deals to review the contract or message the brand directly", hinglish: "Deals page par jaakar contract check karein ya brand ko message karein" },
      },
    ],
    faqs: [
      {
        question: { en: "Does withdrawing hurt my DRS trust score?", hinglish: "Kya withdraw karne se DRS score kam hota hai?" },
        answer: {
          en: "No. Withdrawing pending applications carries zero penalty. Only abandoning signed deals damages your DRS.",
          hinglish: "Nahi. Pending application withdraw karne se koi penalty nahi lagti; sirf signed deal todne par DRS kam hota hai.",
        },
      },
    ],
    related: ["influencer-campaign-application", "influencer-deal-lifecycle"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 5. Deals List & Deal Room (Milestone Timeline, Contract Signing, Vault, Revisions, Auto-Approve, Escrow)
  {
    id: "influencer-deal-lifecycle",
    roles: ["INFLUENCER"],
    area: "deals",
    routes: ["/dashboard/deals", "/dashboard/deals/[id]"],
    title: {
      en: "Deal Lifecycle, Contract Signing & Escrow Milestones",
      hinglish: "Deal Lifecycle, Contract Sign aur Escrow Milestones",
    },
    summary: {
      en: "Master the complete deal room lifecycle: digital contract signing, deliverable timeline, draft vault, and automated escrow payouts.",
      hinglish: "Deal room ke har step ko samjhein: digital contract, draft submission, brand revision aur auto-approval.",
    },
    whenToUse: {
      en: "When you have an active deal and need to sign contracts, review milestones, or inspect payment schedules.",
      hinglish: "Jab aapki deal confirm ho jaye aur aapko contract sign karna ya delivery process dekhni ho.",
    },
    steps: [
      {
        title: {
          en: "Digital Contract Signing",
          hinglish: "Digital Agreement Sign Karein",
        },
        body: {
          en: "Inspect deliverables, commercial payout, and dates. Type your legal name to electronically sign within {{deals.signing_hours}}.",
          hinglish: "Sabhi terms aur amount verify karein. {{deals.signing_hours}} ke andar apna digital signature submit karein.",
        },
        uiRef: "DealContractCard",
      },
      {
        title: {
          en: "Monitor Milestone Timeline",
          hinglish: "Milestone Timeline Track Karein",
        },
        body: {
          en: "Follow progress markers: Contract Signed ➔ Escrow Deposited ➔ Draft Submitted ➔ Approved ➔ Payout Released.",
          hinglish: "Timeline markers follow karein: Contract ➔ Escrow Funding ➔ Draft ➔ Approval ➔ Payment.",
        },
        uiRef: "DealMilestoneTracker",
      },
      {
        title: {
          en: "Manage Revisions & Approvals",
          hinglish: "Revisions aur Approvals",
        },
        body: {
          en: "Brands get {{deals.review_hours}} to review drafts. Every deal includes {{deals.included_revisions}} free revisions; extra revisions cost {{fee.extra_revision}} each to the brand.",
          hinglish: "Brand ke paas review ke liye {{deals.review_hours}} hote hain. Har deal me {{deals.included_revisions}} free revisions hote hain.",
        },
        uiRef: "RevisionManagerCard",
      },
      {
        title: {
          en: "Automated Payout Release",
          hinglish: "Automatic Payment Release",
        },
        body: {
          en: "Once approved (or after the {{deals.auto_approve_hours}} auto-approval countdown), escrow releases immediately to your Available Balance.",
          hinglish: "Approval milte hi (ya {{deals.auto_approve_hours}} ke auto-approve timeout ke baad) payment turant wallet me release ho jati hai.",
        },
        uiRef: "EscrowLedgerCard",
      },
    ],
    rules: [
      {
        en: "Digital contract must be signed within {{deals.signing_hours}} by both creator and brand.",
        hinglish: "Contract {{deals.signing_hours}} ke andar dono taraf se sign hona anivarya hai.",
      },
      {
        en: "If a brand fails to review submitted drafts within {{deals.auto_approve_hours}}, the system auto-approves and unlocks funds.",
        hinglish: "Agar brand {{deals.auto_approve_hours}} me draft review nahi karta, to system auto-approve karke funds release kar deta hai.",
      },
      {
        en: "Posts must remain live publicly for {{deals.post_monitoring_days}} per agreement terms.",
        hinglish: "Agreement ke anusar post ko kam se kam {{deals.post_monitoring_days}} tak live rakhna anivarya hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Review Window ({{deals.review_hours}})", hinglish: "Review Window ({{deals.review_hours}})" },
        description: {
          en: "Standard duration granted to the brand to inspect drafts and request valid revisions.",
          hinglish: "Brand ko draft check karke feedback dene ke liye diya gaya samay.",
        },
      },
      {
        label: { en: "Included Revisions ({{deals.included_revisions}})", hinglish: "Included Revisions ({{deals.included_revisions}})" },
        description: {
          en: "Number of minor adjustment cycles included in the base deal before additional fees apply.",
          hinglish: "Base deal me shamil minor changes ki sankhya jinke liye koi extra charge nahi lagta.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Submit Draft button is locked", hinglish: "Submit Draft button par lock laga hai" },
        cause: { en: "Brand has not completed escrow deposit into platform custody yet", hinglish: "Brand ne abhi tak escrow me paise transfer nahi kiye hain" },
        fix: { en: "Wait for the 'Escrow Funded' badge to illuminate before producing or uploading deliverables", hinglish: "'Escrow Funded' status green hone ka intezar karein, tabhi kaam shuru karein" },
      },
    ],
    faqs: [
      {
        question: { en: "What deductions happen upon payout?", hinglish: "Payment aane par kya deductions hote hain?" },
        answer: {
          en: "Platform fee of {{fee.min}} and statutory TDS of {{tax.tds_194o}} (under Section 194-O) are deducted, and the net balance is credited instantly to your wallet.",
          hinglish: "Platform fee {{fee.min}} aur Section 194-O ke tahat {{tax.tds_194o}} TDS deduct hoke net amount aapke wallet me jama hota hai.",
        },
      },
    ],
    related: ["influencer-content-submission", "influencer-wallet-and-taxes", "influencer-dispute-resolution"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 6. Submitting Content Correctly (Post URL, ASCI/CCPA Disclosures)
  {
    id: "influencer-content-submission",
    roles: ["INFLUENCER"],
    area: "deals",
    routes: ["/dashboard/deals", "/dashboard/deals/[id]"],
    title: {
      en: "Content Submission Vault & ASCI/CCPA Compliance",
      hinglish: "Content Submission aur ASCI/CCPA Niyam",
    },
    summary: {
      en: "Submit draft preview links, upload high-res files, and comply with mandatory ASCI/CCPA advertising disclosure rules.",
      hinglish: "Apna video draft sahi tarike se submit karein aur ASCI #ad disclosure ke kanoon follow karein.",
    },
    whenToUse: {
      en: "When your video or photo deliverable is ready for review or when posting live on social channels.",
      hinglish: "Jab aapka video draft taiyar ho ya brand se approval milne ke baad live post submit karni ho.",
    },
    steps: [
      {
        title: {
          en: "Upload Unlisted/Draft Preview",
          hinglish: "Draft Preview Link Submit Karein",
        },
        body: {
          en: "Upload your video to Google Drive, Dropbox, or YouTube Unlisted and paste the link in the Submission Vault for brand review.",
          hinglish: "Apna video Drive ya unlisted YouTube par upload karke draft link submit karein.",
        },
        uiRef: "ContentSubmissionModal",
      },
      {
        title: {
          en: "Apply ASCI/CCPA Disclosure (#ad)",
          hinglish: "ASCI/CCPA Disclosure (#ad) Lagayein",
        },
        body: {
          en: "Under Indian consumer protection laws (CCPA 2024 & ASCI), your caption must feature #ad, #collab, #sponsored, or #paidpartnership above the fold (within the first 150 characters).",
          hinglish: "Niyam ke mutabik caption ke shuruat me (pehli 150 characters me) #ad ya #sponsored likhna zaroori hai.",
        },
        uiRef: "AsciComplianceBanner",
      },
      {
        title: {
          en: "Submit Final Live URL",
          hinglish: "Final Live Post URL Dalein",
        },
        body: {
          en: "After brand approval, publish the post publicly and paste the exact Instagram reel or YouTube permalink into the Live Link field.",
          hinglish: "Approval ke baad video public karein aur exact live URL platform par daal kar verify karein.",
        },
        uiRef: "LiveUrlVerificationInput",
      },
    ],
    rules: [
      {
        en: "Disclosure tags (#ad, #collab) must appear within the first 150 characters or on the first line—never buried under 'more'.",
        hinglish: "Disclosure tag (#ad) caption ki pehli line me hona chahiye, neeche chhipa hua nahi hona chahiye.",
      },
      {
        en: "Ambiguous abbreviations like #sp, #spon, or #partner are strictly prohibited under ASCI guidelines.",
        hinglish: "#sp ya #partner jaise short forms use karna kanoonan mana hai; poora #ad ya #collab likhein.",
      },
      {
        en: "Our automated crawler verifies live posts continuously for {{deals.post_monitoring_days}} days. Removing #ad triggers a 24-hour warning followed by escrow freeze.",
        hinglish: "Platform {{deals.post_monitoring_days}} din tak post monitor karta hai. #ad hatane par 24 ghante ka notice milta hai, fir escrow freeze ho jata hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "150-Character Prominence Rule", hinglish: "150-Character Prominence Rule" },
        description: {
          en: "Legal mandate ensuring viewers see commercial sponsorship disclosures without having to expand the caption.",
          hinglish: "Kanooni niyam taaki user ko 'more' dabaye bina pehli jhalak me sponsorship dikh jaye.",
        },
      },
      {
        label: { en: "30-Day Retention Window", hinglish: "30-Day Retention Window" },
        description: {
          en: "The agreed contract timeframe ({{deals.post_monitoring_days}} days) during which the sponsored content must stay publicly accessible.",
          hinglish: "Wo samay jisme sponsored video ko account par public rakhna zaroori hota hai.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Crawler flags 'ASCI Disclosure Missing'", hinglish: "Crawler ne 'ASCI Disclosure Missing' flag kiya" },
        cause: { en: "#ad tag was placed at the very bottom of a long caption or omitted entirely", hinglish: "#ad tag caption ke aakhri me likha tha ya bilkul bhool gaye the" },
        fix: { en: "Edit the caption on Instagram/YouTube immediately to place #ad on line 1, then click 'Re-verify' in Deal Room", hinglish: "Instagram par post edit karke line 1 me #ad likhein aur Deal Room me 'Re-verify' click karein" },
      },
    ],
    faqs: [
      {
        question: { en: "Can I delete or archive the post after payment?", hinglish: "Kya payment aane ke baad post archive kar sakte hain?" },
        answer: {
          en: "No. Deleting or archiving before {{deals.post_monitoring_days}} days breaches contract terms and triggers an automated platform clawback.",
          hinglish: "Nahi. {{deals.post_monitoring_days}} din se pehle post delete ya archive karne par payment wapas maangi ja sakti hai aur account flag ho sakta hai.",
        },
      },
    ],
    related: ["influencer-deal-lifecycle", "influencer-dispute-resolution"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 7. Messages (Anti-Leak Rules, What Happens on Contact Sharing)
  {
    id: "influencer-messaging-rules",
    roles: ["INFLUENCER"],
    area: "messages",
    routes: ["/dashboard/messages"],
    title: {
      en: "Deal Messaging & Contact Anti-Leak Protection",
      hinglish: "Deal Chat aur Contact Anti-Leak Protection",
    },
    summary: {
      en: "Communicate securely with brands, understand real-time contact leak detection, and protect your escrow dispute rights.",
      hinglish: "Brand ke sath secure chat karein, contact leak detection samjhein aur apni payment safe rakhein.",
    },
    whenToUse: {
      en: "When messaging brands to discuss creative briefs, sample shipping, or deliverable scheduling.",
      hinglish: "Jab aap brand ke sath chat me content idea ya product dispatch par baat kar rahe hon.",
    },
    steps: [
      {
        title: {
          en: "Keep All Negotiations In Chat",
          hinglish: "Saari Baatein Chat Me Hi Rakhein",
        },
        body: {
          en: "Every message is encrypted and legally binding. If an issue arises later, platform mediators only evaluate in-app chat history.",
          hinglish: "Har message legally recorded hota hai. Kal ko dispute hone par mediator sirf in-app chat ke saboot manta hai.",
        },
        uiRef: "DealChatFeed",
      },
      {
        title: {
          en: "Understand Real-Time Anti-Leak Warnings",
          hinglish: "Anti-Leak Warning Nudge Samjhein",
        },
        body: {
          en: "Typing phone numbers, emails, WhatsApp handles, or payment details triggers an inline warning banner explaining why off-platform deals are unsafe.",
          hinglish: "Phone number ya WhatsApp type karte hi warning banner aayega jo batata hai ki bahar deal karna risky hai.",
        },
        uiRef: "ContactLeakWarningBanner",
      },
    ],
    rules: [
      {
        en: "Attempting to circumvent platform escrow by sharing external contact or UPI IDs leads to account reputation strikes.",
        hinglish: "Platform ko bypass karke bahar payment lene ki koshish karne par account par strike lag sakti hai.",
      },
      {
        en: "Off-platform promises or agreements made on WhatsApp are completely inadmissible during dispute arbitration.",
        hinglish: "WhatsApp ya phone par hui baatein dispute ke time valid saboot nahi maani jaati.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "3-Strike Policy", hinglish: "3-Strike Policy" },
        description: {
          en: "Accounts repeatedly attempting contact disintermediation face temporary suspension followed by permanent platform debarment.",
          hinglish: "Baar baar contact leak karne par 3 strikes ke baad account hamesha ke liye block ho sakta hai.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Message contains a red contact warning badge", hinglish: "Message bhejte waqt red warning badge aaya" },
        cause: { en: "Detector noticed phone numbers, homoglyph spellings (e.g. 'nine eight...'), or external links", hinglish: "System ne phone number ya words me likha number detect kiya" },
        fix: { en: "Keep communications strictly inside VyaparMedia chat to maintain 100% escrow protection", hinglish: "Bahar baat karne ke bajaye chat me hi brief finalize karein" },
      },
    ],
    faqs: [
      {
        question: { en: "How should brands send physical products?", hinglish: "Brand product kaise bhejega bina phone number ke?" },
        answer: {
          en: "Use the built-in Shipping Vault in the Deal Room. You submit your delivery address securely, and the brand receives automated Shiprocket tracking.",
          hinglish: "Deal Room me secure Shipping Vault hota hai jahan aap apna address daal sakte hain aur tracking seedhi jud jati hai.",
        },
      },
    ],
    related: ["influencer-deal-lifecycle", "influencer-dispute-resolution"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 8. Wallet (Balances, Withdrawals, IMPS Limits, Bank Add/Verify)
  {
    id: "influencer-wallet-and-taxes",
    roles: ["INFLUENCER"],
    area: "wallet",
    routes: ["/dashboard/wallet"],
    title: {
      en: "Wallet Earnings, Bank Accounts & IMPS Withdrawals",
      hinglish: "Wallet Earnings, Bank Khata aur IMPS Withdrawals",
    },
    summary: {
      en: "Understand Available vs In-Escrow balances, add verified bank accounts via penny-drop, and request instant IMPS payouts.",
      hinglish: "Available aur Escrow balance ka farak samjhein, bank account verify karein aur turant payout paayein.",
    },
    whenToUse: {
      en: "When managing your earnings, linking a new bank account, or transferring funds to your personal bank.",
      hinglish: "Jab aapko apne kamaye hue paise apne bank account me nikalne hon.",
    },
    steps: [
      {
        title: {
          en: "Distinguish Balance Types",
          hinglish: "Dono Balances ko Samjhein",
        },
        body: {
          en: "Available Balance is settled money you can withdraw right now. In-Escrow Balance is funds deposited by brands for ongoing, unapproved deliverables.",
          hinglish: "Available Balance aap turant withdraw kar sakte hain. In-Escrow Balance wo hai jo brand ne deals ke liye lock kiya hua hai.",
        },
        uiRef: "WalletBalanceHeader",
      },
      {
        title: {
          en: "Link Verified Bank Account",
          hinglish: "Bank Account Add aur Verify Karein",
        },
        body: {
          en: "Provide Account Number and IFSC. An automated penny-drop (₹1 deposit) verifies legal name alignment within 30 seconds.",
          hinglish: "Account number aur IFSC dalein. Automated penny-drop se aapka naam bank se verify ho jayega.",
        },
        uiRef: "BankAccountsCard",
      },
      {
        title: {
          en: "Request Instant IMPS Payout",
          hinglish: "Instant Payout Request Karein",
        },
        body: {
          en: "Enter an amount between {{wallet.min_withdrawal}} and {{wallet.max_withdrawal}}. Funds transfer automatically via RazorpayX into your bank.",
          hinglish: "{{wallet.min_withdrawal}} se lekar {{wallet.max_withdrawal}} tak amount chunein aur 'Withdraw' par tap karein.",
        },
        uiRef: "WithdrawModal",
      },
    ],
    rules: [
      {
        en: "Minimum payout threshold is {{wallet.min_withdrawal}} to minimize banking network transaction overhead.",
        hinglish: "Kam se kam withdrawal limit {{wallet.min_withdrawal}} rakhi gayi hai.",
      },
      {
        en: "Bank account holder name must match your KYC verified PAN name to prevent fraud.",
        hinglish: "Bank account ka naam aapke PAN card ke naam se match hona anivarya hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Available Balance", hinglish: "Available Balance" },
        description: {
          en: "Net funds credited from successfully completed deals, free of encumbrances and ready for withdrawal.",
          hinglish: "Completed deals se aayi hui net kamai jo turant bank transfer ke liye ready hai.",
        },
      },
      {
        label: { en: "Minimum Withdrawal ({{wallet.min_withdrawal}})", hinglish: "Minimum Withdrawal ({{wallet.min_withdrawal}})" },
        description: {
          en: "Smallest single withdrawal request allowed by the platform payment processor.",
          hinglish: "Sabse chhota payout jo aap ek baar me nikal sakte hain.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Penny-drop verification fails", hinglish: "Bank verify nahi ho pa raha" },
        cause: { en: "Name mismatch between bank records and KYC PAN or invalid IFSC code", hinglish: "Bank me registered naam aur PAN card ka naam alag hai ya IFSC galat hai" },
        fix: { en: "Ensure your savings account is in your own legal name and re-check IFSC", hinglish: "Apna personal account use karein aur passbook se dekhkar IFSC re-enter karein" },
      },
    ],
    faqs: [
      {
        question: { en: "Are there withdrawal fees?", hinglish: "Kya withdrawal karne par koi charges lagte hain?" },
        answer: {
          en: "Standard IMPS bank transfers are completely free for creators.",
          hinglish: "Creators ke liye IMPS bank transfer par platform koi charge nahi leta.",
        },
      },
    ],
    related: ["influencer-taxes-compliance", "influencer-deal-lifecycle"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 9. Taxes (TDS 194-O, 206AA, FY Reports /api/reports/influencer/income)
  {
    id: "influencer-taxes-compliance",
    roles: ["INFLUENCER"],
    area: "compliance",
    routes: ["/dashboard/wallet", "/dashboard/settings"],
    title: {
      en: "Indian Tax Compliance: TDS Section 194-O, 206AA & Income Reports",
      hinglish: "Tax Compliance: TDS Section 194-O, 206AA aur Income Reports",
    },
    summary: {
      en: "Learn how Section 194-O TDS works, avoid {{tax.tds_206aa}} penal rates by linking PAN, and export annual Financial Year tax summaries.",
      hinglish: "Section 194-O TDS samjhein, {{tax.tds_206aa}} penal rate se bachein aur annual tax reports download karein.",
    },
    whenToUse: {
      en: "When reviewing tax deductions on your deal payouts or generating certificates for your annual ITR filing.",
      hinglish: "Jab ITR bharte samay tax reports download karni hon ya TDS deduction check karni ho.",
    },
    steps: [
      {
        title: {
          en: "Link Verified PAN Card",
          hinglish: "Verified PAN Card Link Karein",
        },
        body: {
          en: "Navigate to Settings ➔ Verification and link your 10-digit PAN. This ensures tax is deducted at the concessional rate of {{tax.tds_194o}} under Section 194-O.",
          hinglish: "Settings me jakar apna PAN link karein taaki sirf {{tax.tds_194o}} TDS kate, na ki penal {{tax.tds_206aa}}.",
        },
        uiRef: "TaxComplianceCard",
      },
      {
        title: {
          en: "Understand TDS Thresholds",
          hinglish: "TDS Threshold Samjhein",
        },
        body: {
          en: "Under Income Tax Act Section 393(1) (formerly 194-O), TDS applies once creator gross sales cross {{tax.tds_threshold}} in a financial year.",
          hinglish: "Financial year me {{tax.tds_threshold}} cross hone par e-commerce guidelines ke anusar {{tax.tds_194o}} TDS deduct hota hai.",
        },
      },
      {
        title: {
          en: "Download Annual Income & Tax Reports",
          hinglish: "Annual Income aur TDS Report Download Karein",
        },
        body: {
          en: "Export branded CSV or PDF summaries via /api/reports/influencer/income showing gross deal values, TDS deducted, and quarterly breakdowns for easy CA filing.",
          hinglish: "Wallet page se branded tax summary download karein jisme har deal ka TDS record hota hai.",
        },
        uiRef: "ExportTaxReportButton",
      },
    ],
    rules: [
      {
        en: "If no verified PAN is linked, Section 206AA mandates a penal withholding tax of {{tax.tds_206aa}}.",
        hinglish: "Agar PAN link nahi hai to Section 206AA ke tahat {{tax.tds_206aa}} penal TDS kaata jata hai.",
      },
      {
        en: "All TDS deducted by the platform is deposited with the Government of India and reflects in your Form 26AS / AIS.",
        hinglish: "Kaata gaya saara TDS government ko jama hota hai aur aapke Form 26AS me credit dikhta hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Section 194-O TDS ({{tax.tds_194o}})", hinglish: "Section 194-O TDS ({{tax.tds_194o}})" },
        description: {
          en: "Concessional tax deduction rate for creators with a verified PAN linked to their account.",
          hinglish: "Verified PAN wale creators ke liye standard tax deduction rate.",
        },
      },
      {
        label: { en: "Penal 206AA Rate ({{tax.tds_206aa}})", hinglish: "Penal 206AA Rate ({{tax.tds_206aa}})" },
        description: {
          en: "Heavy statutory withholding rate applied when identity credentials or PAN are unverified.",
          hinglish: "Bina PAN wale accounts par lagne wala high tax rate.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Penal TDS {{tax.tds_206aa}} deducted instead of {{tax.tds_194o}}", hinglish: "Kam TDS ki jagah penal {{tax.tds_206aa}} TDS cut gaya" },
        cause: { en: "PAN was unverified or marked unlinked at the moment of escrow disbursement", hinglish: "Payment release ke waqt account me PAN verify nahi tha" },
        fix: { en: "Link your PAN in Settings immediately. Deducted tax can still be claimed as refund in your annual ITR", hinglish: "Turant PAN link karein; kata hua extra TDS aap ITR file karke govt se refund le sakte hain" },
      },
    ],
    faqs: [
      {
        question: { en: "Can I claim back TDS deducted on VyaparMedia?", hinglish: "Kya kata hua TDS wapas mil sakta hai?" },
        answer: {
          en: "Yes. When you file your annual Income Tax Return (ITR), the TDS deposited in your PAN will be adjusted against your tax liability or refunded to your bank.",
          hinglish: "Haan, annual ITR file karte waqt ye TDS aapki tax liability se adjust ho jata hai ya refund mil jata hai.",
        },
      },
    ],
    related: ["influencer-wallet-and-taxes", "influencer-settings-profile"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 10. Disputes (Open, Evidence, Mediator, Outcomes)
  {
    id: "influencer-dispute-resolution",
    roles: ["INFLUENCER"],
    area: "disputes",
    routes: ["/dashboard/deals/[id]/dispute", "/dashboard/disputes", "/dashboard/disputes/[id]"],
    title: {
      en: "Dispute Arbitration, Evidence & Resolution Protocol",
      hinglish: "Dispute Arbitration, Saboot aur Resolution",
    },
    summary: {
      en: "How to open a formal dispute, submit deliverable evidence, collaborate with human mediators, and protect your escrow payout.",
      hinglish: "Agar brand anuchit behave kare to dispute kaise file karein aur mediation se settlement kaise paayein.",
    },
    whenToUse: {
      en: "When a brand unreasonably rejects completed deliverables, demands out-of-scope work, or ceases communication.",
      hinglish: "Jab brand valid draft ko reject kare ya aapas me baat solve na ho paaye.",
    },
    steps: [
      {
        title: {
          en: "Open Dispute Case",
          hinglish: "Dispute Case File Karein",
        },
        body: {
          en: "From the Deal Room menu, select 'Open Dispute'. Choose category: Unfair Rejection, Unreasonable Revisions, or Unresponsive Brand.",
          hinglish: "Deal Room me jakar 'Open Dispute' chunein aur sahi category select karein.",
        },
        uiRef: "DisputeWizardModal",
      },
      {
        title: {
          en: "Submit Tangible Evidence",
          hinglish: "Proof aur Deliverables Submit Karein",
        },
        body: {
          en: "Upload unedited drafts, brand chat screenshots, and delivery receipts proving you satisfied all brief terms.",
          hinglish: "Apna video file, chat proofs aur timestamps upload karein jo saabit karein ki kaam sahi tha.",
        },
        uiRef: "DisputeEvidenceVault",
      },
      {
        title: {
          en: "Mediator Review & Binding Settlement",
          hinglish: "Mediator Review aur Final Verdict",
        },
        body: {
          en: "A neutral platform arbitrator evaluates the contract brief against your submissions to issue a binding payout or split release.",
          hinglish: "Platform ka neutral mediator dono taraf ki baatein dekhkar fair decision aur payment release karta hai.",
        },
        uiRef: "ArbitrationDecisionCard",
      },
    ],
    rules: [
      {
        en: "Escrow funds are 100% frozen during an active dispute; neither party can withdraw until resolution.",
        hinglish: "Dispute chalte waqt payment lock rehti hai; koi bhi party use akele nahi nikaal sakti.",
      },
      {
        en: "Filing frivolous or malicious disputes penalizes your DRS trust score.",
        hinglish: "Bina wajah galat dispute raise karne par DRS score par negative impact padta hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "72-Hour Response Window", hinglish: "72-Hour Response Window" },
        description: {
          en: "Both parties are given 72 hours to supply documentary evidence before mediator analysis begins.",
          hinglish: "Saboot jama karne ke liye dono parties ko 72 ghante ka samay diya jata hai.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Dispute rejected by mediator", hinglish: "Dispute reject ho gaya" },
        cause: { en: "Submissions lacked agreed deliverables or evidence was hosted externally without access", hinglish: "Diye gaye links private the ya contract requirements poori nahi thi" },
        fix: { en: "Always attach direct public preview links and highlight specific contract clauses in your statement", hinglish: "Links public rakhein aur brief ki specific lines mention karke batayein" },
      },
    ],
    faqs: [
      {
        question: { en: "Can a dispute result in partial payout?", hinglish: "Kya dispute me partial payment mil sakti hai?" },
        answer: {
          en: "Yes. Mediators often order fair escrow splits (e.g. 70% to creator for effort, 30% refund to brand) if brief ambiguities existed.",
          hinglish: "Haan. Agar brief me confusion tha, to mediator fair split (jaise 70% creator ko aur 30% brand ko) decide kar sakta hai.",
        },
      },
    ],
    related: ["influencer-deal-lifecycle", "influencer-messaging-rules"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 11. Badges & DRS Score (What Moves It)
  {
    id: "influencer-drs-and-badges",
    roles: ["INFLUENCER"],
    area: "profile",
    routes: ["/dashboard/badges"],
    title: {
      en: "DRS™ Trust Score ({{drs.min}}-{{drs.max}}), Badges & Progression",
      hinglish: "DRS™ Trust Score ({{drs.min}}-{{drs.max}}), Badges aur Levels",
    },
    summary: {
      en: "Understand your Dynamic Reputation Score, tier limits, what triggers score drops, and how to unlock fee discounts.",
      hinglish: "Jaaniye DRS score ({{drs.min}}-{{drs.max}}) kaise badhta hai, deals ki limit kya hai aur badges kaise unlock karein.",
    },
    whenToUse: {
      en: "When checking your trust score tier, unlocked achievement badges, and single-deal budget eligibility.",
      hinglish: "Jab aapko apna reputation score aur bade campaigns ke liye eligibility check karni ho.",
    },
    steps: [
      {
        title: {
          en: "Inspect DRS Score Gauge",
          hinglish: "DRS Score Meter Dekhein",
        },
        body: {
          en: "Your score ranges from {{drs.min}} to {{drs.max}} (default is {{drs.default}}). Scores above {{drs.tier_normal}} unlock trusted high-ticket campaigns.",
          hinglish: "Aapka score {{drs.min}} se {{drs.max}} ke beech hota hai (default {{drs.default}}). {{drs.tier_normal}}+ score par high-ticket deals milti hain.",
        },
        uiRef: "DrsScoreGauge",
      },
      {
        title: {
          en: "Understand What Increases Your DRS",
          hinglish: "DRS Score Kaise Badhta Hai",
        },
        body: {
          en: "Submitting drafts on time, maintaining 5-star brand reviews, and completing deals above {{drs.qualified_deal}} grant bonus credibility points.",
          hinglish: "Time par draft submit karne, achhe reviews paane aur {{drs.qualified_deal}} se badi deals complete karne par points badhte hain.",
        },
      },
      {
        title: {
          en: "Unlock Rarity Badges",
          hinglish: "Rarity Badges Haasil Karein",
        },
        body: {
          en: "Collect milestone badges such as 'On-Time Legend', 'Zero Dispute Master', and 'Brand Magnet' to boost profile visibility in discovery.",
          hinglish: "'On-Time Legend' aur 'Zero Dispute Master' jaise badges jeet kar brand discovery me top par aayein.",
        },
        uiRef: "BadgeGrid",
      },
    ],
    rules: [
      {
        en: "Late draft submissions reduce DRS by 15 points per delayed milestone.",
        hinglish: "Deadline miss karne par har baar 15 points deduct hote hain.",
      },
      {
        en: "Accounts below {{drs.tier_flagged}} have single-deal value capped at ₹0 (locked for review).",
        hinglish: "{{drs.tier_flagged}} se kam score hone par account temporary review me lock ho jata hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Reputation Tiers", hinglish: "Reputation Tiers" },
        description: {
          en: "Flagged (<{{drs.tier_flagged}}), Limited (<{{drs.tier_limited}}), Normal (<{{drs.tier_normal}}), and Trusted ({{drs.tier_normal}}+).",
          hinglish: "Flagged (<{{drs.tier_flagged}}), Limited (<{{drs.tier_limited}}), Normal (<{{drs.tier_normal}}), aur Trusted ({{drs.tier_normal}}+).",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "DRS score dropped unexpectedly", hinglish: "DRS score achanak gir gaya" },
        cause: { en: "A deal milestone crossed its deadline without submitting or a dispute was decided against you", hinglish: "Koi deal deadline miss hui thi ya dispute me brand ki side uphold hui" },
        fix: { en: "Complete your next 3 deals ahead of schedule to trigger the rapid recovery algorithm", hinglish: "Agli 3 deals time se pehle deliver karein, score tezi se wapas badh jayega" },
      },
    ],
    faqs: [
      {
        question: { en: "Does a high DRS lower platform fees?", hinglish: "Kya achhe DRS se platform fee kam hoti hai?" },
        answer: {
          en: "Yes. Elite creators with DRS 800+ unlock discounted platform fees and priority concierge support.",
          hinglish: "Haan. 800+ DRS wale creators ko platform fee me discount aur priority support milta hai.",
        },
      },
    ],
    related: ["influencer-deal-lifecycle", "influencer-leaderboard"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 12. Leaderboard
  {
    id: "influencer-leaderboard",
    roles: ["INFLUENCER"],
    area: "profile",
    routes: ["/dashboard/leaderboard"],
    title: {
      en: "Community Leaderboard, XP & Weekly Challenges",
      hinglish: "Community Leaderboard, XP aur Weekly Challenges",
    },
    summary: {
      en: "Compete on the weekly leaderboard, earn experience points (XP), complete challenges, and gain organic brand discovery.",
      hinglish: "Weekly leaderboard par compete karein, XP kamayein aur brand discovery me featured hon.",
    },
    whenToUse: {
      en: "When viewing community ranks, active weekly creator challenges, or competing for discovery spotlights.",
      hinglish: "Jab aapko apna platform rank aur ongoing weekly challenges check karne hon.",
    },
    steps: [
      {
        title: {
          en: "Check Weekly Category Ranking",
          hinglish: "Weekly Category Rank Dekhein",
        },
        body: {
          en: "Filter by niche (Fashion, Tech, Fitness, Food) to view where you rank among creators in your region.",
          hinglish: "Apni category select karke dekhein ki is hafte aapka rank kaunse number par hai.",
        },
        uiRef: "LeaderboardRankCard",
      },
      {
        title: {
          en: "Complete Weekly Challenges",
          hinglish: "Weekly Challenges Poore Karein",
        },
        body: {
          en: "Tackle tasks like 'Deliver 2 Reels on Time' or 'Complete 1 Brand Collab' to earn extra XP and unlock leaderboard badges.",
          hinglish: "'2 Reels Time par Deliver Karein' jaise tasks complete karke bonus XP points haasil karein.",
        },
        uiRef: "WeeklyChallengesList",
      },
    ],
    rules: [
      {
        en: "Leaderboards reset every Monday at 00:00 IST for weekly prize tracking.",
        hinglish: "Leaderboard har Somwar raat 12:00 baje IST par naye hafte ke liye reset hota hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "XP Points", hinglish: "XP Points" },
        description: {
          en: "Experience points earned through verified platform activity, on-time submissions, and deal completions.",
          hinglish: "Deals complete karne aur time par deliver karne par milne wale reward points.",
        },
      },
    ],
    commonErrors: [],
    faqs: [
      {
        question: { en: "Do top-ranked creators get more brand deals?", hinglish: "Kya top rankers ko zyada deals milti hain?" },
        answer: {
          en: "Yes. Top 10 creators on the weekly leaderboard are showcased on brand discovery hero carousels.",
          hinglish: "Haan, Top 10 creators ko brand search ke front page par highlight kiya jata hai.",
        },
      },
    ],
    related: ["influencer-drs-and-badges", "influencer-dashboard-overview"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 13. Referrals
  {
    id: "influencer-referral-program",
    roles: ["INFLUENCER"],
    area: "general",
    routes: ["/dashboard/referrals"],
    title: {
      en: "Creator Referral Program & 1% Lifetime Royalty",
      hinglish: "Creator Referral Program aur 1% Lifetime Royalty",
    },
    summary: {
      en: "Invite fellow creators or brands with your unique link and earn an automated 1% royalty on all their completed escrow deals.",
      hinglish: "Apne referral link se dosto ko invite karein aur unke har completed deal par 1% lifetime royalty kamayein.",
    },
    whenToUse: {
      en: "When inviting creator peers or local brands to join VyaparMedia for passive revenue.",
      hinglish: "Jab aap naye creators ya brands ko platform par invite karke passive income kamana chahein.",
    },
    steps: [
      {
        title: {
          en: "Copy Personal Referral Link",
          hinglish: "Apna Referral Link Copy Karein",
        },
        body: {
          en: "Find your customized invite URL and share it on WhatsApp, Instagram bio, or YouTube descriptions.",
          hinglish: "Referrals tab se apna unique link copy karke share karein.",
        },
        uiRef: "ReferralShareCard",
      },
      {
        title: {
          en: "Track Onboarded Network & Earnings",
          hinglish: "Apni Network aur Kamai Track Karein",
        },
        body: {
          en: "View your total invited creators, active ongoing deals, and accumulated royalty balance.",
          hinglish: "Dekhein kitne logo ne join kiya aur unki deals se kitna commission credit hua.",
        },
        uiRef: "ReferralStatsWidget",
      },
    ],
    rules: [
      {
        en: "1% platform referral commission is credited directly to your Available Balance when the referee's deal settles.",
        hinglish: "Referee ki deal complete hote hi 1% commission sidha aapke available wallet me aa jata hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "1% Lifetime Royalty", hinglish: "1% Lifetime Royalty" },
        description: {
          en: "You receive 1% of the gross deal value on every collaboration completed by users you onboarded.",
          hinglish: "Aapke invited users ki har collaboration par milne wala 1% share.",
        },
      },
    ],
    commonErrors: [],
    faqs: [
      {
        question: { en: "Is there an expiry on referral royalties?", hinglish: "Kya referral royalty ki koi expiry date hoti hai?" },
        answer: {
          en: "No. Royalties are lifetime as long as both accounts remain active and in good standing.",
          hinglish: "Nahi, ye royalty lifetime rehti hai jab tak account active hai.",
        },
      },
    ],
    related: ["influencer-wallet-and-taxes"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 14. Notifications
  {
    id: "influencer-notifications",
    roles: ["INFLUENCER"],
    area: "general",
    routes: ["/dashboard/notifications"],
    title: {
      en: "Notifications Center & Alert Preferences",
      hinglish: "Notifications Center aur Alert Settings",
    },
    summary: {
      en: "Configure real-time deal alerts, escrow funding notices, revision deadlines, and email/push preferences.",
      hinglish: "Deal alerts, payment notices aur revision deadlines ke push notifications customize karein.",
    },
    whenToUse: {
      en: "When reviewing missed notices or customizing how you receive critical deal updates.",
      hinglish: "Jab aapko unread notifications check karne hon ya email/SMS alerts manage karne hon.",
    },
    steps: [
      {
        title: {
          en: "Review Unread Alerts",
          hinglish: "Unread Alerts Check Karein",
        },
        body: {
          en: "Alerts are flagged by category: Escrow Funded, Revision Requested, Contract Ready, or Dispute Update.",
          hinglish: "Alerts categories me bante hue hain: Escrow Funded, Revisions, Contracts aur Payments.",
        },
        uiRef: "NotificationFeed",
      },
      {
        title: {
          en: "Configure Push & Email Channels",
          hinglish: "Push aur Email Preferences Set Karein",
        },
        body: {
          en: "Toggle web push permissions and email digest settings to stay updated without spam.",
          hinglish: "Browser push notifications on karein taaki koi zaroori deadline miss na ho.",
        },
        uiRef: "NotificationPreferencesCard",
      },
    ],
    rules: [
      {
        en: "Critical financial notifications (escrow deposited, payout released) cannot be opted out of.",
        hinglish: "Financial alerts (jaise payment release) security reasons ki wajah se band nahi kiye ja sakte.",
      },
    ],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["influencer-dashboard-overview"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 15. Settings: Profile, Rates (+ Estimated Market Range card)
  {
    id: "influencer-settings-profile",
    roles: ["INFLUENCER"],
    area: "profile",
    routes: ["/dashboard/settings"],
    title: {
      en: "Profile Settings, Rates & Estimated Market Range",
      hinglish: "Profile Settings, Rate Card aur Estimated Market Range",
    },
    summary: {
      en: "Manage your creator bio, set commercial rate cards, and understand the Estimated Market Range card data quality chips.",
      hinglish: "Apni profile bio, rate card update karein aur Estimated Market Range card ke quality tags samjhein.",
    },
    whenToUse: {
      en: "When adjusting your standard commercial rates or inspecting how the market range algorithm prices your reach.",
      hinglish: "Jab aapko apna rate card badalna ho ya check karna ho ki algorithm aapka price range kya estimate karta hai.",
    },
    steps: [
      {
        title: {
          en: "Update Rate Card",
          hinglish: "Rate Card Update Karein",
        },
        body: {
          en: "Set base pricing for Instagram Reels, Static Posts, Stories, and YouTube Dedicated/Integrated videos.",
          hinglish: "Reels, Posts aur YouTube integrations ke alag alag base rates configure karein.",
        },
        uiRef: "RatesSettingsCard",
      },
      {
        title: {
          en: "Inspect Estimated Market Range Card",
          hinglish: "Estimated Market Range Card Check Karein",
        },
        body: {
          en: "Review your dynamic pricing band (e.g. ₹5,000 – ₹12,000). The band is calculated from verified view counts, category CPMs, and follower tier.",
          hinglish: "Apna calculated range dekhein jo aapke average views aur category ke hisab se generate hota hai.",
        },
        uiRef: "EstimatedMarketRangeCard",
      },
    ],
    rules: [
      {
        en: "Never claim a single price is 'guaranteed'—the platform strictly uses 'Estimated Market Range'.",
        hinglish: "Platform par hamesha 'Estimated Market Range' term use hoti hai; koi guaranteed price promise nahi kiya jata.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "VERIFIED Chip", hinglish: "VERIFIED Chip" },
        description: {
          en: "Data points synchronized directly via official Meta or YouTube OAuth APIs.",
          hinglish: "Wo stats jo direct Instagram ya YouTube API se 100% verify hoke aaye hain.",
        },
      },
      {
        label: { en: "ESTIMATED Chip", hinglish: "ESTIMATED Chip" },
        description: {
          en: "Values calculated using industry median CPM regressions when live API views are pending Meta review.",
          hinglish: "Industry standard formulas ke zariye calculate kiya gaya anumanit data.",
        },
      },
      {
        label: { en: "SELF_REPORTED Chip", hinglish: "SELF_REPORTED Chip" },
        description: {
          en: "Numbers entered manually by the creator during onboarding without automated third-party validation.",
          hinglish: "Aapke dwara form me bhari gayi jankari jo kisi API se check nahi hui hai.",
        },
      },
      {
        label: { en: "Why is the Range Wide?", hinglish: "Range itni badi kyu hai?" },
        description: {
          en: "Bands widen (e.g. 0.6x to 1.5x) when recent view counts show high variance or when data quality is estimated, reflecting real-world uncertainty honestly.",
          hinglish: "Agar pichli posts ke views me bohot utaar-chadhaw ho, to range badi rakhi jati hai taaki data honest rahe.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Card displays 'Range Unavailable'", hinglish: "Card par 'Range Unavailable' likha aa raha hai" },
        cause: { en: "No verified social accounts linked or follower count is below 1,000", hinglish: "Koi social media account connect nahi hai ya 1,000 se kam followers hain" },
        fix: { en: "Link your Instagram Professional account in Settings ➔ Social Accounts", hinglish: "Settings me Social Accounts me jakar apna Instagram link karein" },
      },
    ],
    faqs: [
      {
        question: { en: "Can I quote above the estimated market range?", hinglish: "Kya main range se zyada quote kar sakta hoon?" },
        answer: {
          en: "Yes! The range is a guidance tool. You have full freedom to quote whatever rate you believe matches your production value.",
          hinglish: "Haan bilkul! Range sirf guidance ke liye hai, aap apni marzi se rate quote kar sakte hain.",
        },
      },
    ],
    related: ["influencer-settings-social", "influencer-reports-market-range"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 16. Settings: Social Accounts (Connect, Disconnect, Reconnect, Views Access)
  {
    id: "influencer-settings-social",
    roles: ["INFLUENCER"],
    area: "profile",
    routes: ["/dashboard/settings"],
    title: {
      en: "Social Accounts: Connect, Reconnect & Views Access",
      hinglish: "Social Accounts: Connect, Reconnect aur Views Access",
    },
    summary: {
      en: "Connect Instagram & YouTube via official OAuth, handle reconnect tokens, and understand why Instagram Reel views require extra permissions.",
      hinglish: "Instagram aur YouTube connect karein, token expire hone par reconnect karein aur Views permission samjhein.",
    },
    whenToUse: {
      en: "When connecting your social channels, refreshing expired tokens, or granting views insights permissions.",
      hinglish: "Jab aapko naya social media account link karna ho ya stats sync karne ke liye re-authenticate karna ho.",
    },
    steps: [
      {
        title: {
          en: "Connect via Official OAuth",
          hinglish: "Official OAuth se Connect Karein",
        },
        body: {
          en: "Click 'Connect Instagram' or 'Connect YouTube'. You will be redirected to Meta/Google to authorize official permissions.",
          hinglish: "'Connect' button par click karke direct Instagram ya Google login se approve karein.",
        },
        uiRef: "SocialTab",
      },
      {
        title: {
          en: "Understand 'Views Access' States",
          hinglish: "'Views Access' States ko Samjhein",
        },
        body: {
          en: "Instagram basic login imports follower counts and post media. However, actual Reel/Video view counts require 'instagram_business_manage_insights', which depends on Meta App Review.",
          hinglish: "Basic login se followers aur posts sync hote hain, lekin Reel views ke liye Meta ki extra permission lagti hai.",
        },
        uiRef: "ViewsAccessStatusPill",
      },
      {
        title: {
          en: "Reconnect Expired Tokens",
          hinglish: "Expired Account Reconnect Karein",
        },
        body: {
          en: "OAuth security tokens expire every 60 days or upon password change. Click 'Reconnect' to refresh without losing historical deal records.",
          hinglish: "Token expire hone par 'Reconnect' par tap karke account refresh karein.",
        },
        uiRef: "ReconnectButton",
      },
    ],
    rules: [
      {
        en: "Instagram accounts must be Professional (Creator or Business) linked to a Facebook Page to support Graph API synchronization.",
        hinglish: "Instagram account Professional (Creator ya Business) hona anivarya hai.",
      },
      {
        en: "Personal Instagram accounts cannot sync automated metrics through the official Meta API.",
        hinglish: "Personal accounts ka data Meta API se automatically sync nahi ho sakta.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "60-Day Token Lifecycle", hinglish: "60-Day Token Lifecycle" },
        description: {
          en: "Meta long-lived OAuth tokens require periodic renewal to maintain active data synchronization.",
          hinglish: "Security ke liye Meta har 60 din me account re-verify karne ko kehta hai.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Sync shows 'Token Expired'", hinglish: "'Token Expired' ka message aa raha hai" },
        cause: { en: "You changed your Instagram/Google password or 60 days passed without refresh", hinglish: "Password badalne se purana token invalidate ho gaya" },
        fix: { en: "Click the blue 'Reconnect' button on the account card and approve OAuth permissions again", hinglish: "Card par 'Reconnect' click karke dobara login authorize karein" },
      },
    ],
    faqs: [
      {
        question: { en: "Why does VyaparMedia never ask for my password?", hinglish: "VyaparMedia password kyu nahi maangta?" },
        answer: {
          en: "We use official OAuth 2.0. You authenticate directly with Instagram/Google, and we only receive secure read-only API access tokens.",
          hinglish: "Hum official OAuth use karte hain; aapka password hamesha Instagram/Google ke paas safe rehta hai.",
        },
      },
    ],
    related: ["influencer-settings-profile", "influencer-reports-market-range"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 17. Settings: Verification/KYC Tiers
  {
    id: "influencer-settings-verification",
    roles: ["INFLUENCER"],
    area: "kyc",
    routes: ["/dashboard/settings"],
    title: {
      en: "Verification & KYC: PAN, Aadhaar & DigiLocker Tiers",
      hinglish: "Verification aur KYC: PAN, Aadhaar aur DigiLocker Tiers",
    },
    summary: {
      en: "Complete Tier-1 and Tier-2 identity verifications to unlock unlimited payouts, verified creator badges, and high-ticket campaigns.",
      hinglish: "PAN aur DigiLocker se KYC complete karein taaki bada payout aur Verified badge unlock ho sake.",
    },
    whenToUse: {
      en: "When completing onboarding verification or upgrading your account payout limit.",
      hinglish: "Jab aapko apna account verify karna ho aur payout limit badhani ho.",
    },
    steps: [
      {
        title: {
          en: "Complete Tier-1: PAN Card Linking",
          hinglish: "Tier-1: PAN Card Link Karein",
        },
        body: {
          en: "Enter your 10-character PAN. Automated NSDL verification confirms your legal entity and stops {{tax.tds_206aa}} penal TDS.",
          hinglish: "Apna PAN number enter karein. Instant check se naam confirm ho jata hai aur TDS concessional {{tax.tds_194o}} ho jata hai.",
        },
        uiRef: "PanVerificationCard",
      },
      {
        title: {
          en: "Complete Tier-2: Aadhaar DigiLocker",
          hinglish: "Tier-2: DigiLocker se Aadhaar Verify Karein",
        },
        body: {
          en: "Authenticate via official DigiLocker to confirm your government-verified identity and unlock the Verified Creator badge.",
          hinglish: "DigiLocker ke zariye OTP se Aadhaar verify karein aur Verified Creator badge paayein.",
        },
        uiRef: "DigiLockerButton",
      },
    ],
    rules: [
      {
        en: "Identity documents must match the legal name registered with your payout bank account.",
        hinglish: "Aadhaar aur PAN ka naam aapke bank khate ke naam se bilkul match hona chahiye.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Tier-1 vs Tier-2 Limits", hinglish: "Tier-1 vs Tier-2 Limits" },
        description: {
          en: "Tier-1 unlocks deals up to ₹25,000; Tier-2 unlocks unlimited high-ticket escrow deals.",
          hinglish: "Tier-1 me ₹25,000 tak ki deals hoti hain; Tier-2 complete karne par koi limit nahi rehti.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "DigiLocker timeout or failure", hinglish: "DigiLocker par OTP nahi aaya ya error aaya" },
        cause: { en: "Mobile number is not linked to Aadhaar or UIDAI servers were temporarily busy", hinglish: "Aadhaar se mobile number link nahi hai ya UIDAI server busy hai" },
        fix: { en: "Retry after a few minutes ensuring your Aadhaar-registered SIM card is active to receive SMS OTP", hinglish: "Koshish karein ki Aadhaar linked phone active ho aur 5 minute baad retry karein" },
      },
    ],
    faqs: [],
    related: ["influencer-wallet-and-taxes", "influencer-settings-profile"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 18. Settings: Security/2FA, Telemetry Consent & Opt-Out
  {
    id: "influencer-settings-security",
    roles: ["INFLUENCER"],
    area: "security",
    routes: ["/dashboard/settings"],
    title: {
      en: "Security, 2FA Authentication & Telemetry Privacy",
      hinglish: "Security, 2FA Authenticator aur Telemetry Privacy",
    },
    summary: {
      en: "Protect your payouts with Two-Factor Authentication (TOTP), manage active sessions, and toggle analytics telemetry consent.",
      hinglish: "2FA authenticator se wallet safe karein aur privacy/telemetry settings control karein.",
    },
    whenToUse: {
      en: "When configuring Google Authenticator 2FA or reviewing your personal data privacy preferences.",
      hinglish: "Jab withdrawal ke liye 2FA on karna ho ya app telemetry ko opt-out karna ho.",
    },
    steps: [
      {
        title: {
          en: "Enable TOTP Two-Factor Authentication",
          hinglish: "2FA TOTP On Karein",
        },
        body: {
          en: "Scan the QR code with Google Authenticator or Authy. Input the 6-digit confirmation code to safeguard wallet withdrawals.",
          hinglish: "Google Authenticator se QR scan karein aur 6-digit code daal kar 2FA activate karein.",
        },
        uiRef: "TwoFactorAuthCard",
      },
      {
        title: {
          en: "Manage Telemetry Consent",
          hinglish: "Telemetry Consent Toggle Karein",
        },
        body: {
          en: "Choose whether anonymous platform usage metrics are collected to help improve product workflows. You can opt out anytime.",
          hinglish: "Aap kisi bhi waqt telemetry analytics ko band ya chalu kar sakte hain.",
        },
        uiRef: "TelemetryConsentToggle",
      },
    ],
    rules: [
      {
        en: "Once 2FA is activated, every bank withdrawal requires a 6-digit authenticator code.",
        hinglish: "2FA on hone ke baad har bank payout par 6-digit OTP code zaroori hoga.",
      },
    ],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["influencer-settings-profile", "influencer-wallet-and-taxes"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 19. Analytics (Profile Visibility, Small-Number "<5" Rule)
  {
    id: "influencer-analytics-performance",
    roles: ["INFLUENCER"],
    area: "analytics",
    routes: ["/dashboard/analytics"],
    title: {
      en: "Audience Analytics, Brand Views & The '<5' Privacy Rule",
      hinglish: "Analytics, Brand Views aur '<5' Privacy Rule",
    },
    summary: {
      en: "Track verified profile impressions, understand inbound brand interest, and learn how the '<5' privacy rule protects brand anonymity.",
      hinglish: "Dekhein kitne brands ne aapka profile dekha aur samjhein ki '<5' privacy rule kyu lagta hai.",
    },
    whenToUse: {
      en: "When monitoring commercial exposure, viewer engagement curves, or reviewing inbound profile visits.",
      hinglish: "Jab aapko dekhna ho ki pichle 30 din me aapke media kit aur profile par kitna traffic aaya.",
    },
    steps: [
      {
        title: {
          en: "Inspect 30-Day Visibility Impressions",
          hinglish: "30-Din ki Visibility Impressions Dekhein",
        },
        body: {
          en: "View verified viewer impressions, unique company counts, and median dwell times on your profile and rate cards.",
          hinglish: "Dekhein kitne brands ne aapke profile aur rate card par time spend kiya hai.",
        },
        uiRef: "CreatorVisibilitySection",
      },
      {
        title: {
          en: "Understand the '<5' Small-Number Rule",
          hinglish: "'<5' Small-Number Rule Samjhein",
        },
        body: {
          en: "To comply with privacy laws and prevent deanonymization, exact brand counts below {{analytics.small_number_threshold}} render as '<5' instead of single-digit numbers.",
          hinglish: "Privacy maintain karne ke liye {{analytics.small_number_threshold}} se kam views hone par exact number ke bajaye '<5' dikhta hai.",
        },
      },
    ],
    rules: [
      {
        en: "Small-number suppression (< 5 -> '<5') is strictly enforced across all brand viewer telemetry.",
        hinglish: "5 se kam company views par privacy protection ke liye '<5' hi render hoga.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Small-Number Threshold (<5)", hinglish: "Small-Number Threshold (<5)" },
        description: {
          en: "Protects individual brand researchers from being tracked or identified prematurely by competitors.",
          hinglish: "Naye brands ki privacy safe rakhne ke liye chhota traffic anonymize rehta hai.",
        },
      },
    ],
    commonErrors: [],
    faqs: [],
    related: ["influencer-reports-market-range", "influencer-dashboard-overview"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 20. Reports (Market Range Report: Print/Save PDF, Integrity Code, Verify at /verify-report)
  {
    id: "influencer-reports-market-range",
    roles: ["INFLUENCER"],
    area: "analytics",
    routes: ["/dashboard/analytics", "/verify-report/[id]"],
    title: {
      en: "Official Market Range Reports & Cryptographic Verification",
      hinglish: "Official Market Range Report aur Verification Code",
    },
    summary: {
      en: "Generate official branded PDF media reports with cryptographic integrity codes verifiable publicly at /verify-report.",
      hinglish: "Official PDF media report download karein aur verify-report link se uski authenticity prove karein.",
    },
    whenToUse: {
      en: "When pitching off-platform agencies, applying for brand ambassadorships, or validating your true market rate.",
      hinglish: "Jab kisi brand ko official PDF rate report bhejni ho jise wo online verify kar sakein.",
    },
    steps: [
      {
        title: {
          en: "Generate Branded Valuation Report",
          hinglish: "Branded Report Generate Karein",
        },
        body: {
          en: "From the analytics or settings tab, click 'Export Market Range Report'. A high-resolution official report is rendered.",
          hinglish: "'Export Market Range Report' par tap karke official letterhead document banayein.",
        },
        uiRef: "MarketRangeReportModal",
      },
      {
        title: {
          en: "Locate Cryptographic Integrity Code",
          hinglish: "Integrity Code aur QR Code Dekhein",
        },
        body: {
          en: "Every report contains a unique Report ID (e.g. VM-MR-202611-A1B2C3) and SHA-256 payload integrity hash at the footer.",
          hinglish: "Har document ke footer me ek unique Report ID aur QR code hota hai jo tamper-proof hota hai.",
        },
        uiRef: "ReportFooter",
      },
      {
        title: {
          en: "Verify Authenticity Online",
          hinglish: "Online Authenticity Check Karein",
        },
        body: {
          en: "Anyone can visit /verify-report/[id] or scan the QR code to confirm that the report numbers were legitimately issued by VyaparMedia.",
          hinglish: "Koi bhi brand /verify-report par jakar confirm kar sakta hai ki report genuine hai aur numbers fabricated nahi hain.",
        },
      },
    ],
    rules: [
      {
        en: "Altering PDF contents invalidates the SHA-256 cryptographic fingerprint upon public audit.",
        hinglish: "PDF me koi bhi badlaav karne par verification system use 'Tampered / Invalid' declare kar dega.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Report ID (VM-MR-...)", hinglish: "Report ID (VM-MR-...)" },
        description: {
          en: "Publicly auditable immutable identifier stored in platform verification ledgers.",
          hinglish: "Public verification portal par check karne ke liye unique tracking code.",
        },
      },
    ],
    commonErrors: [],
    faqs: [],
    related: ["influencer-settings-profile", "influencer-analytics-performance"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 21. Public Profile Page
  {
    id: "influencer-public-profile",
    roles: ["INFLUENCER"],
    area: "profile",
    routes: ["/creator/[username]"],
    title: {
      en: "Public Creator Profile & Live Media Kit",
      hinglish: "Public Creator Profile aur Live Media Kit",
    },
    summary: {
      en: "Inspect your public media kit page, verified audience stats, past campaign showcases, and direct brand booking flow.",
      hinglish: "Apna public media kit page dekhein jo brands ko dikhta hai aur direct booking samjhein.",
    },
    whenToUse: {
      en: "When viewing how brands see your profile or sharing your personal vyaparmedia.in/creator/username link in your bio.",
      hinglish: "Jab aapko apna bio link share karna ho taaki brands aapko directly sponsorship offers bhej sakein.",
    },
    steps: [
      {
        title: {
          en: "Review Public Media Kit Layout",
          hinglish: "Media Kit Page Check Karein",
        },
        body: {
          en: "Your public page highlights verified follower stats, engagement rates, content categories, and recent verified work.",
          hinglish: "Aapke page par verified follower stats, engagement aur past reels automatically display hote hain.",
        },
        uiRef: "PublicProfileView",
      },
      {
        title: {
          en: "Direct Brand 'Book Deal' Flow",
          hinglish: "Direct Brand 'Book Deal' Flow",
        },
        body: {
          en: "Brands visiting your link can click 'Book Deal' to submit an escrow-backed campaign brief directly to your deal room.",
          hinglish: "Brands 'Book Deal' par tap karke seedha aapko paid campaign offer bhej sakte hain.",
        },
        uiRef: "BookDealButton",
      },
    ],
    rules: [
      {
        en: "Only verified social stats with active tokens are showcased on the public media kit.",
        hinglish: "Sirf verified aur active stats hi public page par brands ko dikhaye jaate hain.",
      },
    ],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["influencer-settings-profile", "influencer-settings-social"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 22. Support Tickets
  {
    id: "influencer-support-tickets",
    roles: ["INFLUENCER"],
    area: "general",
    routes: ["/dashboard/support"],
    title: {
      en: "Support Desk & Technical Grievance Resolution",
      hinglish: "Support Desk aur Grievance Resolution",
    },
    summary: {
      en: "Open support tickets for banking issues, verification delays, or technical problems with priority human resolution.",
      hinglish: "Payment, bank ya verification problems ke liye priority support ticket raise karein.",
    },
    whenToUse: {
      en: "When encountering transaction delays, payout questions, or platform technical glitches.",
      hinglish: "Jab aapko kisi technical ya payment related help ki zaroorat ho.",
    },
    steps: [
      {
        title: {
          en: "Create Support Ticket",
          hinglish: "Naya Ticket Banayein",
        },
        body: {
          en: "Select topic (Payment/Withdrawal, KYC Verification, Deal Dispute, Bug Report) and attach relevant deal or transaction IDs.",
          hinglish: "Category chunein aur deal/transaction ID ke sath issue describe karein.",
        },
        uiRef: "CreateTicketForm",
      },
      {
        title: {
          en: "Track Ticket Status",
          hinglish: "Status Track Karein",
        },
        body: {
          en: "Follow human agent responses directly in your ticket thread until marked Resolved.",
          hinglish: "Support team ke replies chat ki tarah ticket page par check karein.",
        },
        uiRef: "TicketsList",
      },
    ],
    rules: [],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["influencer-wallet-and-taxes", "influencer-dashboard-overview"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 23. Referral & Scout Link
  {
    id: "influencer-scout-program",
    roles: ["INFLUENCER"],
    area: "scout",
    routes: ["/dashboard/referrals"],
    title: {
      en: "Campus Partner & Scout Program Integration",
      hinglish: "Campus Partner aur Scout Program Integration",
    },
    summary: {
      en: "Learn how Campus Partners and Scouts onboard creators and brands into the escrow network while earning lifetime recurring commissions.",
      hinglish: "Samjhein ki Campus Scouts creators aur brands ko kaise jodte hain aur unhe commission kaise milta hai.",
    },
    whenToUse: {
      en: "When participating as a campus scout or understanding how scout referral attribution works.",
      hinglish: "Jab aap campus partner ke roop me local brands aur creators ko VyaparMedia par la rahe hon.",
    },
    steps: [
      {
        title: {
          en: "Share Scout Referral Code",
          hinglish: "Scout Code Share Karein",
        },
        body: {
          en: "Provide your scout referral slug during creator or brand onboarding so their account is permanently attributed to your royalty tree.",
          hinglish: "Apna unique scout code share karein taaki unki har deal ka credit aapko mile.",
        },
        uiRef: "ScoutAttributionWidget",
      },
    ],
    rules: [
      {
        en: "Attribution is permanently locked upon account registration.",
        hinglish: "Ek baar account banne ke baad scout attribution change nahi ho sakta.",
      },
    ],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["influencer-referral-program", "influencer-wallet-and-taxes"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 24. Account / Role Switching Rules
  {
    id: "influencer-role-switching",
    roles: ["INFLUENCER"],
    area: "security",
    routes: ["/dashboard/settings"],
    title: {
      en: "Account Roles & Anti-Fraud Switching Rules",
      hinglish: "Account Roles aur Role Switching ke Niyam",
    },
    summary: {
      en: "Understand strict platform security rules governing account roles: Creator vs Brand account immutability and Scout conversion.",
      hinglish: "Jaaniye ki Creator aur Brand accounts kyu lock rehte hain aur sirf Scout account hi convert kyu ho sakta hai.",
    },
    whenToUse: {
      en: "When inquiring about switching between Creator and Brand dashboards or upgrading an account.",
      hinglish: "Jab aapko Creator se Brand ya Brand se Creator switch karne ke niyam janane hon.",
    },
    steps: [
      {
        title: {
          en: "Understand Creator & Brand Immutability",
          hinglish: "Creator aur Brand Lock Niyam",
        },
        body: {
          en: "To eliminate conflict of interest and prevent escrow circumvention, active Creator and Brand accounts cannot freely flip back and forth.",
          hinglish: "Escrow fraud aur conflict of interest rokne ke liye Creator aur Brand accounts ko switch karna allowed nahi hai.",
        },
      },
      {
        title: {
          en: "Scout Conversion Exception",
          hinglish: "Scout Conversion Exception",
        },
        body: {
          en: "Only Campus Partner (Scout) accounts can convert into a Creator or Brand account via Settings ➔ Convert Account.",
          hinglish: "Kewal Campus Partner (Scout) account hi Creator ya Brand me convert kiya ja sakta hai.",
        },
        uiRef: "AccountTypeBadge",
      },
    ],
    rules: [
      {
        en: "Direct role switching between INFLUENCER and BRAND is strictly blocked for security and tax compliance.",
        hinglish: "Tax audit aur escrow safety ke liye Creator aur Brand ke beech direct role switch blocked hai.",
      },
    ],
    numbersExplained: [],
    commonErrors: [
      {
        symptom: { en: "Role switch button is missing", hinglish: "Role switch ka option nahi dikh raha" },
        cause: { en: "Your account is already a verified INFLUENCER or BRAND entity", hinglish: "Aapka account already ek verified Creator ya Brand hai" },
        fix: { en: "To operate both as a creator and a brand, register a separate account using your official business email", hinglish: "Agar aap dono chalana chahte hain to alag business email se naya account banayein" },
      },
    ],
    faqs: [
      {
        question: { en: "Why is role switching restricted?", hinglish: "Role switch karna kyu allowed nahi hai?" },
        answer: {
          en: "Indian tax regulations (Section 194-O) and escrow legal agreements require clear separation between payer (Brand) and payee (Creator).",
          hinglish: "Indian tax kanoon (Section 194-O) aur legal escrow me Brand (payer) aur Creator (payee) ka alag rehna zaroori hai.",
        },
      },
    ],
    related: ["influencer-settings-profile", "influencer-taxes-compliance"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
];
