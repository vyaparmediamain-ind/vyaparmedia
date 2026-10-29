# VyaparMedia — Codebase Placeholder Audit & Action Plan
> **Generated on:** October 2026 | **Scope:** Complete Codebase (`c:\Decisional-main\vyaparmedia`)

---

## 1. Executive Summary & Overview (सारांश)

Codebase me scanning ke dauran total **6 mukhya categories** me placeholders paye gaye hain:

| Category # | Placeholder Category | Location / Files | Total Count / Scope | Risk Level |
|---|---|---|---|---|
| **Cat 1** | **Environment Variables & Security Secrets** | `src/env.ts`, `.env.example`, `.env` | ~16 variables | 🔴 **Critical (P0)** (Prod Crash / Security) |
| **Cat 2** | **Platform Legal & Corporate Details** | `src/lib/platform-config.ts` | 7 core fields | 🟠 **High (P1)** (Tax & Legal compliance) |
| **Cat 3** | **Backend Mock Services & Stubs** | `src/lib/shiprocket.ts`, `src/lib/kyc/providers/mock.ts`, `src/lib/contact-filter.ts`, `src/lib/qstash-guard.ts` | 5 services | 🟡 **Medium (P1)** (Dev vs Live Switch) |
| **Cat 4** | **Database Seed Data & Test Accounts** | `scripts/seed-test-accounts.ts`, `scripts/seed-treasury.ts` | 3 test accounts + seeds | 🟡 **Medium (P2)** (Staging/Dev only) |
| **Cat 5** | **Frontend UI Mockups & Fallback Cards** | `src/components/landing/HeroProductMockup.tsx`, `CreatorShowcase.tsx` | 2 major UI mocks | 🟢 **Low (Safe UX Fallback)** |
| **Cat 6** | **HTML/JSX Form Input Placeholders** | 132 occurrences across 38 JSX files | 132 inputs | 🟢 **Standard UX (Guidance)** |

---

## 2. Category 1: Environment Variables & Security Secrets Placeholders

### 📍 Where are they?
- `src/env.ts` (Zod validation schema & runtime guards)
- `.env.example`
- `.env.production` / `.env`

### 🔍 Exact Placeholder List:
1. `RAZORPAY_KEY_ID`: `"rzp_test_placeholder"` / `"rzp_test_YOUR_KEY_ID"`
2. `RAZORPAY_KEY_SECRET`: `"placeholder_secret"` / `"YOUR_RAZORPAY_KEY_SECRET"`
3. `RAZORPAY_WEBHOOK_SECRET`: `"placeholder_webhook_secret"` / `"YOUR_RAZORPAY_WEBHOOK_SECRET"`
4. `AUTH_SECRET` & `NEXTAUTH_SECRET`: `"generate-with: openssl rand -hex 32"`
5. `HMAC_KEY`: `"generate-with: openssl rand -hex 32"`
6. `OTP_HASH_SECRET`: `"generate-with: openssl rand -hex 32"`
7. `CRON_SECRET`: `"generate-with: openssl rand -hex 32"`
8. `CONTRACT_SIGNING_SECRET`: `"generate-with: openssl rand -hex 32"`
9. `ENCRYPTION_KEY`: `"generate-with: openssl rand -hex 32"`
10. `DATABASE_URL` / `DIRECT_URL`: `postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`
11. `REDIS_URL`: `rediss://default:YOUR_UPSTASH_PASSWORD@YOUR_UPSTASH_HOST.upstash.io:6379`
12. `QSTASH_TOKEN` & Signing Keys: `YOUR_QSTASH_TOKEN`
13. `RESEND_API_KEY`: `re_YOUR_RESEND_API_KEY`
14. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com`
15. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` & `VAPID_PRIVATE_KEY`: `placeholder`

---

### ❓ Kiu hai? (Why is it here?)
1. **Repository Security**: Real API keys, database passwords aur cryptographic secrets ko Git repository me commit nahi kiya ja sakta (warna leak ho jayenge).
2. **Setup Template**: Naye developers ya CI/CD pipeline ko pata chal sake ki kaun-kaun se environment variables required hain aur unka format kya hona chahiye.
3. **Local Dev Bootstrapping**: Local environment me bina real Razorpay ya Supabase ke app build ho sake (isliye default test placeholders `src/env.ts` me dale gaye hain).

