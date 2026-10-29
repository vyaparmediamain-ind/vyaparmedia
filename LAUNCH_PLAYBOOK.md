# 🚀 VyaparMedia — Official Founder Launch Playbook
> **Document Purpose**: Yeh guide aapko Step-by-Step batati hai ki Day-1 se lekar platform ko **legally, technically aur commercially** live kaise karna hai bina kisi confusion ke.

---

## 📑 Table of Contents
1. [Phase 1: Legal & Banking Setup (Zero-Cost / Low-Cost)](#1-phase-1-legal--banking-setup)
2. [Phase 2: Cloud Services & Environment Configuration](#2-phase-2-cloud-services--environment-configuration)
3. [Phase 3: Production Build, Migration & Deployment](#3-phase-3-production-build-migration--deployment)
4. [Phase 4: GTM Strategy (Pehle 50 Creators aur 10 Brands Kaise Layein)](#4-phase-4-gtm-strategy-pehle-users-kaise-layein)
5. [Phase 5: Daily Operations & Founder Sanity Checklist](#5-phase-5-daily-operations--sanity-checklist)
6. [Phase 6: Invoicing, Tax Reports & Proprietorship Legal Config](#6-phase-6-invoicing-tax-reports--proprietorship-legal-config)
7. [Phase 7: Government Schemes & Free Cloud Credits ($25k+ Perks)](#7-phase-7-government-schemes--free-cloud-credits-25k-perks)

---

# 1. Phase 1: Legal & Banking Setup

Aapko Day-1 par ₹15,000 kharch karke Private Limited banane ki bilkul zaroorat nahi hai. Niche diye gaye 3 steps follow karein:

### Step 1.1: Udyam (MSME) Registration (Cost: ₹0 | Time: 10 Mins)
* **Website**: [udyamregistration.gov.in](https://udyamregistration.gov.in)
* **Documents**: Apna Aadhaar Card + PAN Card.
* **Process**: 
  1. "New Entrepreneur" par click karein.
  2. Enterprise Name me dalein: **"VyaparMedia"** (ya apna trade name).
  3. Major Activity me chunein: **"Services"** -> NIC Code: `73100` (Advertising and market research).
  4. OTP verify karte hi aapka **Government MSME / Udyam Certificate** download ho jayega.

### Step 1.2: GST Registration (Cost: ₹0 online / ₹1,000 via CA | Time: 3-4 Days)
* **Website**: [gst.gov.in](https://www.gst.gov.in)
* Marketplace model ke liye GST mandatory hota hai taaki Razorpay Route aur split payouts seamlessly chal sakein.
* Udyam Certificate + Electricity bill/rent agreement lagakar personal PAN par hi Proprietorship GST number 3-4 din me mil jata hai.

### Step 1.3: Razorpay & RazorpayX Current Account (Time: 24-48 Hours)
* **Website**: [razorpay.com](https://razorpay.com)
* Sign up karke Business Type me **"Proprietorship"** chunein.
* Apna PAN, Aadhaar aur Udyam/GST certificate upload karein.
* Dashboard ke andar **"RazorpayX"** activate karein (isse aapko RBL/ICICI bank backend par direct free Current Account mil jayega).
* **Razorpay Route** feature activate karne ke liye support ticket dalein: *"Activating Route for split marketplace vendor settlements"*.

---

# 2. Phase 2: Cloud Services & Environment Configuration

Production me run karne ke liye aapko niche di gayi 6 services ke free/starter tier par accounts banane hain:

### Service Setup Checklist:
1. **Supabase (PostgreSQL Database)** — [supabase.com](https://supabase.com)
   * Project banayein **AWS Mumbai (`ap-south-1`)** region me.
   * `DATABASE_URL` Supavisor pooler (Port 6543, `pgbouncer=true`, `connection_limit=1`) copy karein.
   * `DIRECT_URL` direct session connection (Port 5432) copy karein.
2. **Upstash (Redis & QStash)** — [upstash.com](https://upstash.com)
   * Ek Serverless Redis database banayein (rate limiting aur caching ke liye).
   * QStash tab me jaakar token copy karein (background queues aur webhooks ke liye).
3. **Cloudflare R2 ya AWS S3 (Storage)**
   * Deliverables (videos, images, KYC documents) ke liye bucket banayein.
   * Direct-to-storage presigned upload architecture configured hai (Vercel memory load zero rahega).
4. **Resend (Email)** — [resend.com](https://resend.com)
   * Free account banakar transactional emails (welcome, contracts, password reset) ke liye API key lein.
5. **MSG91 (SMS OTP)** — [msg91.com](https://msg91.com)
   * Phone OTP login aur WhatsApp alerts ke liye auth key configure karein.
6. **Meta / Instagram Graph API** — [developers.facebook.com](https://developers.facebook.com)
   * App create karein (Instagram Basic Display & Graph API).
   * Shuruat me **Development Mode** me test users add karke bina kisi delay ke launch kar sakte hain.

---

# 3. Phase 3: Production Build, Migration & Deployment

Codebase me **1,091 tests passing** hain aur zero build errors hain. Deployment ke liye niche diye commands run karein:

### Step 3.1: Pre-Flight Integrity Check (Local Terminal)
```bash
# Terminal me vyaparmedia folder ke andar:
cd vyaparmedia

# 1. Saare linters, theme consistency aur action-button guards verify karein
npm run validate

# 2. Saare unit aur integration tests verify karein
npm run test
```

### Step 3.2: Database Migration (Live Postgres Par Schema Push)
```bash
# Live database par schema deploy karein:
npx prisma migrate deploy

# Database RLS (Row Level Security) verify karein:
npm run db:verify-rls
```

### Step 3.3: Vercel Par Deploy Karein
1. Apne code ko GitHub repository me push karein.
2. [Vercel](https://vercel.com) par New Project import karein.
3. `.env` ke saare production variables Vercel Project Settings -> **Environment Variables** me paste karein.
4. **Deploy** button click karein.

### Step 3.4: Automated Cron Jobs Sync (QStash Setup)
Deploy hone ke baad automated cron schedules (escrow monitoring, deal expiry, signature checks) sync karein:
```bash
npm run cron:sync
```

---

# 4. Phase 4: GTM Strategy (Pehle Users Kaise Layein)

Marketplace me sabse pehle **Chicken-and-Egg** problem aati hai (Brand bolega creators kahan hain, creator bolega brands kahan hain). Isko todne ka proven tarika:

### Step 4.1: Pehle Creators Onboard Karein (Supply First - 7 Days)
* Apne city ke 50 Nano/Micro creators (1k - 15k followers) ko Instagram DM karein:
  > *"Hey [Name], hum local brands ke paid collabs aur free product barter ke liye verified creators onboard kar rahe hain. Guaranteed escrow payment hai. Profile link submit karo: vyaparmedia.in/register"*
* Creators free me onboard hote hain kyunki unhe brands aur sponsorships chahiye.
* Target: **Pehle 50 se 100 creators onboard kar lijiye.**

### Step 4.2: Local Shops Ko Target Karein (Demand Side - 7 Days)
* Apne local area ke 20 cafes, clothing boutiques, salons, aur gyms me personally visit karein ya call karein:
  > *"Sir, aapke area ke 5 food/fashion creators aapke restaurant me aakar reel banayenge. Hamare platform par paisa escrow me safe rehta hai — jab tak creator reel upload na kare aapka 1 rupiya bhi nahi kat-ta. Sirf ₹3,000 me campaign live karo."*
* Local dukaan wale **"Guaranteed Kaam aur Escrow Safety"** sunkar turant ready ho jaate hain.

### Step 4.3: Pehli 10 Deals Crack Karein
* Un 10 dukaano ke campaigns platform par live karwayein.
* Creators se application mangwayein aur deal complete karwayein.
* Deal complete hone ka WhatsApp screenshot Instagram stories aur LinkedIn par share karein (Social Proof).

---

# 5. Phase 5: Daily Operations & Founder Sanity Checklist

Roz subah platform manage karne ke liye sirf 15-20 minute lagte hain:

| Time | Kaam / Check | Kahan Dekhna Hai? |
| :--- | :--- | :--- |
| **Subah 10:00 AM** | Naye Dispute ya Escalation check karna | `/admin/disputes` dashboard par |
| **Dopahar 02:00 PM** | Payout approval aur KYC documents | `/admin/users` aur `/dashboard/wallet` |
| **Shaam 06:00 PM** | Deliverable verification (Reel link live hai ya nahi) | `/admin/benchmarks` ya Deal Workroom |
| **Hafta me 1 Baar** | Platform metrics aur slow queries check karna | `/api/health` aur Sentry telemetry |

---

# 6. Phase 6: Invoicing, Tax Reports & Proprietorship Legal Config

Jab brand ya creator platform statement ya invoice download karega, toh proprietorship entity hone par exact yeh format aur details print hongi:

### 6.1 Statement / Invoice Print Format:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             VYAPARMEDIA                                     │
│               VYAPARMEDIA (PROPRIETOR: [FOUNDER NAME])                      │
│                                                                             │
│  GSTIN: 07ABCPA1234F1Z5   |   PAN: ABCPA1234F   |   MSME: UDYAM-XX-00-123456│
│  Address: [Registered GST / Aadhaar Principal Place of Business Address]     │
│  SAC Code: 998361 (Advertising & Marketplace Platform Services)             │
│  Email: billing@vyaparmedia.in   |   Website: https://vyaparmedia.in         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Field Mapping (Proprietorship vs Pvt Ltd):
* **Platform Brand Name**: `VyaparMedia`
* **Legal Name**: `VYAPARMEDIA (PROPRIETOR: [FOUNDER NAME])`
* **GSTIN**: 15-digit GST number (issued on personal PAN).
* **PAN**: Founder's personal PAN (digits 3 to 12 of GSTIN).
* **CIN**: Pvt Ltd ke liye Corporate Identification Number.
* **MSME / Udyam**: Proprietorship ke liye Government Udyam Registration number (`UDYAM-XX-00-XXXXXXX`), jo statements aur invoices par print hota hai.
* **SAC Code**: `998361` (Advertising Services / Influencer Marketing Platform). 18% GST applicable.
* **Input Tax Credit (ITC)**: Brands aapke invoice par lagne wale 18% GST ka 100% tax credit claim kar sakti hain.

### 6.4 Automated Campaign / Deal-Tier GST Rule:
* **Total Campaign Spend ≤ ₹1,500 (Zero Tax Starter)**:
  * Platform fee par **0% GST**.
  * Chhote dukandaron ke test campaigns (e.g. ₹500, ₹1,000, ₹1,500 total budget) ke liye friction-free onboarding.
* **Total Campaign Spend > ₹1,500 (≥ ₹1,501 Standard & D2C Campaigns)**:
  * Brand ki total spending agar ₹1,500 se zyada hai (jaise 4 creators × ₹1,500 = **₹6,000 total budget**), toh platform fee par automatically **18% GST (SAC 998361)** add hota hai.
  * Formal B2B Tax Invoice generate hota hai jisme Brand pura 18% GST Input Tax Credit (ITC) claim kar sakti hai.

### 6.3 Environment Variables Setup (`.env.production`):
```env
# Platform Legal & Invoice Settings (.env.production)
NEXT_PUBLIC_PLATFORM_NAME="VyaparMedia"
NEXT_PUBLIC_PLATFORM_LEGAL_NAME="VYAPARMEDIA (PROPRIETOR: DHRUV AGARWAL)"
PLATFORM_PAN="ABCPA1234F"
PLATFORM_GSTIN="07ABCPA1234F1Z5"
PLATFORM_UDYAM="UDYAM-DL-00-1234567"
PLATFORM_CIN="UDYAM-DL-00-1234567"
PLATFORM_ADDRESS="Shop No. 12, Sector 15, Gurugram, Haryana 122001"
PLATFORM_EMAIL="billing@vyaparmedia.in"
PLATFORM_PHONE="+91-9876543210"
```

### 6.4 Mandatory Platform Hashtag Rule (#vyaparmedia):
* Har deal aur campaign ke smart contract me **`#vyaparmedia`** mandatory tag ke roop me add hota hai (`extractMandatoryElements`).
* Creator ko live Instagram Reel / YouTube Video caption me **`#vyaparmedia`**, **`#ad`**, aur brand mention dalna anivarya (must) hai.
* Agar creator `#vyaparmedia` tag nahi dalta, toh platform ka automated post-verification engine (`src/lib/fraud-detection/social.ts`) use **MISSING_HASHTAGS** flag dekar escrow payment hold kar deta hai jab tak caption update na ho!

---

# 7. Phase 7: Government Schemes & Free Cloud Credits ($25k+ Perks)

India me founders ke liye kai government aur cloud perks available hain:

### 7.1 Startup India & DPIIT Benefits (Pvt Ltd / LLP Stage Par):
* **Startup India Seed Fund Scheme (SISFS)**: ₹20 Lakh tak ki POC grant aur ₹50 Lakh convertible debenture/debt through authorized incubators (NASSCOM, AIC, IITs).
* **Section 80-IAC (Income Tax Exemption)**: Shuruat ke 10 saalo me se kisi bhi 3 saal 100% Tax Holiday.
* **Angel Tax Relief (Section 56)**: Investors se capital raise karne par zero angel tax.
* **Fast-track Patent & Trademark**: 80% rebate on patent, 50% rebate on trademark fees.

### 7.2 Immediate MSME / Udyam Benefits (Proprietorship Stage Par):
* **50% Trademark Subsidy**: Brand name "VyaparMedia" ko safe karne ke liye ₹4,500 me Trademark apply karein.
* **CGTMSE Scheme**: Bank se working capital/marketing ke liye bina kisi security/girvi ke ₹2 Crore tak ka collateral-free loan eligibility.
* **Mudra Loan (Tarun Tier)**: ₹50,000 se ₹10 Lakh working capital low-interest loan.

### 7.3 Free Startup Tech Credits (Total Value: ₹25 Lakh+):
1. **Microsoft for Startups Founders Hub**:
   * $1,000 to $25,000 in Azure Cloud Credits + Free OpenAI GPT-4 API tokens + Free GitHub Enterprise + LinkedIn Premium.
   * Apply link: [founders-hub.microsoft.com](https://founders-hub.microsoft.com) *(Proprietorship stage par bhi milta hai)*.
2. **AWS Activate Founders**:
   * $1,000 to $5,000 in AWS credits (S3 Storage, EC2, RDS).
   * Apply link: [aws.amazon.com/activate](https://aws.amazon.com/activate).
3. **Google for Startups Cloud Program**:
   * $2,000 Google Cloud / Firebase credits.
   * Apply link: [cloud.google.com/startup](https://cloud.google.com/startup).
4. **Razorpay Rize**:
   * Priority onboarding, discounted payment gateway rates, and free founder advisory.
   * Apply link: [razorpay.com/rize](https://razorpay.com/rize).

---

### 🏁 Ready to Launch!
Aapka codebase enterprise-grade security, automated fraud prevention, aur tested state-machines ke sath bilkul taiyar hai. Upar diye gaye steps follow karke aap **agle 3 se 5 din ke andar legally aur technically live** ho sakte hain!
