import type { Guide } from "@/lib/guides/schema";

export const SCOUT_GUIDES: Guide[] = [
  // 1. What a Scout is & Program Rules/Terms
  {
    id: "scout-program-overview",
    roles: ["SCOUT"],
    area: "scout",
    routes: ["/dashboard"],
    title: {
      en: "Campus Partner & Scout Program: Mission, Royalties & Terms",
      hinglish: "Campus Scout Program: Mission, Royalties aur Niyam",
    },
    summary: {
      en: "Understand the Campus Scout mission: bridge student creators and local businesses to VyaparMedia while earning a 1% recurring lifetime royalty on all settled deals.",
      hinglish: "Campus Scout program samjhein: student creators aur local brands ko platform se jodein aur har deal par 1% lifetime royalty kamayein.",
    },
    whenToUse: {
      en: "When joining the program or reviewing your contractual partner entitlements and royalty rights.",
      hinglish: "Jab aap naye scout ke roop me shuru karein aur program ke official terms janana chahein.",
    },
    steps: [
      {
        title: {
          en: "Understand the 1% Lifetime Royalty Model",
          hinglish: "1% Lifetime Royalty Model Samjhein",
        },
        body: {
          en: "Whenever a creator or brand in your onboarded network completes a paid collaboration, you receive 1% of the gross deal value credited directly from platform treasury.",
          hinglish: "Aapke network ka koi bhi creator ya brand jab deal poori karta hai, deal amount ka 1% sidhe platform treasury se aapke wallet me credit hota hai.",
        },
        uiRef: "RoyaltyModelCard",
      },
      {
        title: {
          en: "Review Deduplication Terms",
          hinglish: "Single-Credit Deduplication Niyam",
        },
        body: {
          en: "If both the brand and creator participating in a deal were referred by you, you receive a clean single 1% royalty credit on the transaction.",
          hinglish: "Agar deal ke brand aur creator dono aapke referred hain, to transaction par single 1% credit secure hota hai.",
        },
      },
    ],
    rules: [
      {
        en: "Scout royalties are lifetime recurring for as long as both your scout account and referred partners remain in good standing.",
        hinglish: "Royalty lifetime milti rehti hai jab tak accounts active aur community rules ke mutabik chalte hain.",
      },
      {
        en: "Attempting to create fictitious shell accounts to game commissions results in immediate badge revocation and fund forfeiture.",
        hinglish: "Commission ke liye fake accounts banana strict platform ban aur funds freeze ka karan banta hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "1% Deal Royalty", hinglish: "1% Deal Royalty" },
        description: {
          en: "Calculated as 100 basis points of the gross escrow payout upon final brand approval.",
          hinglish: "Final approval ke baad gross deal amount ka 1% platform commission ke roop me milta hai.",
        },
      },
    ],
    commonErrors: [],
    faqs: [
      {
        question: { en: "Does the creator or brand pay my 1% royalty?", hinglish: "Kya creator ya brand meri royalty apni pocket se deta hai?" },
        answer: {
          en: "No. Your royalty is paid directly by VyaparMedia from the platform's standard service fee. It never reduces creator earnings.",
          hinglish: "Nahi, royalty VyaparMedia apni platform fee se deta hai; creator ya brand ki payment me koi katauti nahi hoti.",
        },
      },
    ],
    related: ["scout-verification-gate", "scout-royalties-and-wallet"],
    supportCta: {
      label: { en: "Contact Scout Desk", hinglish: "Scout Desk se Baat Karein" },
      href: "/dashboard/support",
    },
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 2. Becoming a Scout (Selfie Verification Gate, 18+ KYC, Rejection Criteria)
  {
    id: "scout-verification-gate",
    roles: ["SCOUT"],
    area: "kyc",
    routes: ["/dashboard", "/dashboard/settings"],
    title: {
      en: "Scout 18+ KYC Verification & Live Selfie Gate",
      hinglish: "Scout 18+ KYC Verification aur Live Selfie Gate",
    },
    summary: {
      en: "Complete mandatory 18+ identity verification: submit PAN, masked Aadhaar, college credentials, and live selfie photo to unlock your scout dashboard.",
      hinglish: "18+ KYC verification poori karein: PAN, Aadhaar, college info aur live selfie upload karke dashboard unlock karein.",
    },
    whenToUse: {
      en: "When your scout dashboard displays the verification gate or when updating rejected identity documents.",
      hinglish: "Jab aapka account verification pending ho ya document resubmit karna ho.",
    },
    steps: [
      {
        title: {
          en: "Input Legal Name & College Details",
          hinglish: "Apna Naam aur College Details Dalein",
        },
        body: {
          en: "Provide your full legal name, city, state, and registered college or university campus.",
          hinglish: "Apna poora legal naam, city, state aur college/university ka naam enter karein.",
        },
        uiRef: "ScoutVerificationGate",
      },
      {
        title: {
          en: "Submit PAN & Aadhaar Numbers",
          hinglish: "PAN aur Aadhaar Number Enter Karein",
        },
        body: {
          en: "Enter your 10-digit PAN (automatically normalized to uppercase) and 12-digit Aadhaar (automatically masked to XXXXXXXX1234 for UIDAI compliance).",
          hinglish: "10-digit PAN aur 12-digit Aadhaar dalein (UIDAI niyam ke anusar Aadhaar auto-mask ho jata hai).",
        },
      },
      {
        title: {
          en: "Upload Live Selfie Photo (<10MB)",
          hinglish: "Live Selfie Photo Upload Karein (<10MB)",
        },
        body: {
          en: "Upload a clean, clear photo under 10MB (JPG, PNG, WebP). Face must be unobstructed in good lighting.",
          hinglish: "10MB se chhoti clear selfie upload karein jisme chehra saaf dikh raha ho.",
        },
        uiRef: "SelfieUploadWidget",
      },
    ],
    rules: [
      {
        en: "Scouts must be at least 18 years of age to legally enter commercial partnership contracts in India.",
        hinglish: "Indian contract law ke mutabik Campus Scout banne ke liye kam se kam 18 saal ka hona anivarya hai.",
      },
      {
        en: "Photos with sunglasses, face masks, extreme digital beauty filters, or blurry camera resolution are automatically rejected.",
        hinglish: "Sunglasses, mask, heavy filters ya dhundhli photos ko verification team reject kar deti hai.",
      },
      {
        en: "Administrative review SLA is strictly 24 to 48 hours. You will receive an instant notification upon approval.",
        hinglish: "Admin review me 24 se 48 ghante ka samay lagta hai, approval aate hi turant alert mil jata hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "10MB Upload Limit", hinglish: "10MB Upload Limit" },
        description: {
          en: "Maximum supported file size for live identity verification photo assets.",
          hinglish: "Selfie document upload karne ki maximum allowable size.",
        },
      },
    ],
    commonErrors: [
      {
        symptom: { en: "Verification shows 'REJECTED' with reason", hinglish: "Verification 'REJECTED' dikha raha hai" },
        cause: { en: "Name mismatch between PAN/Aadhaar or selfie face was partially covered", hinglish: "PAN/Aadhaar ka naam match nahi hua ya photo me chehra dhaka hua tha" },
        fix: { en: "Review the rejectionReason box on screen, correct legal name spelling, and upload a fresh well-lit selfie", hinglish: "Screen par rejection reason padhein, sahi naam likhein aur achhi roshni me nayi photo dalein" },
      },
    ],
    faqs: [
      {
        question: { en: "Can I earn before my KYC is approved?", hinglish: "Kya KYC approve hone se pehle kama sakte hain?" },
        answer: {
          en: "No. Your scout referral link and QR code unlock only after administrative identity approval.",
          hinglish: "Nahi, referral link aur QR code KYC approval ke baad hi activate hote hain.",
        },
      },
    ],
    related: ["scout-program-overview", "scout-dashboard-overview"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 3. Dashboard Overview (Streak counters, monthly quota, quick metrics, share links)
  {
    id: "scout-dashboard-overview",
    roles: ["SCOUT"],
    area: "scout",
    routes: ["/dashboard"],
    title: {
      en: "Scout Dashboard: Streaks, Monthly Quotas & Share Links",
      hinglish: "Scout Dashboard: Streaks, Quota aur Share Links",
    },
    summary: {
      en: "Navigate your scout command center: track your monthly active streak, monitor quota days remaining, and copy specialized creator/brand referral URLs.",
      hinglish: "Apna scout command center samjhein: monthly streak track karein, quota status dekhein aur invite links share karein.",
    },
    whenToUse: {
      en: "Daily check-in to monitor referred partner registrations, deal conversions, and monthly quota maintenance.",
      hinglish: "Jab aapko naye signups, ongoing deals aur monthly streak status check karna ho.",
    },
    steps: [
      {
        title: {
          en: "Copy Role-Specific Invite Links",
          hinglish: "Role-Specific Links Copy Karein",
        },
        body: {
          en: "Use the dedicated 'Creator Link' (pre-selects Influencer mode) or 'Brand Link' (pre-selects Brand onboarding) to boost partner conversion.",
          hinglish: "Creators ke liye Creator Link aur local business ke liye Brand Link copy karke share karein.",
        },
        uiRef: "ShareableLinksCard",
      },
      {
        title: {
          en: "Track Monthly Active Streak",
          hinglish: "Monthly Active Streak Track Karein",
        },
        body: {
          en: "View your active month streak counter. Onboarding at least 1 verified partner or driving completed deals maintains your continuous royalty qualification.",
          hinglish: "Apna active streak counter dekhein; har mahine active rehne par continuous royalty status barkaraar rehta hai.",
        },
        uiRef: "MonthlyQuotaCard",
      },
      {
        title: {
          en: "Review Network Counters",
          hinglish: "Network Counters Dekhein",
        },
        body: {
          en: "Inspect total onboarded creators vs verified brands and monitor cumulative lifetime royalty earnings.",
          hinglish: "Total creators, verified brands aur ab tak ki kul royalty kamai ek nazar me dekhein.",
        },
      },
    ],
    rules: [
      {
        en: "Monthly quota evaluates at the end of each calendar month. Inactive streaks pause recurring royalties until new partner onboarding resumes.",
        hinglish: "Har mahine ke aakhri me quota check hota hai; inactive hone par nayi deal hone tak royalty pause ho sakti hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Streak Months", hinglish: "Streak Months" },
        description: {
          en: "Consecutive months where you onboarded verified talent or facilitated completed escrow deals.",
          hinglish: "Lagataar kitne mahino se aapka campus scout status actively perform kar raha hai.",
        },
      },
    ],
    commonErrors: [],
    faqs: [],
    related: ["scout-inviting-creators", "scout-inviting-brands"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 4. Inviting Influencers / Content Creators (Link/Code Sharing)
  {
    id: "scout-inviting-creators",
    roles: ["SCOUT"],
    area: "scout",
    routes: ["/dashboard/referrals"],
    title: {
      en: "Onboarding Campus Creators & Influencers",
      hinglish: "Student Creators aur Influencers ko Onboard Karna",
    },
    summary: {
      en: "How to pitch student creators on campus, guide them through social account connection, and earn lifetime royalties on every sponsorship they win.",
      hinglish: "Campus creators ko invite karein, unka profile setup karwayein aur unki har brand deal par kamayein.",
    },
    whenToUse: {
      en: "When recruiting campus creators from college fests, media societies, dance clubs, or student communities.",
      hinglish: "Jab aap college fests, societies ya hostel groups me creators ko VyaparMedia par invite kar rahe hon.",
    },
    steps: [
      {
        title: {
          en: "Share Creator Invite URL",
          hinglish: "Creator Invite Link Bhejein",
        },
        body: {
          en: "Send your custom creator invite link (e.g. vyaparmedia.in/register?ref=SCOUTCODE&role=creator) via WhatsApp or Instagram DM.",
          hinglish: "Apna specific creator invite link WhatsApp ya Instagram bio me share karein.",
        },
        uiRef: "CreatorInviteShareButton",
      },
      {
        title: {
          en: "Guide Through Social Account Sync",
          hinglish: "Social Account Sync Karwayein",
        },
        body: {
          en: "Remind creators to connect their Instagram Professional or YouTube account so their profile displays verified follower metrics.",
          hinglish: "Creator ko Instagram/YouTube connect karne ko kahein taaki unhe brand deals milna shuru ho sakein.",
        },
      },
      {
        title: {
          en: "Send WhatsApp Nudge for KYC",
          hinglish: "WhatsApp se Nudge Karein",
        },
        body: {
          en: "If a creator is marked 'PENDING_KYC', click the green 'Nudge' button in your network pipeline table to open a pre-filled WhatsApp encouragement message.",
          hinglish: "Agar creator ka KYC pending hai, to 'Nudge' button dabakar WhatsApp par unhe direct reminder bhejein.",
        },
        uiRef: "NudgeButton",
      },
    ],
    rules: [
      {
        en: "Creators must pass identity verification and sync social channels to qualify your monthly quota bonus.",
        hinglish: "Creator ka KYC aur social media verify hone par hi scout quota count hota hai.",
      },
    ],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["scout-network-pipeline", "scout-offline-qr-code"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 5. Inviting Local Brands / Businesses
  {
    id: "scout-inviting-brands",
    roles: ["SCOUT"],
    area: "scout",
    routes: ["/dashboard/referrals"],
    title: {
      en: "Onboarding Local Brands, Cafes & Campus Businesses",
      hinglish: "Local Brands, Cafes aur Businesses ko Onboard Karna",
    },
    summary: {
      en: "Pitch local restaurants, student startups, apparel stores, and campus fest sponsors to run escrow-protected marketing campaigns on VyaparMedia.",
      hinglish: "Local cafes, restaurants aur startups ko secure influencer campaigns run karne ke liye invite karein.",
    },
    whenToUse: {
      en: "When speaking with local business owners who want footfall from student influencers but fear advance payment scams.",
      hinglish: "Jab local dukandar ya cafe owner se baat karein jo influencers se promotion karwana chahte hain.",
    },
    steps: [
      {
        title: {
          en: "Pitch 100% Escrow Protection",
          hinglish: "100% Escrow Safety Pitch Karein",
        },
        body: {
          en: "Explain that VyaparMedia holds payments in platform custody until creators deliver approved reels, eliminating advance payment risks.",
          hinglish: "Samjhayein ki brand ka paisa platform par safe rehta hai aur creator ko tabhi milta hai jab reel approve ho jaye.",
        },
      },
      {
        title: {
          en: "Share Brand Onboarding Link",
          hinglish: "Brand Onboarding Link Bhejein",
        },
        body: {
          en: "Provide your brand referral link (e.g. vyaparmedia.in/register?ref=SCOUTCODE&role=brand) so their merchant account binds to your network.",
          hinglish: "Apna specific brand referral link dein taaki unki company aapke scout network se jud jaye.",
        },
        uiRef: "BrandInviteShareButton",
      },
    ],
    rules: [
      {
        en: "You earn 1% on every single campaign budget successfully executed by onboarded brands.",
        hinglish: "Aapke laye huye brand ke har campaign budget par aapko 1% commission milta hai.",
      },
    ],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["scout-program-overview", "scout-royalties-and-wallet"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 6. Offline QR Code (How to Use, Tracking)
  {
    id: "scout-offline-qr-code",
    roles: ["SCOUT"],
    area: "scout",
    routes: ["/dashboard"],
    title: {
      en: "Offline Campus QR Codes & Physical Promotional Assets",
      hinglish: "Offline Campus QR Code aur Posters",
    },
    summary: {
      en: "Generate dynamic QR codes client-side, print on college noticeboards, fest banners, and club flyers, and capture offline registrations automatically.",
      hinglish: "Apna personalized QR code generate karein, college posters aur flyers par lagayein aur offline signups payein.",
    },
    whenToUse: {
      en: "During campus events, college orientations, fest stalls, or offline marketing drives.",
      hinglish: "College fests, fresher events ya offline orientation ke dauraan poster lagane ke liye.",
    },
    steps: [
      {
        title: {
          en: "Open QR Code Modal",
          hinglish: "QR Code Modal Kholein",
        },
        body: {
          en: "Click 'Offline QR Code' on your dashboard. An SVG/PNG QR code is generated instantly using the qrcode engine.",
          hinglish: "Dashboard par 'Offline QR Code' dabayein; aapka verified referral QR screen par aa jata hai.",
        },
        uiRef: "QrCodeModalButton",
      },
      {
        title: {
          en: "Download & Print on Campus Media",
          hinglish: "Download karke Posters par Print Karein",
        },
        body: {
          en: "Save the high-resolution image to integrate into campus festival banners, student society brochures, or table stands.",
          hinglish: "High-resolution QR download karke college noticeboard ya event flyers par lagayein.",
        },
      },
      {
        title: {
          en: "Track Scan Conversions",
          hinglish: "Scan Conversions Track Karein",
        },
        body: {
          en: "When students scan the code, your scoutCode binds to their registration session permanently.",
          hinglish: "Scan karte hi student ke account me aapka scout referral permanently attach ho jata hai.",
        },
      },
    ],
    rules: [],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["scout-inviting-creators", "scout-network-pipeline"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 7. Network Pipeline Table (Statuses, Stages, When You Earn)
  {
    id: "scout-network-pipeline",
    roles: ["SCOUT"],
    area: "scout",
    routes: ["/dashboard/referrals"],
    title: {
      en: "Network Pipeline Table: Partner Statuses & Deal Volumes",
      hinglish: "Network Pipeline Table: Partner Status aur Deal Volume",
    },
    summary: {
      en: "Manage your complete referred roster: filter creators vs brands, check KYC statuses, track completed deals, and review total volume.",
      hinglish: "Apna poora network table dekhein: verified partners, pending KYC aur unke dwara generate ki gayi deal volume.",
    },
    whenToUse: {
      en: "When monitoring partner activation progress or identifying which creators need a nudge to complete onboarding.",
      hinglish: "Jab dekhna ho ki kin creators ne account banaya par abhi tak profile verify nahi kiya.",
    },
    steps: [
      {
        title: {
          en: "Filter by Partner Type",
          hinglish: "Creators aur Brands ko Filter Karein",
        },
        body: {
          en: "Toggle between Creators and Brands to inspect individual registration dates and handle links.",
          hinglish: "Creators aur Brands ke beech toggle karke unki join date aur profile handle dekhein.",
        },
        uiRef: "NetworkFilterTabs",
      },
      {
        title: {
          en: "Understand Partner Statuses",
          hinglish: "Partner Status Samjhein",
        },
        body: {
          en: "'VERIFIED' indicates active profile with completed KYC ready for deals. 'PENDING_KYC' means identity documents are still missing.",
          hinglish: "'VERIFIED' ka matlab partner active hai. 'PENDING_KYC' ka matlab abhi PAN/bank details bharni bachi hain.",
        },
        uiRef: "PartnerStatusBadge",
      },
      {
        title: {
          en: "Track Completed Deal Volume",
          hinglish: "Deal Volume aur Royalty Dekhein",
        },
        body: {
          en: "Inspect 'Deals Completed' and 'Total Volume' columns. Every settled deal automatically remits 1% of this volume into your wallet.",
          hinglish: "Total Volume column me dekhein ki partner ne kitne rupaye ki deals ki hain; iska 1% aapka reward banta hai.",
        },
      },
    ],
    rules: [
      {
        en: "Scouts only earn royalties once a deal reaches 'COMPLETED' status with escrow funds released.",
        hinglish: "Royalty tabhi milti hai jab deal complete ho jaye aur brand dwara escrow release ho chuka ho.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "VERIFIED Status", hinglish: "VERIFIED Status" },
        description: {
          en: "Partner has connected official social channels or verified corporate GSTIN.",
          hinglish: "Partner ne social media ya business details verify karwa li hain.",
        },
      },
    ],
    commonErrors: [],
    faqs: [],
    related: ["scout-royalties-and-wallet", "scout-inviting-creators"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 8. Earnings & Wallet (When/How Credited, Withdrawal, TDS/KYC)
  {
    id: "scout-royalties-and-wallet",
    roles: ["SCOUT"],
    area: "wallet",
    routes: ["/dashboard/wallet"],
    title: {
      en: "Scout Wallet: Double-Entry Royalties, IMPS & Tax Withholding",
      hinglish: "Scout Wallet: Royalty Credit, IMPS Payout aur TDS",
    },
    summary: {
      en: "Learn how royalties are credited via platform treasury debits, request instant IMPS bank withdrawals, and review Section 194-H TDS withholding.",
      hinglish: "Samjhein royalty wallet me kaise aati hai, bank me payout kaise lein aur tax niyam kya hain.",
    },
    whenToUse: {
      en: "When reviewing accumulated royalty balances or transferring earned commissions to your personal bank account.",
      hinglish: "Jab aapko apni kamai check karni ho ya bank account me paise transfer karne hon.",
    },
    steps: [
      {
        title: {
          en: "Inspect Automated Treasury Credits",
          hinglish: "Automated Royalty Credits Dekhein",
        },
        body: {
          en: "Royalties credit in real time upon deal completion as a double-entry transaction (Platform Treasury Debit ➔ Scout Wallet Credit).",
          hinglish: "Deal complete hote hi real-time me treasury se 1% commission aapke wallet me credit ho jata hai.",
        },
        uiRef: "ScoutWalletLedger",
      },
      {
        title: {
          en: "Link Verified Bank Account",
          hinglish: "Bank Account Add Karein",
        },
        body: {
          en: "Add your personal bank account number and IFSC. Automated penny-drop confirms matching legal entity credentials.",
          hinglish: "Apna bank account aur IFSC dalein; penny-drop se naam verify hote hi withdrawal unlock ho jata hai.",
        },
        uiRef: "BankAccountManager",
      },
      {
        title: {
          en: "Request Instant Withdrawal",
          hinglish: "Instant Withdrawal Request Karein",
        },
        body: {
          en: "Once your balance reaches {{wallet.min_withdrawal}}, submit an instant IMPS transfer request to receive funds within seconds.",
          hinglish: "{{wallet.min_withdrawal}} balance hote hi withdraw par tap karein, paise turant bank me aa jate hain.",
        },
        uiRef: "WithdrawModal",
      },
    ],
    rules: [
      {
        en: "Minimum withdrawal threshold is {{wallet.min_withdrawal}} to minimize banking settlement fees.",
        hinglish: "Kam se kam withdrawal limit {{wallet.min_withdrawal}} rakhi gayi hai.",
      },
      {
        en: "Scout commission withdrawals are subject to statutory Indian TDS withholding under Section 194-H/194-O, reflected in your Form 26AS.",
        hinglish: "Commission par government niyam ke mutabik TDS deduct hota hai jo aapke Form 26AS me record hota hai.",
      },
    ],
    numbersExplained: [
      {
        label: { en: "Minimum Payout ({{wallet.min_withdrawal}})", hinglish: "Minimum Payout ({{wallet.min_withdrawal}})" },
        description: {
          en: "Smallest balance required to trigger an automated IMPS bank transfer.",
          hinglish: "Bank transfer ke liye zaroori minimum wallet balance.",
        },
      },
    ],
    commonErrors: [],
    faqs: [
      {
        question: { en: "Are there charges on scout bank withdrawals?", hinglish: "Kya withdrawal par koi charge lagta hai?" },
        answer: {
          en: "No. Standard IMPS transfers to verified Indian bank accounts are completely free.",
          hinglish: "Nahi, verified Indian bank accounts me transfer bilkul free hota hai.",
        },
      },
    ],
    related: ["scout-program-overview", "scout-network-pipeline"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 9. Campus Talent Scout Certificate (Eligibility, Download/Print)
  {
    id: "scout-campus-certificate",
    roles: ["SCOUT"],
    area: "scout",
    routes: ["/dashboard"],
    title: {
      en: "Campus Talent Scout Certificate & Internship Credential",
      hinglish: "Campus Scout Certificate aur Internship Credential",
    },
    summary: {
      en: "Earn and download an official verified Campus Talent Scout Certificate complete with cryptographic integrity ID to validate your marketing internship.",
      hinglish: "Apna official verified Campus Scout Certificate download karein aur resume ya LinkedIn par share karein.",
    },
    whenToUse: {
      en: "When submitting internship proof to your college placement cell, adding credentials to LinkedIn, or building your marketing portfolio.",
      hinglish: "College placement cell me internship proof jama karne ya LinkedIn par share karne ke liye.",
    },
    steps: [
      {
        title: {
          en: "Achieve Active Scout Qualification",
          hinglish: "Certificate Eligibility Poori Karein",
        },
        body: {
          en: "Pass 18+ KYC verification and maintain an active monthly streak with at least 5 verified creator onboardings.",
          hinglish: "KYC verify karwayein aur kam se kam 5 verified creators onboard karke eligibility unlock karein.",
        },
      },
      {
        title: {
          en: "Download Official Branded PDF",
          hinglish: "Official PDF Certificate Download Karein",
        },
        body: {
          en: "Click 'Download Certificate' on your dashboard. An official letterhead certificate with corporate seal renders instantly.",
          hinglish: "Dashboard se 'Download Certificate' par tap karke official signed PDF save karein.",
        },
        uiRef: "DownloadCertificateButton",
      },
      {
        title: {
          en: "Verify Authenticity Online",
          hinglish: "Online Authenticity Check Karein",
        },
        body: {
          en: "Each certificate includes a unique verification code verifiable on /verify-report for recruiters and university officials.",
          hinglish: "Certificate par diya gaya unique code recruiter ko online verify karne ki suvidha deta hai.",
        },
      },
    ],
    rules: [
      {
        en: "Certificates are issued only to accounts in good standing without fraud strikes.",
        hinglish: "Certificate sirf un scouts ko milta hai jinke account par koi policy violation na ho.",
      },
    ],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["scout-dashboard-overview", "scout-verification-gate"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 10. Referral Rules / Limits / Anti-Abuse (Suspension Rules)
  {
    id: "scout-anti-abuse-rules",
    roles: ["SCOUT"],
    area: "scout",
    routes: ["/dashboard/referrals"],
    title: {
      en: "Anti-Abuse Safeguards, Fraud Policies & Account Suspension",
      hinglish: "Anti-Abuse Safeguards aur Fraud Prevention Niyam",
    },
    summary: {
      en: "Understand strict platform anti-abuse rules: self-referral prohibitions, bot detection, dormant streak penalties, and fund forfeiture protocols.",
      hinglish: "Samjhein kin galatiyon se scout account suspend ho sakta hai aur fraud detection kaise kaam karta hai.",
    },
    whenToUse: {
      en: "When reviewing program compliance boundaries or understanding why an account was flagged for review.",
      hinglish: "Program rules samajhne ke liye taaki galti se koi violation na ho.",
    },
    steps: [
      {
        title: {
          en: "Avoid Self-Referrals",
          hinglish: "Self-Referral se Bachein",
        },
        body: {
          en: "Never use your own scout link to register secondary creator or brand profiles operated by you. The audit engine detects shared device fingerprints and IP patterns.",
          hinglish: "Apne hi link se apna dusra account na banayein; system device aur IP detect karke block kar deta hai.",
        },
      },
      {
        title: {
          en: "Ensure Real Human Creators",
          hinglish: "Real Creators ko hi Onboard Karein",
        },
        body: {
          en: "Referred partners must have genuine active social media profiles. Onboarding bot accounts triggers an immediate freeze.",
          hinglish: "Sirf genuine creators ko laayein; fake profiles add karne par scout rights revoke ho sakti hain.",
        },
      },
    ],
    rules: [
      {
        en: "Scouts caught engaging in artificial transaction cycling face permanent account banning and forfeiture of pending balances.",
        hinglish: "Fake deals create karne par account permanently ban aur pending balance forfeit ho jata hai.",
      },
      {
        en: "Dormant scouts who fail to log in or onboard partners for 90 consecutive days have their active royalty paused.",
        hinglish: "Lagataar 90 din tak completely inactive rehne par royalty pause ho sakti hai.",
      },
    ],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["scout-program-overview", "scout-royalties-and-wallet"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 11. Role Conversion (Converting Scout to Creator or Brand)
  {
    id: "scout-role-conversion",
    roles: ["SCOUT"],
    area: "security",
    routes: ["/dashboard/settings"],
    title: {
      en: "Role Conversion: Transitioning from Scout to Creator or Brand",
      hinglish: "Role Conversion: Scout se Creator ya Brand Banna",
    },
    summary: {
      en: "Learn how Campus Scouts can convert their account into a full Creator or Brand account via /api/user/switch-role, and understand the one-way transition rule.",
      hinglish: "Jaaniye Scout account ko Creator ya Brand account me kaise badlein aur iske one-way rules kya hain.",
    },
    whenToUse: {
      en: "When you graduate or decide you want to actively participate as an influencer or brand marketer yourself.",
      hinglish: "Jab aap khud influencer ya brand ban kar deals shuru karna chahein.",
    },
    steps: [
      {
        title: {
          en: "Navigate to Account Conversion in Settings",
          hinglish: "Settings me Account Conversion par Jayein",
        },
        body: {
          en: "Scout accounts have exclusive entitlement to convert into INFLUENCER or BRAND entities. Select your target role.",
          hinglish: "Settings me jaakar 'Convert Account' chunein aur select karein ki aap Creator banna chahte hain ya Brand.",
        },
        uiRef: "RoleSwitchCard",
      },
      {
        title: {
          en: "Understand Profile Seed Transfer",
          hinglish: "Profile Data Transfer Samjhein",
        },
        body: {
          en: "Your verified legal name, city, and phone number are automatically carried over into your new Creator or Brand profile.",
          hinglish: "Aapka verified naam aur phone number naye profile me automatically copy ho jata hai.",
        },
      },
      {
        title: {
          en: "Acknowledge One-Way Transition",
          hinglish: "One-Way Conversion Rule Accept Karein",
        },
        body: {
          en: "Once converted to INFLUENCER or BRAND, the account becomes legally immutable to prevent escrow conflicts of interest.",
          hinglish: "Ek baar Creator ya Brand banne ke baad account wapas Scout nahi ban sakta taaki escrow rules safe rahein.",
        },
      },
    ],
    rules: [
      {
        en: "Scouts are the only platform user type permitted to execute voluntary role conversion.",
        hinglish: "Kewal Scout users ko hi role switch karne ki permission hoti hai.",
      },
      {
        en: "Once converted, your scout referral link is permanently deactivated.",
        hinglish: "Role convert karne ke baad aapka purana scout referral link deactivate ho jata hai.",
      },
    ],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["scout-program-overview", "scout-settings-security"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 12. Notifications
  {
    id: "scout-notifications",
    roles: ["SCOUT"],
    area: "general",
    routes: ["/dashboard/notifications"],
    title: {
      en: "Scout Notifications & Real-Time Partner Alerts",
      hinglish: "Scout Notifications aur Partner Alerts",
    },
    summary: {
      en: "Receive instant notifications when a referred creator registers, passes KYC, or earns you a deal royalty.",
      hinglish: "Real-time alerts paayein jab koi aapke link se join kare, verify ho ya deal complete karke royalty kamaye.",
    },
    whenToUse: {
      en: "When reviewing activity feeds or configuring push notifications for your partner network.",
      hinglish: "Jab aapko naye partner signups aur royalty credits ke alerts check karne hon.",
    },
    steps: [
      {
        title: {
          en: "Monitor Activity Alerts",
          hinglish: "Activity Alerts Check Karein",
        },
        body: {
          en: "Alerts flag milestones: 'New Creator Joined', 'Partner KYC Verified', and '₹ Royalty Credited'.",
          hinglish: "Alerts me saaf dikhta hai: naya signup, KYC approval ya wallet me commission credit.",
        },
        uiRef: "NotificationFeed",
      },
    ],
    rules: [],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["scout-dashboard-overview"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 13. Settings / Security
  {
    id: "scout-settings-security",
    roles: ["SCOUT"],
    area: "security",
    routes: ["/dashboard/settings"],
    title: {
      en: "Scout Settings: Profile Details, 2FA & Telemetry",
      hinglish: "Scout Settings: Profile, 2FA Security aur Privacy",
    },
    summary: {
      en: "Update contact details, secure wallet payouts with Two-Factor Authentication, and configure privacy preferences.",
      hinglish: "Apni profile update karein, payout safe rakhne ke liye 2FA lagayein aur privacy settings manage karein.",
    },
    whenToUse: {
      en: "When updating college info, changing password, or securing your account with Google Authenticator.",
      hinglish: "Jab college details update karni hon ya withdrawal security ke liye 2FA enable karna ho.",
    },
    steps: [
      {
        title: {
          en: "Enable 2FA TOTP Protection",
          hinglish: "2FA TOTP On Karein",
        },
        body: {
          en: "Scan the QR code with Google Authenticator. Every withdrawal from your scout wallet will require this 6-digit passcode.",
          hinglish: "Google Authenticator se QR scan karein; har bank transfer par 6-digit OTP code zaroori hoga.",
        },
        uiRef: "TwoFactorAuthCard",
      },
    ],
    rules: [],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["scout-royalties-and-wallet"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 14. Support Desk
  {
    id: "scout-support-desk",
    roles: ["SCOUT"],
    area: "general",
    routes: ["/dashboard/support", "/dashboard/messages"],
    title: {
      en: "Scout Priority Support Desk & Campus Assistance",
      hinglish: "Scout Priority Help Desk aur Campus Assistance",
    },
    summary: {
      en: "Access dedicated scout support for verification assistance, offline fest sponsorship collateral, or referral attribution inquiries.",
      hinglish: "KYC verification, college fest sponsorship ya referral tracking queries ke liye support team se contact karein.",
    },
    whenToUse: {
      en: "When a referred partner forgot to use your link, or when requesting physical banner materials for college fests.",
      hinglish: "Jab kisi referral ko manually map karwana ho ya college event ke liye promotional material maangna ho.",
    },
    steps: [
      {
        title: {
          en: "Open Scout Ticket",
          hinglish: "Scout Ticket Banayein",
        },
        body: {
          en: "Select topic (Verification Delay, Partner Attribution, Fest Collateral, Payout Issue) and provide details.",
          hinglish: "Category select karein aur partner email ya fest details likhkar ticket submit karein.",
        },
        uiRef: "CreateTicketForm",
      },
    ],
    rules: [],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["scout-dashboard-overview"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },

  // 15. Leaderboard
  {
    id: "scout-leaderboard",
    roles: ["SCOUT"],
    area: "scout",
    routes: ["/dashboard/leaderboard"],
    title: {
      en: "Campus Partner Leaderboard & Regional Ranks",
      hinglish: "Campus Scout Leaderboard aur Regional Ranks",
    },
    summary: {
      en: "View top performing campus scouts across Indian universities, track regional onboarding milestones, and compete for top ambassador spotlights.",
      hinglish: "Desh bhar ke top campus scouts ke rankings dekhein aur top ambassador banne ke liye compete karein.",
    },
    whenToUse: {
      en: "When checking your regional rank among campus marketing partners.",
      hinglish: "Jab aapko university aur national level par apna scout rank dekhna ho.",
    },
    steps: [
      {
        title: {
          en: "Inspect University Ranks",
          hinglish: "University Ranks Dekhein",
        },
        body: {
          en: "Check rankings by total onboarded creators, active deals facilitated, and monthly onboarding velocity.",
          hinglish: "Creators onboarding aur deals facilitation ke aadhar par apna college rank dekhein.",
        },
        uiRef: "LeaderboardRankCard",
      },
    ],
    rules: [],
    numbersExplained: [],
    commonErrors: [],
    faqs: [],
    related: ["scout-dashboard-overview"],
    lastReviewedAt: "2026-11-24",
    version: "1.0.0",
  },
];