---

### 🛠️ Change kaise kare? (How to change?)

1. **Cryptographic Secrets Generate Karein:**
   Terminal (PowerShell ya Bash) me ye commands run karein:
   ```bash
   # Har secret ke liye alag 64-char hex key generate karein:
   openssl rand -hex 32
   ```
   Inhe apne `.env` ya Vercel Environment Variables me set karein:
   - `AUTH_SECRET=<generated_key>`
   - `NEXTAUTH_SECRET=<generated_key>`
   - `HMAC_KEY=<generated_key>`
   - `OTP_HASH_SECRET=<generated_key>`
   - `CRON_SECRET=<generated_key>`
   - `CONTRACT_SIGNING_SECRET=<generated_key>`
   - `ENCRYPTION_KEY=<generated_key>`

2. **Third-Party Live Keys Add Karein:**
   - **Razorpay**: Razorpay Dashboard -> Settings -> API Keys se Live Key ID (`rzp_live_...`) aur Secret copy karein.
   - **Supabase**: Supabase Dashboard -> Project Settings -> Database se connection string (port 6543 transaction pooler) lein.
   - **Upstash**: Upstash Console se Redis REST URL/Token aur QStash token copy karein.
   - **Resend**: resend.com/api-keys se actual domain verified key dalein.

3. **Vercel / Production Deployment me Set Karein:**
   ```bash
   vercel env add RAZORPAY_KEY_ID production
   vercel env add RAZORPAY_KEY_SECRET production
   ```

---

### ⚠️ Agar hta denge toh kya hoga? (What happens if removed?)
- `src/env.ts` me strict validation lga hua hai:
  - Agar `NODE_ENV === "production"` me placeholder reh gaya ya empty chhod diya, toh **Build ya Server Startup turant crash ho jayega** (`throw new Error("[SECURITY CRITICAL] ...")`).
  - Agar payment ke placeholder (`rzp_test_placeholder`) se live transaction kiya gaya, toh checkout button click hone par Razorpay runtime error dega (`Invalid Key ID`).
  - Agar `AUTH_SECRET` hata diya toh NextAuth JWT encryption fail ho jayegi aur koi bhi user login nahi kar payega.

---

### 💡 Aapke hisab se kya karna chahiye? (Antigravity Recommendation)
1. **Local Dev me**: Existing fallback placeholders ko rehne dein taaki local testing bina external accounts ke chalti rahe.
2. **Production (Vercel/Cloud)**: Production environment variables me sabhi `YOUR_*` aur `placeholder_*` ko actual live credentials aur `openssl rand -hex 32` se replace karein.
3. **Code me Badlaav**: `src/env.ts` ki validation checks ko bilkul mat hatayein—wo ek security safety net hain jo accidental leaked dummy deployment ko rokte hain.

---

## 3. Category 2: Platform Corporate & Legal Details Placeholders

### 📍 Where are they?
- `src/lib/platform-config.ts`

### 🔍 Exact Placeholder List:
```typescript
export const PLATFORM_CONFIG = {
  name: "VyaparMedia",
  legalName: "VYAPARMEDIA TECHNOLOGIES PRIVATE LIMITED",
  address: "Bellandur, Outer Ring Road, Bengaluru 560103", // Placeholder Address
  gstin: "29AABCV1234F1Z5",                              // Dummy GSTIN
  cin: "U74999KA2024PTC123456",                          // Dummy CIN
  pan: "AABCV1234F",                                     // Dummy PAN
  phone: "+91-8045678900",                               // Dummy Phone
  website: "https://vyaparmedia-nine.vercel.app",
  legalEmail: "legal@vyaparmedia.in",
  grievanceOfficer: "Mr. Dhruv Agarwal, Grievance Officer",
};
```

---

