import type { Guide } from "@/lib/guides/schema";

export const SHARED_GUIDES: Guide[] = [
  {
    id: "shared-notifications-center",
    roles: ["INFLUENCER", "BRAND", "SCOUT"],
    area: "general",
    routes: ["/dashboard/notifications"],
    title: {
      en: "Real-Time Notifications & Action Center",
      hinglish: "Real-Time Notifications aur Action Center",
    },
    summary: {
      en: "Manage deal alerts, milestone updates, payout confirmations, and compliance notices in one consolidated inbox.",
      hinglish: "Deal alerts, milestone updates, payment confirmations aur compliance notices ek hi jagah manage karein.",
    },
    whenToUse: {
      en: "Use to review unread notifications, clear action items, and configure multichannel delivery preferences.",
      hinglish: "Unread alerts dekhne, pending actions nipatne aur email/WhatsApp preferences set karne ke liye.",
    },
    steps: [
      {
        title: {
          en: "Review High-Priority Action Alerts",
          hinglish: "High-Priority Action Alerts Dekhein",
        },
        body: {
          en: "Urgent alerts like pending contract signatures (within {{deals.signing_hours}}) and draft review requests appear pinned at the top.",
          hinglish: "Contract signing aur draft approval jaise urgent notices sabse upar pin hote hain.",
        },
        uiRef: "NotificationTabs",
      },
      {
        title: {
          en: "Configure Alert Preferences",
          hinglish: "Alert Preferences Set Karein",
        },
        body: {
          en: "Toggle email, SMS, and WhatsApp alerts for contract changes, wallet credits, and direct messages in your profile settings.",
          hinglish: "Settings me jakar email, WhatsApp aur SMS notifications customize karein.",
        },
        uiRef: "NotificationSettingsButton",
      },
    ],
    rules: [
      {
        en: "Critical financial notifications (escrow deposits, dispute verdicts) cannot be disabled.",
        hinglish: "Zaroori financial alerts (payout, dispute) ko band nahi kiya ja sakta.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Unread Badge", hinglish: "Unread Badge" },
        description: {
          en: "Count of notifications that require your attention or action.",
          hinglish: "Aapke dhyan ya action ke liye pending alerts ki ginti.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Not receiving WhatsApp alerts", hinglish: "WhatsApp alerts nahi aa rahe" },
        cause: { en: "Phone number not verified or user replied STOP to platform shortcode", hinglish: "Phone number verify nahi hai ya STOP reply kiya gaya tha" },
        fix: { en: "Re-verify your mobile number with OTP in Settings", hinglish: "Settings me mobile number dobara OTP se verify karein" },
      },
    ],
    faqs: [
      {
        question: { en: "How long are notifications kept?", hinglish: "Notifications kitne din tak save rehte hain?" },
        answer: {
          en: "All notifications are archived and searchable for 90 days.",
          hinglish: "Sabhi notifications 90 dino tak inbox me available rehte hain.",
        },
      },
    ],
    related: ["shared-guide-center"],
    supportCta: {
      label: { en: "Settings", hinglish: "Settings" },
      href: "/dashboard/settings",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "shared-guide-center",
    roles: ["INFLUENCER", "BRAND", "SCOUT"],
    area: "general",
    routes: ["/dashboard/guide"],
    title: {
      en: "Interactive Guide Center & Knowledge Base",
      hinglish: "Interactive Guide Center aur Jankari Kendra",
    },
    summary: {
      en: "Explore step-by-step product walkthroughs, escrow rules, statutory tax calculations, and troubleshooting tips.",
      hinglish: "Product guides, escrow niyam, tax details aur platform tips ek jagah padhein.",
    },
    whenToUse: {
      en: "Use whenever you need step-by-step assistance, explanation of platform numbers, or how to resolve an error.",
      hinglish: "Jab bhi kisi feature ko samajhna ho, calculation dekhni ho ya kisi error ka solution chahiye ho.",
    },
    steps: [
      {
        title: {
          en: "Search or Filter by Topic Area",
          hinglish: "Search ya Topic Filter Use Karein",
        },
        body: {
          en: "Type your question or filter by area (Deals, Wallet, Campaigns, Disputes, KYC, Security) to instantly surface relevant guides.",
          hinglish: "Apna sawal likhein ya Deals, Wallet, KYC jaise topic pills par click karein.",
        },
        uiRef: "GuideSearchBar",
      },
      {
        title: {
          en: "Toggle English or Hinglish",
          hinglish: "English ya Hinglish Toggle Karein",
        },
        body: {
          en: "Switch between English and Hinglish at any time. Your chosen language preference is saved across sessions.",
          hinglish: "Apni pasand ke mutabik English ya Hinglish me padhein, aapka preference automatically save rehta hai.",
        },
        uiRef: "LanguageToggle",
      },
      {
        title: {
          en: "Print or Share Guide",
          hinglish: "Guide Print ya Save Karein",
        },
        body: {
          en: "Use the Print / Save PDF button to generate an official letterhead version of any guide for offline reference.",
          hinglish: "Print / Save PDF par click karke guide ka clean letterhead PDF export karein.",
        },
        uiRef: "PrintButton",
      },
    ],
    rules: [
      {
        en: "Guides reflect dynamic platform constants. Numerical values always reflect active system rules.",
        hinglish: "Guides me likhe rates aur limits platform ke live rules ke mutabik automatic update hote hain.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Dynamic Constants", hinglish: "Dynamic Constants" },
        description: {
          en: "Values like fee tiers and tax rates populated directly from the code source of truth.",
          hinglish: "Vo values jo seedhe platform settings se live calculate hoti hain.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Guide link opens wrong section", hinglish: "Guide galat section par khul rahi hai" },
        cause: { en: "Anchor hash was malformed or route redirected", hinglish: "Deep link anchor galat tha ya page redirect ho gaya" },
        fix: { en: "Use the table of contents inside the guide to jump to the intended step", hinglish: "Guide ke table of contents se direct step par click karein" },
      },
    ],
    faqs: [
      {
        question: { en: "Are guides available inside every screen?", hinglish: "Kya har page par guide mil sakti hai?" },
        answer: {
          en: "Yes, click the Global Help button in the sidebar or mobile menu to open contextual guides for your current screen.",
          hinglish: "Haan, sidebar me Help button dabane par current page se judi guides drawer me open ho jaati hain.",
        },
      },
    ],
    related: ["shared-notifications-center"],
    supportCta: {
      label: { en: "Public FAQ", hinglish: "Public FAQ" },
      href: "/help",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "shared-report-verification",
    roles: ["INFLUENCER", "BRAND", "SCOUT", "ADMIN"],
    area: "compliance",
    routes: ["/verify-report", "/verify-report/[id]"],
    title: {
      en: "Official Report Verification & QR Scanner",
      hinglish: "Official Report Verification aur QR Scanner",
    },
    summary: {
      en: "Verify the authenticity and tamper-evident digital signature of any exported campaign governance, ROI, or financial report.",
      hinglish: "Kisi bhi campaign, ROI ya financial PDF report ka digital signature aur QR code verify karein.",
    },
    whenToUse: {
      en: "Use to validate that an exported PDF report has not been modified or fabricated after generation.",
      hinglish: "Jab kisi share kiye gaye PDF report ki authenticity aur ledger data verify karna ho.",
    },
    steps: [
      {
        title: {
          en: "Scan Report QR Code or Enter Reference ID",
          hinglish: "QR Code Scan Karein ya Report ID Enter Karein",
        },
        body: {
          en: "Scan the QR code printed in the report letterhead or type the unique 16-character alphanumeric reference ID.",
          hinglish: "Report ke letterhead par bana QR code camera se scan karein ya 16-character ID daalein.",
        },
        uiRef: "ReportVerificationInput",
      },
      {
        title: {
          en: "Inspect Cryptographic Signature",
          hinglish: "Digital Signature Match Check Karein",
        },
        body: {
          en: "The system matches the SHA-256 payload checksum against our immutable ledger and displays the verified timestamp and creator details.",
          hinglish: "System document ka checksum check karke verified date aur original figures screen par dikhata hai.",
        },
        uiRef: "VerificationResultCard",
      },
    ],
    rules: [
      {
        en: "Only reports bearing status VERIFIED represent official platform certified data.",
        hinglish: "Keval VERIFIED status wali reports ko hi official aur valid mana jata hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Checksum", hinglish: "Checksum" },
        description: {
          en: "Cryptographic hash uniquely identifying the exact contents of the original PDF document.",
          hinglish: "Unique digital fingerprint jo confirm karta hai ki PDF me koi chhedchhad nahi hui.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Report Not Found or Checksum Mismatch", hinglish: "Report Not Found ya Checksum Mismatch" },
        cause: { en: "The report reference ID is invalid or the file contents were altered after export", hinglish: "Report ID galat hai ya PDF ko export karne ke baad edit kiya gaya hai" },
        fix: { en: "Request a fresh, untampered report directly from the originating brand or creator", hinglish: "Original creator ya brand se naya export mangwayein" },
      },
    ],
    faqs: [
      {
        question: { en: "Can anyone verify a report?", hinglish: "Kya koi bhi report verify kar sakta hai?" },
        answer: {
          en: "Yes, the report verification portal is public and accessible without logging in.",
          hinglish: "Haan, verification portal public hai aur bina login kiye bhi check kiya ja sakta hai.",
        },
      },
    ],
    related: ["shared-guide-center"],
    supportCta: {
      label: { en: "Contact Compliance", hinglish: "Contact Compliance" },
      href: "/contact",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "shared-security-and-2fa",
    roles: ["INFLUENCER", "BRAND", "SCOUT"],
    area: "security",
    routes: ["/dashboard/settings"],
    title: {
      en: "Account Security, Two-Factor Authentication (2FA) & Sessions",
      hinglish: "Account Security, Two-Factor Authentication (2FA) aur Sessions",
    },
    summary: {
      en: "Secure your account with TOTP authenticator apps, manage active browser sessions, and review login history.",
      hinglish: "Google Authenticator se 2FA enable karein, active login sessions manage karein aur password update karein.",
    },
    whenToUse: {
      en: "Use when setting up 2FA protection before high-value withdrawals or terminating unrecognized login sessions.",
      hinglish: "Bade payouts se pehle 2FA on karne ya kisi anjaan device se logout karne ke liye.",
    },
    steps: [
      {
        title: {
          en: "Enable Authenticator App (TOTP)",
          hinglish: "Authenticator App (TOTP) Enable Karein",
        },
        body: {
          en: "Scan the setup QR code using Google Authenticator, 1Password, or Authy and enter the 6-digit verification code.",
          hinglish: "Google Authenticator se QR code scan karein aur 6-digit code enter karke 2FA activate karein.",
        },
        uiRef: "TwoFactorSetupModal",
      },
      {
        title: {
          en: "Save Emergency Recovery Codes",
          hinglish: "Emergency Recovery Codes Save Karein",
        },
        body: {
          en: "Store your one-time recovery codes in a secure password manager. These allow account recovery if your phone is lost.",
          hinglish: "Apne recovery codes ko safe jagah note karein taaki phone khone par bhi account khul sake.",
        },
        uiRef: "RecoveryCodesCard",
      },
    ],
    rules: [
      {
        en: "2FA is required for single withdrawals exceeding ₹50,000.",
        hinglish: "₹50,000 se bade withdrawals ke liye 2FA security anivarya hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Active Sessions", hinglish: "Active Sessions" },
        description: {
          en: "Devices currently authorized to access your account.",
          hinglish: "Vo sabhi mobile aur computer jahan aapka account logged in hai.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Invalid 2FA code error", hinglish: "Invalid 2FA code error" },
        cause: { en: "Device clock out of sync by more than 30 seconds", hinglish: "Phone ki ghadi sahi time se out-of-sync hai" },
        fix: { en: "Turn on automatic time synchronization in your phone settings and try again", hinglish: "Phone settings me automatic time on karein aur dubara code daalein" },
      },
    ],
    faqs: [
      {
        question: { en: "What if I lose my 2FA device?", hinglish: "Agar 2FA wala phone kho jaye toh?" },
        answer: {
          en: "Use an emergency recovery code to log in, then reset your authenticator secret in Security Settings.",
          hinglish: "Saved backup recovery code se login karein aur settings me naya authenticator set karein.",
        },
      },
    ],
    related: ["shared-guide-center"],
    supportCta: {
      label: { en: "Support Helpdesk", hinglish: "Support Helpdesk" },
      href: "/dashboard/support",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "brand-applications-management",
    roles: ["BRAND"],
    area: "campaigns",
    routes: ["/dashboard/applications"],
    title: {
      en: "Brand Application Hub: Screening & Shortlisting Creators",
      hinglish: "Brand Application Hub: Creators ko Screen aur Shortlist Karna",
    },
    summary: {
      en: "Review incoming creator applications across your active campaigns, screen bids against benchmarks, and accept proposals.",
      hinglish: "Apni campaigns par aayi creator applications review karein, rates check karein aur best creators select karein.",
    },
    whenToUse: {
      en: "Use to evaluate applicant portfolios, compare follower engagement quality, and initiate deal negotiations.",
      hinglish: "Jab aapko applicants ke pitches aur samples dekh kar unhe deal bhejne ke liye shortlist karna ho.",
    },
    steps: [
      {
        title: {
          en: "Review Creator Pitches & Bid Amounts",
          hinglish: "Creator ka Pitch aur Quote Check Karein",
        },
        body: {
          en: "Inspect proposed creative angles, past video samples, and remuneration quotes in integer paise.",
          hinglish: "Creator ka pitch, portfolio videos aur proposed fees check karein.",
        },
        uiRef: "ApplicationProposalCard",
      },
      {
        title: {
          en: "Accept and Fund Escrow",
          hinglish: "Accept Karein aur Escrow Fund Karein",
        },
        body: {
          en: "Accepting an application generates a formal collaboration agreement and prompts escrow deposit from your wallet balance.",
          hinglish: "Accept karte hi agreement create hota hai aur wallet se amount escrow me lock ho jata hai.",
        },
        uiRef: "AcceptApplicationButton",
      },
    ],
    rules: [
      {
        en: "Contracts must be signed within {{deals.signing_hours}} of acceptance.",
        hinglish: "Application accept hone ke {{deals.signing_hours}} ke andar dono taraf se sign hona zaroori hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Engagement Rate", hinglish: "Engagement Rate" },
        description: {
          en: "Audited engagement percentage based on authentic likes, comments, and video views.",
          hinglish: "Creator ke authentic engagement ka verified percentage.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Insufficient balance to accept application", hinglish: "Application accept karne ke liye balance kam hai" },
        cause: { en: "Wallet does not have enough funds to cover the creator bid plus platform fee", hinglish: "Wallet me creator fee aur platform charges ke barabar balance nahi hai" },
        fix: { en: "Top up your wallet via UPI, NetBanking, or Corporate Card to proceed", hinglish: "Wallet me funds add karein aur fir accept karein" },
      },
    ],
    faqs: [
      {
        question: { en: "Can I negotiate the creator's fee?", hinglish: "Kya main creator se fees negotiate kar sakta hoon?" },
        answer: {
          en: "Yes, use the chat message thread on the application to propose a revised counter-offer before accepting.",
          hinglish: "Haan, in-app messaging me creator se baat karke revised offer decide kar sakte hain.",
        },
      },
    ],
    related: ["brand-deal-management", "brand-campaign-detail"],
    supportCta: {
      label: { en: "Campaigns", hinglish: "Campaigns" },
      href: "/dashboard/campaigns",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "brand-analytics-intelligence",
    roles: ["BRAND"],
    area: "analytics",
    routes: ["/dashboard/analytics"],
    title: {
      en: "Brand Marketing Analytics & Performance Dashboard",
      hinglish: "Brand Marketing Analytics aur Performance Dashboard",
    },
    summary: {
      en: "Analyze holistic campaign performance, total reach, aggregated CPV, and audience demographics across influencer tiers.",
      hinglish: "Apni sabhi campaigns ki overall reach, views, cost per view (CPV) aur audience data analyze karein.",
    },
    whenToUse: {
      en: "Use to assess influencer marketing ROI, compare creator performance tiers, and optimize future campaign budgets.",
      hinglish: "Overall influencer marketing ROI calculate karne aur next campaign budget plan karne ke liye.",
    },
    steps: [
      {
        title: {
          en: "Inspect Total Reach & Verified Impressions",
          hinglish: "Total Reach aur Impressions Dekhein",
        },
        body: {
          en: "View authentic views and impressions tracked across YouTube, Instagram, and connected creator platforms.",
          hinglish: "Apne campaigns par aaye genuine views aur reach ka live total dekhein.",
        },
        uiRef: "TotalReachChart",
      },
      {
        title: {
          en: "Analyze Cost Per View (CPV)",
          hinglish: "Effective Cost Per View (CPV) Check Karein",
        },
        body: {
          en: "Evaluate average CPV against industry category benchmarks to measure budget efficiency.",
          hinglish: "Dekhein aapko prati 1,000 views kitna kharch pad raha hai aur industry benchmark se compare karein.",
        },
        uiRef: "CpvMetricWidget",
      },
    ],
    rules: [
      {
        en: "Analytics exclude flagged bot impressions to protect reporting integrity.",
        hinglish: "Data me fake ya bot views exclude kiye jaate hain taaki accurate reporting mile.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Effective CPV", hinglish: "Effective CPV" },
        description: {
          en: "Total spent divided by total verified video views delivered.",
          hinglish: "Total kharch ko total authentic views se divide karke nikala gaya rate.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Metrics delayed for recent post", hinglish: "Naye post ke metrics abhi show nahi ho rahe" },
        cause: { en: "Social platform insight APIs sync periodically every 4 to 6 hours", hinglish: "Social media APIs har 4 se 6 ghante me refresh hoti hain" },
        fix: { en: "Allow up to 6 hours for latest reel and video analytics to hydrate into the dashboard", hinglish: "Recent upload ke metrics aane ke liye thoda intezar karein" },
      },
    ],
    faqs: [
      {
        question: { en: "Can I download an executive summary presentation?", hinglish: "Kya main executive summary export kar sakta hoon?" },
        answer: {
          en: "Yes, click Export Report to download an official letterhead report suitable for executive leadership.",
          hinglish: "Haan, Export Report button se leadership ke liye certified summary PDF download karein.",
        },
      },
    ],
    related: ["brand-campaign-roi-reports", "brand-campaign-detail"],
    supportCta: {
      label: { en: "View Campaigns", hinglish: "Campaigns Dekhein" },
      href: "/dashboard/campaigns",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "brand-referral-rewards",
    roles: ["BRAND"],
    area: "general",
    routes: ["/dashboard/referrals"],
    title: {
      en: "Brand Partner Referrals & Platform Fee Credits",
      hinglish: "Brand Partner Referrals aur Platform Fee Credits",
    },
    summary: {
      en: "Refer fellow brands to the platform and receive fee credit discounts on your subsequent escrow campaigns.",
      hinglish: "Doosre brands ko invite karein aur apni campaigns par platform fee discounts paayein.",
    },
    whenToUse: {
      en: "Use to grab your brand referral link, track invited businesses, and apply earned fee discount credits.",
      hinglish: "Apna brand referral link copy karne aur campaign discounts check karne ke liye.",
    },
    steps: [
      {
        title: {
          en: "Copy Your Brand Invite Code",
          hinglish: "Apna Brand Invite Link Copy Karein",
        },
        body: {
          en: "Share your dedicated partner referral code with brand marketing managers and peer agencies.",
          hinglish: "Apna referral code doosri marketing teams aur agencies ke sath share karein.",
        },
        uiRef: "BrandInviteLinkBox",
      },
      {
        title: {
          en: "Apply Credits at Escrow Checkout",
          hinglish: "Campaign Escrow par Discount Apply Karein",
        },
        body: {
          en: "When an invited brand launches their first campaign, fee discount credits automatically apply toward your platform fees.",
          hinglish: "Invited brand ke campaign live karte hi aapki agli deal par platform fee kam ho jayegi.",
        },
        uiRef: "FeeCreditsBadge",
      },
    ],
    rules: [
      {
        en: "Fee credits cannot be redeemed for cash or withdrawn; they apply exclusively against platform fee deductions.",
        hinglish: "Referral credits sirf platform fees discount ke liye hain, cash withdraw nahi kiye ja sakte.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Fee Discount Credit", hinglish: "Fee Discount Credit" },
        description: {
          en: "Amount deducted automatically from platform commission on your next deal.",
          hinglish: "Agli deal par platform fee me se minus hone wala discount amount.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Credit not applied to campaign", hinglish: "Discount campaign me apply nahi hua" },
        cause: { en: "Platform fee tier already reached minimum {{fee.min}} floor", hinglish: "Deal par pehle se hi minimum platform fee {{fee.min}} lag rahi hai" },
        fix: { en: "The credit remains banked in your account and will apply to future qualifying campaigns", hinglish: "Credits aapke account me save rahenge aur agli qualifying deal par use honge" },
      },
    ],
    faqs: [
      {
        question: { en: "Do referral credits expire?", hinglish: "Kya referral discount credits expire hote hain?" },
        answer: {
          en: "No, earned brand fee credits remain valid in your account for 365 calendar days.",
          hinglish: "Brand credits account me 1 saal (365 din) tak valid rehte hain.",
        },
      },
    ],
    related: ["brand-wallet-and-escrow", "brand-campaign-creation"],
    supportCta: {
      label: { en: "Wallet Hub", hinglish: "Wallet Hub" },
      href: "/dashboard/wallet",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
  {
    id: "influencer-directory-discovery",
    roles: ["INFLUENCER"],
    area: "general",
    routes: ["/dashboard/influencers", "/dashboard/influencers/[id]"],
    title: {
      en: "Peer Creator Directory & Co-Creation Network",
      hinglish: "Peer Creator Directory aur Co-Creation Network",
    },
    summary: {
      en: "Discover fellow creators across niches, explore verified public portfolio metrics, and connect for co-branded initiatives.",
      hinglish: "Doosre creators ki profile aur portfolios dekhein aur collaboration ke naye mauke khojein.",
    },
    whenToUse: {
      en: "Use to benchmark your engagement against peers, find podcast guests or co-creators, and review category leaders.",
      hinglish: "Apni category ke top creators dekhne aur co-creation partners dhoondhne ke liye.",
    },
    steps: [
      {
        title: {
          en: "Filter Creators by Niche & Tier",
          hinglish: "Niche aur Category ke mutabik Filter Karein",
        },
        body: {
          en: "Browse verified influencers by domain (Tech, Lifestyle, Gaming, Finance) and audience tier.",
          hinglish: "Tech, Lifestyle, Gaming jaise domains ke mutabik creators browse karein.",
        },
        uiRef: "CreatorDirectoryGrid",
      },
      {
        title: {
          en: "Inspect Public Portfolio & DRS Badges",
          hinglish: "Public Portfolio aur DRS Score Dekhein",
        },
        body: {
          en: "View audited delivery reliability scores, completed campaign count, and featured brand testimonials.",
          hinglish: "Creator ka delivery reliability score (DRS) aur purani successful deals check karein.",
        },
        uiRef: "CreatorProfileSummary",
      },
    ],
    rules: [
      {
        en: "Do not solicit off-platform contacts or spam peer creators with unsolicited promotions.",
        hinglish: "Directory me doosre creators ko spam messages ya promotions na bhejein.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "DRS Score", hinglish: "DRS Score" },
        description: {
          en: "Delivery Reliability Score evaluating on-time submissions and contract fulfillment.",
          hinglish: "On-time delivery aur acche kaam par milne wala reliability score.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Profile message button disabled", hinglish: "Message button disabled dikh raha hai" },
        cause: { en: "Creator has set direct messages to Verified Brands Only in their privacy settings", hinglish: "Creator ne privacy settings me direct message restrict kiye hain" },
        fix: { en: "Connect through public social media links displayed on their verified card", hinglish: "Unke public social media links ke through connect karein" },
      },
    ],
    faqs: [
      {
        question: { en: "Can creators hire other creators?", hinglish: "Kya ek creator doosre creator ko hire kar sakta hai?" },
        answer: {
          en: "Yes, creators running production houses can switch to Brand mode in Settings to launch campaigns.",
          hinglish: "Haan, agency ya production chalane wale creators Settings me Brand mode me switch kar sakte hain.",
        },
      },
    ],
    related: ["influencer-drs-and-badges", "influencer-dashboard-overview"],
    supportCta: {
      label: { en: "My Profile", hinglish: "Mera Profile" },
      href: "/dashboard/settings",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
];
