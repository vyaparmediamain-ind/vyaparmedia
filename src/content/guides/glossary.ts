import { GlossaryTermSchema, type GlossaryTerm, type GlossaryTermCategory } from "@/lib/guides/schema";

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    id: "escrow",
    category: "FINANCE",
    term: {
      en: "Escrow (Secure Lock)",
      hinglish: "Escrow (Surakshit Deposit Lock)",
    },
    definition: {
      en: "A financial arrangement where the deal amount is held securely in an RBI-compliant nodal account until all agreed campaign milestones are verified and completed.",
      hinglish: "Ek financial security arrangement jisme brand ka paisa RBI-compliant nodal account me locked rehta hai jab tak creator ke saare deliverables approve nahi ho jaate.",
    },
    example: {
      en: "When a deal is accepted, 100% of the deal amount is funded into escrow before the creator begins filming.",
      hinglish: "Deal accept hote hi brand ka 100% paisa escrow me lock ho jaata hai taaki creator bina kisi payment risk ke content bana sake.",
    },
    relatedTerms: ["nodal-account", "milestone", "payout"],
  },
  {
    id: "milestone",
    category: "DEALS",
    term: {
      en: "Milestone",
      hinglish: "Milestone (Kaam Ka Padav)",
    },
    definition: {
      en: "A distinct stage in a campaign workflow (e.g., Draft Submission, Final Post, 48-Hour Retention Check) tied to approval requirements or partial escrow release.",
      hinglish: "Campaign ka ek step ya phase (jaise Script approval, Draft video, Live post, ya Retention check) jiske complete hone par aage ka process ya payment unlock hota hai.",
    },
    example: {
      en: "Milestone 1 covers video draft approval; Milestone 2 covers posting on Instagram and keeping it live for 30 days.",
      hinglish: "Milestone 1 me draft video approve hoti hai aur Milestone 2 me Instagram par live post share ki jaati hai.",
    },
    relatedTerms: ["escrow", "deliverable", "payout"],
  },
  {
    id: "payout",
    category: "FINANCE",
    term: {
      en: "Payout",
      hinglish: "Payout (Payment Withdrawal)",
    },
    definition: {
      en: "The electronic transfer of net earnings (after statutory TDS and platform fees) from the VyaparMedia wallet to a verified beneficiary bank account via IMPS/NEFT.",
      hinglish: "Creator ya scout ke wallet balance ka statutory TDS aur platform fees katne ke baad verified bank account me electronic transfer (IMPS/NEFT/UPI).",
    },
    example: {
      en: "Payouts are disbursed automatically within 24-48 hours once requested to your penny-drop verified bank account.",
      hinglish: "Bank account penny-drop verify hone ke baad requested payout 24-48 ghante me direct account me credit ho jaata hai.",
    },
    relatedTerms: ["wallet-ledger", "tds", "nodal-account"],
  },
  {
    id: "kyc",
    category: "COMPLIANCE",
    term: {
      en: "KYC (Know Your Customer)",
      hinglish: "KYC (Pehchan Satypan)",
    },
    definition: {
      en: "Mandatory statutory identity verification requiring PAN and bank account verification to comply with RBI, PMLA, and Income Tax statutory guidelines before processing financial withdrawals.",
      hinglish: "RBI aur Income Tax rules ke tahat zaroori identity verification jisme PAN card aur bank account penny-drop check kiya jaata hai taaki withdrawals legally process ho sakein.",
    },
    example: {
      en: "Completing PAN KYC ensures you are taxed at the concessional 0.1% TDS under Section 194-O rather than the 5% penal rate under Section 206AA.",
      hinglish: "PAN KYC complete karne se aapka TDS Section 194-O ke tahat sirf 0.1% katata hai, warna Section 206AA me 5% penal rate lag sakta hai.",
    },
    relatedTerms: ["tds", "payout", "gstin"],
  },
  {
    id: "drs",
    category: "REPUTATION",
    term: {
      en: "DRS (Dynamic Reliability Score)",
      hinglish: "DRS (Dynamic Reliability Score)",
    },
    definition: {
      en: "A continuous algorithmic trust metric (0 to 100) computed from on-time delivery rates, revision ratios, dispute history, communication responsiveness, and verified audience authenticity.",
      hinglish: "0 se 100 tak ka automatic trust score jo aapki on-time delivery, revision history, dispute record aur audience authenticity ke hisaab se calculate hota hai.",
    },
    example: {
      en: "A DRS above 80 unlocks instant brand deal invitations, priority search placement, and reduced escrow hold times.",
      hinglish: "80 se upar DRS score hone par direct invitations, search me priority ranking aur fast escrow release milti hai.",
    },
    relatedTerms: ["clawback", "dispute-arbitration", "deliverable"],
  },
  {
    id: "cpv",
    category: "METRICS",
    term: {
      en: "CPV (Cost Per View)",
      hinglish: "CPV (Cost Per View - Har View Ki Lagat)",
    },
    definition: {
      en: "A performance pricing metric calculated as total campaign spend divided by verified organic video views delivered by the creator.",
      hinglish: "Campaign ki performance naapne ka metric jisme total campaign cost ko creator ke verified organic views se divide kiya jaata hai.",
    },
    example: {
      en: "A deal costing ₹5,000 that delivers 50,000 verified views achieves a CPV of ₹0.10 (10 paise per view).",
      hinglish: "Agar ₹5,000 ki deal par 50,000 verified views milte hain, to CPV 10 paise (₹0.10) per view banta hai.",
    },
    relatedTerms: ["cpm", "deliverable"],
  },
  {
    id: "cpm",
    category: "METRICS",
    term: {
      en: "CPM (Cost Per Mille / 1,000 Impressions)",
      hinglish: "CPM (Har 1,000 Impressions Ki Lagat)",
    },
    definition: {
      en: "Standard advertising metric indicating the cost for every 1,000 verified impressions or views delivered across campaign posts.",
      hinglish: "Har 1,000 verified views ya impressions ki total lagat. Isse alag-alag creators ki value compare ki jaati hai.",
    },
    example: {
      en: "At a CPM of ₹120, reaching 100,000 targeted regional consumers costs ₹12,000.",
      hinglish: "₹120 CPM par 1 lakh consumers tak pahunchne ke liye total budget ₹12,000 lagega.",
    },
    relatedTerms: ["cpv"],
  },
  {
    id: "take-rate",
    category: "FINANCE",
    term: {
      en: "Take Rate (Platform Service Fee)",
      hinglish: "Take Rate (Platform Service Fee)",
    },
    definition: {
      en: "The percentage commission charged by VyaparMedia for escrow management, contracts, automated compliance, and dispute mediation services.",
      hinglish: "VyaparMedia dwara provide ki jaane wali escrow protection, contract automation aur dispute support ke badle liya jaane wala nominal service fee.",
    },
    example: {
      en: "The platform take rate is transparently displayed before deal confirmation and deducted from the gross deal value upon payout.",
      hinglish: "Deal confirm karne se pehle platform take rate saaf-saaf dikhaya jaata hai aur payout ke samay transparently deduct hota hai.",
    },
    relatedTerms: ["escrow", "payout"],
  },
  {
    id: "tds",
    category: "TAX",
    term: {
      en: "TDS (Tax Deducted at Source)",
      hinglish: "TDS (Tax Deducted at Source - Srot Par Tax)",
    },
    definition: {
      en: "Statutory income tax deducted by the platform and remitted to the Government of India under Section 194-O (0.1% for PAN-verified creators) or Section 206AA (5% penal rate for unverified PAN).",
      hinglish: "Bharat Sarkar ke Income Tax Act ke tahat platform dwara kaata gaya advance tax jo government treasury me deposit kiya jaata hai (PAN verified par 0.1% §194-O, bina PAN ke 5% §206AA).",
    },
    example: {
      en: "Creators receive quarterly Form 16A certificates to claim TDS credits against their annual income tax returns.",
      hinglish: "Har quarter ke baad creators ko Form 16A milta hai jisse wo apne ITR me TDS ka tax credit claim kar sakte hain.",
    },
    relatedTerms: ["kyc", "gstin", "payout"],
  },
  {
    id: "gstin",
    category: "TAX",
    term: {
      en: "GSTIN (Goods and Services Tax Identification Number)",
      hinglish: "GSTIN (GST Number)",
    },
    definition: {
      en: "A 15-character state-wise statutory tax identification number required for registered businesses to claim input tax credits (ITC) on platform service fees and invoices.",
      hinglish: "15-digit ka official GST number jisse registered brands aur businesses platform invoices par Input Tax Credit (ITC) claim kar sakte hain.",
    },
    example: {
      en: "Entering a valid GSTIN enables automated B2B tax invoicing with GSTR-1 matching for your brand expenditure.",
      hinglish: "Valid GSTIN enter karne se automated B2B invoice generate hota hai jisse brand ko full GST credit milta hai.",
    },
    relatedTerms: ["tds", "kyc"],
  },
  {
    id: "deliverable",
    category: "DEALS",
    term: {
      en: "Deliverable",
      hinglish: "Deliverable (Content Item)",
    },
    definition: {
      en: "A specific creative asset agreed upon in the deal contract, such as a 60-second Instagram Reel, YouTube Video integration, or carousel post with tracking link.",
      hinglish: "Deal contract me tay kiya gaya content (jaise 60-second Instagram Reel, YouTube dedicated video, ya post) jo creator ko agreed deadline par submit karna hota hai.",
    },
    example: {
      en: "The deliverable must remain publicly posted and viewable for the agreed monitoring window without deletion.",
      hinglish: "Deliverable ko post-monitoring window ke dauran public rakhna anivarya hai bina kisi deletion ya archiving ke.",
    },
    relatedTerms: ["milestone", "revisions", "review-window"],
  },
  {
    id: "nodal-account",
    category: "FINANCE",
    term: {
      en: "Nodal Account (Escrow Banking)",
      hinglish: "Nodal Account (RBI-Regulated Bank Khata)",
    },
    definition: {
      en: "A specialized, RBI-mandated bank account operated with scheduled commercial banks to hold brand escrow funds securely without commingling with operational company funds.",
      hinglish: "RBI guidelines ke anusar scheduled bank me khula alag dedicated account jisme brand ka escrow paisa rehta hai, jo company ke regular kharchon se bilkul alag aur safe hota hai.",
    },
    example: {
      en: "Funds in the nodal account can only be released upon mutual milestone verification or formal dispute arbitrator resolution.",
      hinglish: "Nodal account se paisa sirf tabhi transfer ho sakta hai jab milestone verify ho ya arbitrator official verdict de.",
    },
    relatedTerms: ["escrow", "payout"],
  },
  {
    id: "dispute-arbitration",
    category: "COMPLIANCE",
    term: {
      en: "Dispute Arbitration",
      hinglish: "Dispute Arbitration (Vivaad Samadhan)",
    },
    definition: {
      en: "The formal adjudication process where a neutral platform compliance officer reviews evidence (brief, submitted media, timestamped chat logs) to issue a binding, fair resolution.",
      hinglish: "Jab brand aur creator me kisi baat par sahmati na ho, tab neutral compliance officer briefs, drafts aur chat logs dekhkar fair aur binding faisla karta hai.",
    },
    example: {
      en: "Either party can raise a dispute if deliverables are rejected unfairly or if revisions exceed contractual limits.",
      hinglish: "Agar bina valid reason ke draft reject ho ya extra revisions maange jayein, to dono party dispute raise kar sakti hain.",
    },
    relatedTerms: ["escrow", "drs", "clawback"],
  },
  {
    id: "kill-switch",
    category: "SECURITY",
    term: {
      en: "Kill Switch",
      hinglish: "Kill Switch (Aapatkaalin Rok)",
    },
    definition: {
      en: "An emergency administrative control allowing immediate suspension of automated payouts, API integrations, or public campaigns during security incidents or anomalous activity.",
      hinglish: "Emergency admin control jisse kisi security incident ya suspect activity ke dauran payouts ya API integrations ko turant freeze kiya ja sakta hai.",
    },
    example: {
      en: "The Payout Kill Switch stops all pending bank transactions instantly if unusual withdrawal velocity is detected.",
      hinglish: "Agar achanak koi suspicious transactions dikhein, to Payout Kill Switch sabhi withdrawals ko hold par daal deta hai.",
    },
    relatedTerms: ["dead-letter-queue", "clawback"],
  },
  {
    id: "dead-letter-queue",
    category: "TECHNICAL",
    term: {
      en: "DLQ (Dead Letter Queue)",
      hinglish: "DLQ (Failed Tasks Queue)",
    },
    definition: {
      en: "An isolated diagnostic queue that stores background jobs, webhook notifications, or payment syncs that failed repeatedly after maximum retry attempts.",
      hinglish: "Ek technical queue jisme wo background tasks ya webhooks aate hain jo multiple attempts ke baad bhi fail ho gaye, taaki admin unhe inspect karke retry kar sake.",
    },
    example: {
      en: "Admin engineers inspect the DLQ to diagnose third-party bank webhook timeouts and safely replay them.",
      hinglish: "Admin team DLQ me jakar failed webhooks ka reason dekhti hai aur issue solve karke safe replay karti hai.",
    },
    relatedTerms: ["kill-switch"],
  },
  {
    id: "whitelisting",
    category: "DEALS",
    term: {
      en: "Whitelisting (Creator Ad Access)",
      hinglish: "Whitelisting (Creator Ad Permission)",
    },
    definition: {
      en: "Granting a brand advertiser permission to run paid meta-ads directly through the creator's social handle to boost reach and attribution.",
      hinglish: "Brand ko creator ke social handle se paid ads run karne ki permission dena, jisse post zyada targeted audience tak pahunch sake.",
    },
    example: {
      en: "Whitelisting requires explicit creator consent, separate compensation, and clear campaign date boundaries.",
      hinglish: "Whitelisting ke liye creator ki alag sahmati, extra compensation aur fixed time duration tay ki jaati hai.",
    },
    relatedTerms: ["deliverable", "cpv"],
  },
  {
    id: "wallet-ledger",
    category: "FINANCE",
    term: {
      en: "Wallet Ledger (Double-Entry Bookkeeping)",
      hinglish: "Wallet Ledger (Khaata Bahikhaata)",
    },
    definition: {
      en: "An immutable, double-entry financial record where every credit has a corresponding debit, ensuring full auditability of all balances in integer paise.",
      hinglish: "Ek permanent aur tamper-proof accounting ledger jisme har credit aur debit ka complete record paise me rehta hai, jisse koi calculation error na ho.",
    },
    example: {
      en: "Your balance reflects cleared ledger entries; pending milestone amounts are held in the escrow ledger until approved.",
      hinglish: "Aapka wallet balance verified ledger entries se banta hai; pending deals ka paisa alag escrow ledger me track hota hai.",
    },
    relatedTerms: ["escrow", "payout"],
  },
  {
    id: "clawback",
    category: "FINANCE",
    term: {
      en: "Clawback",
      hinglish: "Clawback (Rakam Vapasi)",
    },
    definition: {
      en: "The contractual recovery of released funds if post-monitoring reveals fraudulent views, artificial bots, or early deletion of agreed deliverables.",
      hinglish: "Agar deal complete hone ke baad post delete ho jaye ya fake bot views detect hon, to contract ke mutabik released payment ko recover kiya jaata hai.",
    },
    example: {
      en: "Deals require posts to remain active for the 30-day post-monitoring window to protect against clawbacks.",
      hinglish: "Clawback se bachne ke liye creator ko 30-day monitoring window tak post ko account par live rakhna anivarya hai.",
    },
    relatedTerms: ["drs", "dispute-arbitration"],
  },
  {
    id: "verification-badge",
    category: "REPUTATION",
    term: {
      en: "Verification Badge",
      hinglish: "Verification Badge (Satypan Badge)",
    },
    definition: {
      en: "A trust badge displayed on creator profiles confirming completed government KYC, connected social API authenticity, and high reliability history.",
      hinglish: "Profile par dikhne wala trust tick jo confirm karta hai ki creator ka KYC ho chuka hai, social media accounts authentic hain aur track record clean hai.",
    },
    example: {
      en: "Verified creators receive 4x more direct campaign invitations from top regional brands.",
      hinglish: "Verified creators ko brands se 4 guna zyada direct campaign offers milte hain.",
    },
    relatedTerms: ["kyc", "drs"],
  },
  {
    id: "revisions",
    category: "DEALS",
    term: {
      en: "Revisions",
      hinglish: "Revisions (Badlav ya Sudhar)",
    },
    definition: {
      en: "Requested changes to submitted drafts to align with the agreed brief. Contracts typically include 1 free revision; additional revisions require fee compensation.",
      hinglish: "Submitted draft me brand dwara maange gaye sudhar. Deal me standard 1 free revision included hota hai, extra revisions ke liye alag se payment lagti hai.",
    },
    example: {
      en: "Extra revisions beyond the contractual limit are billed at the agreed standard rate of ₹500 per round.",
      hinglish: "Contract ki limit ke baad extra revision maangne par brand ko additional ₹500 per round pay karna hota hai.",
    },
    relatedTerms: ["deliverable", "review-window"],
  },
  {
    id: "review-window",
    category: "DEALS",
    term: {
      en: "Review Window",
      hinglish: "Review Window (Jaanch Ka Samay)",
    },
    definition: {
      en: "The statutory 72-hour timeframe during which a brand must review a submitted deliverable; failure to respond triggers automated approval and milestone release.",
      hinglish: "72 ghante ka samay jiske andar brand ko submit kiya gaya content review karna hota hai; agar brand response nahi deta to system auto-approve kar deta hai.",
    },
    example: {
      en: "Auto-approval protects creators from indefinite payment delays when brands fail to review submitted work.",
      hinglish: "Auto-approval se creator ka paisa atakta nahi hai agar brand samay par reply na kare.",
    },
    relatedTerms: ["milestone", "escrow", "revisions"],
  },
];