### ❓ Kiu hai?
- VyaparMedia platform par automatic invoices, platform fee GST calculation, TDS Form 16A, aur CSV reports banti hain.
- Jab development chal raha tha, tab actual incorporated entity ke real registration numbers available nahi the, isliye valid pattern-matching dummy numbers dale gaye taaki format validation pass ho sake.

---

### 🛠️ Change kaise kare?
Inhe hardcode change karne ki zaroorat nahi hai! `platform-config.ts` environment variables se values padhta hai:
Apne `.env.production` ya hosting dashboard me ye values configure karein:
```env
PLATFORM_GSTIN="29XXXXXXXXXX1ZX"
PLATFORM_CIN="U72900XXXXXXXXX"
PLATFORM_PAN="XXXXXXXXXX"
PLATFORM_ADDRESS="Your Real Office Address, City, Pincode"
PLATFORM_PHONE="+91-XXXXXXXXXX"
PLATFORM_EMAIL="support@yourdomain.com"
PLATFORM_GRIEVANCE_OFFICER="Your Official Grievance Officer Name"
```

---

### ⚠️ Agar hta denge toh kya hoga?
- Agar in values ko blank chhod denge toh:
  - Brands ko milne wale platform fee GST invoices par company GSTIN khali aayega ya dummy aayega, jisse brand apna **Input Tax Credit (ITC)** claim nahi kar payega (Tax non-compliance under Indian GST law).
  - IT Act, 2000 aur IT Intermediary Rules, 2021 ke mutabiq Grievance Officer aur Indian address website par mention hona mandatory hai.
  - CSV reports header me fallback placeholder show hoga.

---

### 💡 Aapke hisab se kya karna chahiye?
- **Immediate Step**: Company registration ke actual documents aate hi in 5 environment variables (`PLATFORM_GSTIN`, `PLATFORM_CIN`, `PLATFORM_PAN`, `PLATFORM_ADDRESS`, `PLATFORM_PHONE`) ko `.env.production` me daal dein.
- `src/lib/platform-config.ts` me code change karne ki zaroorat nahi hai, kyunki wahan already env variable override mechanism maujood hai.

---

## 4. Category 3: Backend Mock Services & Stubs

### 📍 Where are they?
1. **Shiprocket Courier Simulation**: `src/lib/shiprocket.ts` (lines 515–548 & 609–647)
2. **KYC Mock Provider**: `src/lib/kyc/providers/mock.ts` (`MockKYCProvider`)
3. **Contact Filter Mock OCR**: `src/lib/contact-filter.ts` (lines 374–388)
4. **QStash Mock Signature**: `src/lib/qstash-guard.ts` (lines 48–84)
5. **Email Console Logger**: `src/lib/email.ts` (lines 305–312)

---

### ❓ Kiu hai?
1. **Cost & Rate Limiting**: Development aur CI test runs ke dauran har bar real Aadhaar/PAN API call karne par Surepass/DigiLocker paise charge karte hain (₹2–₹5 per verification). Mock provider development ko 100% free banata hai.
2. **No Physical Deliveries in Dev**: Local test me product seeding deal banate waqt Shiprocket par sach me Delhivery courier book na ho jaye aur shipping charges na cut jayein, isliye `mockAwb` aur simulated tracking date generate hoti hai.
3. **Automated Testing**: Vitest suite ko fast run karne ke liye real external HTTP networks par depend nahi rehna padta.

---

### 🛠️ Change kaise kare?
In mocks ko remove karne ke bajaye **Environment Variables dwara switch** kiya jata hai:

1. **For Shiprocket**:
   ```env
   SHIPROCKET_EMAIL="your_shiprocket_account@company.com"
   SHIPROCKET_PASSWORD="your_shiprocket_password"
   SHIPROCKET_PICKUP_PINCODE="110001"
   ```
   Jaise hi ye env variables milte hain, `isShiprocketConfigured()` automatically true ho jata hai aur mock code bypass ho jata hai.

2. **For KYC**:
   ```env
   KYC_PROVIDER="surepass" # ya "manual"
   KYC_API_KEY="your_live_surepass_token"
   ```
   `src/lib/kyc/index.ts` automatically `SurepassKYCProvider` ko activate karega aur `MockKYCProvider` disable ho jayega.

3. **For Email**:
   ```env
   RESEND_API_KEY="re_live_xxxxxxxxxxxx"
   FROM_EMAIL="notifications@yourdomain.com"
   ```
   Mock console logging band hokar actual email deliver hona shuru ho jayegi.

---

### ⚠️ Agar hta denge toh kya hoga?
- Agar mock code ko delete kar diya:
  - Local dev environment me bina Shiprocket/Surepass account ke koi bhi developer deal create nahi kar payega, KYC test nahi kar payega, aur product dispatch flow crash ho jayega.
  - Automated tests fail hone lagenge.
- Lekin agar ye mock production me galti se reh gaya:
  - Production me code me guard already laga hua hai: `if (process.env.NODE_ENV === "production") throw AppError.internal(...)` — isliye koi fake identity verify nahi ho sakti.

---

### 💡 Aapke hisab se kya karna chahiye?
- **Mock implementations ko codebase me rakhein**: Inhe code se delete **mat** karein. Ye industry-standard architectural pattern (Adapter / Strategy pattern) hai.
- **Production Guard Check**: Ensure karein ki `NODE_ENV === "production"` me ye block hi rahein (jo ki current code me already implemented hai).
- Production launch ke waqt sirf `.env.production` me credentials daal dein.

---

## 5. Category 4: Database Seed Data & Mock Test Accounts

### 📍 Where are they?
- `scripts/seed-test-accounts.ts`
- `scripts/clear-and-seed.ts`
- `scripts/seed-treasury.ts`

### 🔍 Exact Test Accounts & Seeds:
1. **Brand**: `brand@test.com` (Aura Lifestyle Brands Ltd)
2. **Influencer**: `influencer@test.com` (Rohan Sharma)
3. **Admin**: `admin@test.com` (VyaparMedia Admin)
4. **Phone Numbers**: `9876543210`, `9876543211`, `9876543212`
5. **Dummy Bank IFSC**: `HDFC0001234`

---

### ❓ Kiu hai?
- Fresh database setup hone ke baad application ko test karne ke liye data chahiye hota hai: ek brand chahiye jo campaign post kare, ek creator chahiye jo deal accept kare, aur ek admin chahiye jo verify kare.
- Bina seed data ke empty database me login karna ya demo dekhna impossible hota hai.

---

### 🛠️ Change kaise kare?
- In scripts me accounts ka email, name, aur balance change karne ke liye seed files ko update karein:
  - `scripts/seed-test-accounts.ts`:
    ```typescript
    email: "your_official_test_brand@domain.com",
    name: "Your Test Brand",
    ```
- Run command:
  ```bash
  npm run seed:accounts # ya npx tsx scripts/seed-test-accounts.ts
  ```

---

### ⚠️ Agar hta denge toh kya hoga?
- Agar seed scripts delete kar denge toh application runtime par koi impact nahi hoga, lekin naye staging environment ya local test setup me scratch se 10-15 minute lagakar manually 3 accounts register karke verify karne padenge.
- **Caution**: Ye script kabhi bhi production database URL par run **nahi** honi chahiye.

---

### 💡 Aapke hisab se kya karna chahiye?
- Scripts ko `scripts/` folder me hi rakhein.
- Production migration me ensure karein ki `npm run seed:accounts` execute na ho (production me sirf real users register honge).

---

## 6. Category 5: Frontend UI Mockups & Fallback Demo Cards

### 📍 Where are they?
1. `src/components/landing/HeroProductMockup.tsx` (Homepage par interactive Creator/Brand escrow dashboard demo)
2. `src/components/landing/CreatorShowcase.tsx` (`DEFAULT_CREATORS` array - 4 creator cards)
3. `src/components/dashboard/messages/useMessages.ts` (`addConversationStub` function)
4. `src/components/admin/AdminFrame.tsx` (`getInitials` avatar fallback)

---

### 🔍 Exact Details:
- **HeroProductMockup.tsx**:
  - Creator View: ₹42,850 available to withdraw, 99% DRS score, Aura Lifestyle campaign step tracking.
  - Brand View: ₹1,85,000 in escrow, 3 campaigns active.