// Validate all glossary items at startup
for (const item of GLOSSARY_TERMS) {
  GlossaryTermSchema.parse(item);
}

const GLOSSARY_MAP = new Map<string, GlossaryTerm>(
  GLOSSARY_TERMS.map((term) => [term.id, term])
);

/**
 * Retrieve all registered glossary terms.
 */
export function getAllGlossaryTerms(): GlossaryTerm[] {
  return GLOSSARY_TERMS;
}

/**
 * Find a specific glossary term by its ID.
 */
export function getGlossaryTerm(id: string): GlossaryTerm | undefined {
  return GLOSSARY_MAP.get(id);
}

/**
 * Filter glossary terms by category.
 */
export function getGlossaryTermsByCategory(category: GlossaryTermCategory): GlossaryTerm[] {
  return GLOSSARY_TERMS.filter((term) => term.category === category);
}

/**
 * Search glossary terms across English and Hinglish names, definitions, and examples.
 */
export function searchGlossary(query: string, lang?: "en" | "hinglish"): GlossaryTerm[] {
  const q = query.trim().toLowerCase();
  if (!q) return GLOSSARY_TERMS;

  return GLOSSARY_TERMS.filter((term) => {
    if (lang === "en") {
      return (
        term.term.en.toLowerCase().includes(q) ||
        term.definition.en.toLowerCase().includes(q) ||
        (term.example?.en.toLowerCase().includes(q) ?? false)
      );
    }
    if (lang === "hinglish") {
      return (
        term.term.hinglish.toLowerCase().includes(q) ||
        term.definition.hinglish.toLowerCase().includes(q) ||
        (term.example?.hinglish.toLowerCase().includes(q) ?? false)
      );
    }
    return (
      term.term.en.toLowerCase().includes(q) ||
      term.term.hinglish.toLowerCase().includes(q) ||
      term.definition.en.toLowerCase().includes(q) ||
      term.definition.hinglish.toLowerCase().includes(q) ||
      (term.example?.en.toLowerCase().includes(q) ?? false) ||
      (term.example?.hinglish.toLowerCase().includes(q) ?? false)
    );
  });
}