- **CreatorShowcase.tsx**:
  - `Aarav Tech Creator` (`aarav_tech`)
  - `Ananya Mehta` (`stylewithananya`)
  - `Vikram Malhotra` (`fitwithvikram`)
  - `Pooja Sharma` (`poojafoodvlogs`)

---

### ❓ Kiu hai?
1. **Homepage Conversion & Visual Demonstration**: Naye visitors ko website par aate hi platform ka core product (Escrow payment, DRS score, milestone tracking) live interactive demo ke roop me dikhana zaroori hai. Real backend database se live active deal private customer data hoti hai jise landing page par public nahi dikhaya ja sakta.
2. **Cold Start Problem**: Jab platform naya launch hota hai aur database me 0 creators hote hain, tab landing page empty/blank nahi dikhna chahiye. `DEFAULT_CREATORS` ek visual fallback provide karta hai.
3. **Optimistic UI in Chat**: Jab koi brand kisi naye creator ko "Message" click karta hai, tab bina pehla message bheje conversation list me ek temporary stub card dikhana padta hai taaki screen blank na lage.

---

### 🛠️ Change kaise kare?
1. **HeroProductMockup ko Customize karna**:
   - `src/components/landing/HeroProductMockup.tsx` me jakar amounts (`₹42,850`), brand name (`Aura Lifestyle`), ya milestone text ko edit karein.
2. **CreatorShowcase ko Real Data se connect karna**:
   - `src/app/page.tsx` me database se top-rated creators fetch karke `CreatorShowcase` ko `creators={dbCreators}` prop pass karein. Agar database me creators honge toh `DEFAULT_CREATORS` automatic ignore ho jayega.

---

### ⚠️ Agar hta denge toh kya hoga?
- Agar `HeroProductMockup` hata diya toh landing page par product ka visual appeal khatam ho jayega aur landing page conversion rate 40–50% drop ho sakta hai.
- Agar `DEFAULT_CREATORS` hata diya aur database me creators kam hue, toh homepage par empty grey container dikhai dega.
- Agar `addConversationStub` hata diya toh chat panel me initial message send karne se pehle UI glitch/blank state aayegi.

---

### 💡 Aapke hisab se kya karna chahiye?
- **HeroProductMockup**: Isko bilkul mat hatayein! Ye SaaS landing page best practice hai (mock product interface showcase).
- **CreatorShowcase**: Future me jaise hi 10+ real verified creators on-board ho jayein, landing page par real creator profiles show karne ka server query enable kar dein. Tab tak fallback rakhein.

---

## 7. Category 6: HTML/JSX Form Input Field Placeholders (`placeholder="..."`)

### 📍 Where are they?
Codebase me total **132 inputs** me `placeholder="..."` attribute use hua hai.

### 🔍 Top Functional Groups:

#### A. Auth & Onboarding (`src/app/login/page.tsx`, `src/app/onboarding/page.tsx`, `src/components/auth/OtpFields.tsx`):
- `placeholder="you@example.com"`
- `placeholder="9876543210"`
- `placeholder="Enter 6-digit OTP"` / `placeholder="e.g. 123456"`
- `placeholder="At least 8 characters"`
- `placeholder="e.g. Rohan Varma"`
- `placeholder="e.g. Aura Lifestyle India Pvt Ltd"`
- `placeholder="e.g. Bengaluru"`, `placeholder="e.g. Karnataka"`
- `placeholder="your_handle"`, `placeholder="channel_handle"`

#### B. Banking & Wallet (`src/components/dashboard/wallet/BankAccountManager.tsx`):
- `placeholder="e.g. Rahul Sharma"`
- `placeholder="e.g. HDFC Bank, State Bank of India"`
- `placeholder="Enter full bank account number"`
- `placeholder="e.g. HDFC0001234"`
- `placeholder="e.g. yourname@oksbi, phone@paytm"`

#### C. Tax & Compliance (`src/components/dashboard/settings/IndiaTaxCompliancePanel.tsx`):
- `placeholder={compliance?.panNumberMasked || "e.g. ABCDE1234F"}`
- `placeholder={compliance?.gstinMasked || "e.g. 29ABCDE1234F1Z5"}`
- `placeholder="e.g. 2025-26"` (Assessment Year)
- `placeholder="e.g. 400001"` (Pincode)

#### D. Campaigns & Deals (`CreateCampaignClient.tsx`, `RatesTab.tsx`, `ProductSeedingCard.tsx`):
- `placeholder="e.g. Summer Skincare Launch 2026"`
- `placeholder="e.g. 50000"` (Budget)
- `placeholder="https://example.com"`
- `placeholder="10000"`, `placeholder="50000"` (Rate cards)

#### E. Search & Filters (`CampaignRoiReport.tsx`, `DealsFilterToolbar.tsx`, `CategoryBenchmarksClient.tsx`):
- `placeholder="Search creator..."`
- `placeholder="Search by ID or description..."`
- `placeholder="Search categories..."`
- `placeholder="Type a message..."`

---

### ❓ Kiu hai?
- Input field placeholders **User Experience (UX)** ka core part hote hain.
- Ye user ko bataate hain ki input me kis tarah ka format expect kiya ja raha hai (e.g. Bank IFSC code ka format `HDFC0001234` hota hai, phone number 10 digits ka hota hai).
- Search bar me user ko prompt karte hain ki kya search kiya ja sakta hai.

---

### 🛠️ Change kaise kare?
- Agar aap in text labels ko change ya bilingual/Hinglish karna chahte hain, toh directly TSX file me `placeholder` prop ko update karein:
  - Example: `placeholder="Search creator..."` ko `placeholder="Creator ka naam khojein..."`
  - Example: `placeholder="e.g. HDFC0001234"` ko `placeholder="IFSC Code (e.g. SBIN0001234)"`

---

### ⚠️ Agar hta denge toh kya hoga?
- Agar `<input placeholder="..." />` attributes ko hata denge:
  - Application **code crash nahi hogi**, lekin user interface bohot confusing ho jayega.
  - Users ko pata nahi chalega ki search bar me kya type karna hai, bank account format kya hona chahiye, ya OTP kitne digits ka hai.
  - Conversion rate aur form completion drop ho jayegi.

---

### 💡 Aapke hisab se kya karna chahiye?
- **Inhe bilkul mat hatayein!** HTML input placeholders normal and standard web development practice hain.
- **Sirf yeh check karein**:
  1. Kya har input ke upar ek visible `<label>` maujood hai? (WCAG Accessibility rule: Placeholder ko kabhi label ka substitute nahi banana chahiye).
  2. VyaparMedia ke current codebase me labels already correctly placed hain.

---

## 8. Summary Action Checklist (Aapke Liye Final Recommendation)

| Priority | Action Item | File / Target | Kya Karna Chahiye? |
|---|---|---|---|
| 🔴 **P0 (Immediate for Live Prod)** | Generate Real Cryptographic Secrets | `.env.production` | `openssl rand -hex 32` run karke `AUTH_SECRET`, `HMAC_KEY`, etc. set karein. |
| 🔴 **P0 (Immediate for Live Prod)** | Set Live Razorpay Keys | `.env.production` | `rzp_test_placeholder` ki jagah actual live Razorpay key/secret daalein. |
| 🟠 **P1 (Pre-Launch Legal)** | Configure Official Platform Info | `src/lib/platform-config.ts` | Company GSTIN, CIN, Real Address, Grievance phone env me daalein. |
| 🟡 **P2 (Dev / Testing)** | Keep Backend Mocks As-Is | `src/lib/shiprocket.ts`, `src/lib/kyc/` | Inhe code se **delete na karein**. Ye dev testing ke liye vital hain. |
| 🟢 **P3 (UI Polish)** | Keep Hero Mockups & Input Placeholders | `HeroProductMockup.tsx`, JSX inputs | Inhe active rakhein; ye conversion aur UX ke liye zaroori hain. |

---

*Report prepared specifically for VyaparMedia architecture review.*
