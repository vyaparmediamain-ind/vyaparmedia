# 🚀 VyaparMedia — Complete Production Deployment, Core Architecture & 3rd-Party Integrations Manual

Welcome to the definitive deployment and architectural specification for **VyaparMedia** — India's premier Influencer Commerce, Smart Escrow, and Verified Creator Marketplace.

This manual provides an exhaustive, production-grade guide covering **every system feature, core business function, API endpoint, third-party integration, Free vs. Paid pricing tiers, database triggers, compliance standards (GST/TDS/RBI/MCA), and zero-downtime deployment pipelines**.

---

## 📑 Table of Contents
1. [Core Features & Business Workflows In-Depth](#1-core-features--business-workflows-in-depth)
   - [1.1 Deal State Machine & Escrow Lifecycle](#11-deal-state-machine--escrow-lifecycle)
   - [1.2 Financial Ledger, Escrow Settlement & Immutability](#12-financial-ledger-escrow-settlement--immutability)
   - [1.3 Logistics & Physical Product Seeding (Shiprocket Integration)](#13-logistics--physical-product-seeding-shiprocket-integration)
   - [1.4 DRS™ (Dynamic Reliability Score) Engine](#14-drs-dynamic-reliability-score-engine)
   - [1.5 Anti-Fraud, Contact Leakage & OCR Prevention](#15-anti-fraud-contact-leakage--ocr-prevention)
   - [1.6 Dispute Resolution & 3-Tier Arbitration System](#16-dispute-resolution--3-tier-arbitration-system)
2. [Indian Corporate, GST & Legal Compliance Architecture](#2-indian-corporate-gst--legal-compliance-architecture)
   - [2.1 Corporate Entity, MCA & MSME Udyam Registration](#21-corporate-entity-mca--msme-udyam-registration)
   - [2.2 GST (Goods & Services Tax) Architecture & SAC Codes](#22-gst-goods--services-tax-architecture--sac-codes)
   - [2.3 Income Tax & TDS Compliance (Section 194J & 206AA)](#23-income-tax--tds-compliance-section-194j--206aa)
   - [2.4 RBI Nodal & Escrow Account Regulations (Payment Aggregator)](#24-rbi-nodal--escrow-account-regulations-payment-aggregator)
   - [2.5 Indian Contract Act 1872 & IT Act 2000 Electronic Agreements](#25-indian-contract-act-1872--it-act-2000-electronic-agreements)
   - [2.6 Financial Statements & Tax Invoice Generation](#26-financial-statements--tax-invoice-generation)
3. [Third-Party Services Directory (Free vs. Paid Tiers & Setup)](#3-third-party-services-directory)
   - [3.1 Database: Supabase PostgreSQL (AWS Mumbai)](#31-database-supabase-postgresql-aws-mumbai)
   - [3.2 Caching & Distributed Locks: Upstash Redis](#32-caching--distributed-locks-upstash-redis)
   - [3.3 Serverless Cron Scheduling: Upstash QStash](#33-serverless-cron-scheduling-upstash-qstash)
   - [3.4 Payments & Escrow: Razorpay & RazorpayX](#34-payments--escrow-razorpay--razorpayx)
   - [3.5 Logistics & Fulfillment: Shiprocket API](#35-logistics--fulfillment-shiprocket-api)
   - [3.6 Transactional Communications: Resend & WhatsApp Cloud API](#36-transactional-communications-resend--whatsapp-cloud-api)
   - [3.7 Cloud Object Storage: Cloudflare R2 (Zero Egress)](#37-cloud-object-storage-cloudflare-r2-zero-egress)
   - [3.8 Identity, KYC & Tax Compliance: Surepass & DigiLocker](#38-identity-kyc--tax-compliance-surepass--digilocker)
   - [3.9 Social Metrics: Instagram Graph API & YouTube Data API](#39-social-metrics-instagram-graph-api--youtube-data-api)
   - [3.10 Computer Vision & Contact Leakage: Google Cloud Vision](#310-computer-vision--contact-leakage-google-cloud-vision)
   - [3.11 Error Tracking & Telemetry: Sentry](#311-error-tracking--telemetry-sentry)
4. [Complete API Endpoints & Webhooks Directory](#4-complete-api-endpoints--webhooks-directory)
5. [Environment Variables Dictionary (.env.production)](#5-environment-variables-dictionary-envproduction)
6. [Database Initialization, Triggers & Hardening](#6-database-initialization-triggers--hardening)
7. [Deployment Options](#7-deployment-options)
   - [Option A: Vercel Serverless (Recommended)](#option-a-vercel-serverless-recommended)
   - [Option B: Self-Hosted Docker & VPS (Ubuntu / Nginx / PM2)](#option-b-self-hosted-docker--vps-ubuntu--nginx--pm2)
8. [Automated Cron Schedules Registration](#8-automated-cron-schedules-registration)
9. [Production Pre-Flight Checklist](#9-production-pre-flight-checklist)
10. [Cost Breakdown: $0 Bootstrapping vs. Scaled Production](#10-cost-breakdown-0-bootstrapping-vs-scaled-production)

---

## 1. Core Features & Business Workflows In-Depth

### 1.1 Deal State Machine & Escrow Lifecycle

VyaparMedia implements a deterministic, multi-party finite state machine enforcing strict escrow rules:

```
  ┌──────────────┐     Brand Deposits     ┌──────────────┐     Brand Confirms     ┌──────────────┐
  │    DRAFT     │ ─────────────────────> │PENDING_SIGN  │ ─────────────────────> │ PAYMENT_HELD │
  └──────────────┘                        └──────────────┘                        └──────┬───────┘
                                                                                         │
  ┌──────────────────────────────────────────────────────────────────────────────────────┘
  │
  │ System Locks Escrow
  ▼
┌──────────────┐   Creator Address   ┌──────────────┐   Shiprocket AWB   ┌──────────────┐
│    ACTIVE    │ ──────────────────> │ ADDR_SUBMIT  │ ─────────────────> │  DISPATCHED  │
└──────────────┘                     └──────────────┘                    └──────┬───────┘
                                                                                │
  ┌─────────────────────────────────────────────────────────────────────────────┘
  │
  │ Logistics Webhook (DELIVERED)
  ▼
┌──────────────┐   Creator Submits   ┌──────────────┐   Brand Approves   ┌──────────────┐
│   RECEIVED   │ ──────────────────> │CONTENT_SUBMIT│ ─────────────────> │  COMPLETED   │
└──────────────┘      Proof Links    └──────────────┘    (or 48h timer)  └──────────────┘
                                             │                                  ▲
                                             │ Dispute Raised                   │ Admin Resolves
                                             ▼                                  │
                                      ┌──────────────┐                          │
                                      │   DISPUTED   │ ─────────────────────────┘
                                      └──────────────┘
```

#### Transition Invariants:
1. **Pre-Funding Guarantee**: A deal cannot reach `ACTIVE` state without upfront escrow lock (`LOCK_ESCROW`).
2. **Review Window Guard**: When a deal reaches `CONTENT_SUBMITTED`, the brand has a strict 48-hour review timer. If no action is taken, the escrow is automatically released to the creator by the QStash background cron.
3. **Double-Entry Financial Lock**: Every state transition that affects funds (`LOCK_ESCROW`, `RELEASE_ESCROW`, `REFUND_ESCROW`) executes inside an atomic PostgreSQL `$transaction`.

---

### 1.2 Financial Ledger, Escrow Settlement & Immutability

#### 1. Zero Floating-Point Arithmetic
All monetary values in the database are stored as **integer Paise** (`1 Rupee = 100 Paise`). This completely eliminates IEEE 754 floating-point rounding errors.

#### 2. Append-Only Immutability Trigger
The PostgreSQL database enforces the `trg_protect_transaction_ledger_v2` trigger on the `Transaction` table. Any direct SQL `UPDATE` or `DELETE` statement against a committed financial transaction immediately raises an exception and aborts the query.

---

### 1.3 Logistics & Physical Product Seeding (Shiprocket Integration)

For barter or gifted product collaboration deals:
1. **Creator Address Collection**: Creator inputs recipient name, phone, address, and Indian PIN code.
2. **Pre-Flight Balance Check**: Before calling Shiprocket's API, the system verifies that the brand wallet is active and not frozen.
3. **Automated Order Creation**: The system generates a Shiprocket Custom Order via REST API:
   - Sets pickup warehouse PIN code (`SHIPROCKET_PICKUP_PINCODE`).
   - Generates Air Waybill (AWB) from top integrated carriers (Delhivery, BlueDart, DTDC).
   - Generates printable shipping label and packing slip.
4. **Live Webhook Checkpoint Tracking**: Shiprocket pushes checkpoint events (`PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`).
5. **Fail-Closed Security**: In production, missing credentials reject requests immediately to prevent spoofed delivery status updates.

---

### 1.4 DRS™ (Dynamic Reliability Score) Engine

Every creator and brand has an algorithmic trust score ranging from **300 to 900**:

$$\text{DRS} = 300 + (S_{\text{on-time}} \times 200) + (S_{\text{rating}} \times 200) + (S_{\text{volume}} \times 100) - (\text{Disputes} \times 50)$$

- **On-time Submission Rate ($S_{\text{on-time}}$)**: Deliverables posted before the deadline.
- **Rating Score ($S_{\text{rating}}$)**: Verified brand review average (1 to 5 stars).
- **Completed Volume ($S_{\text{volume}}$)**: Historical completed deal count.
- **KYC Verification Bonus**: +50 points for verified Indian PAN & Aadhaar.

Creators with $\text{DRS} \ge 750$ unlock the **Top Creator Badge** and featured placement on the public search directory.

---

### 1.5 Anti-Fraud, Contact Leakage & OCR Prevention

To protect the marketplace from disintermediation (users taking deals off-platform):
1. **Regex Scanning**: Every chat message and comment is scanned in real-time for:
   - 10-digit Indian phone numbers (`(\+91[\-\s]?)?[6-9]\d{9}`).
   - Email addresses (`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`).
   - UPI IDs (`[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}`).
2. **Google Cloud Vision OCR**: Deliverable images and attachments are scanned via OCR to detect phone numbers written on paper or payment QR codes.
3. **Automated Warning & Freezing**: Detected violations automatically issue a warning to the user; repeated attempts freeze the user's messaging privileges and flag the account for admin review.

---

### 1.6 Dispute Resolution & 3-Tier Arbitration System

When a brand or creator flags non-delivery or defective products:
- **Tier 1 (Amicable Auto-Negotiation)**: Parties have 48 hours to mutually agree on a revision or partial refund.
- **Tier 2 (Admin Mediation)**: VyaparMedia support staff inspects chat history, uploaded deliverables, and courier delivery proofs.
- **Tier 3 (Binding Arbitration)**: Admin executes an irreversible escrow split:
  - 100% Refund to Brand (in case of non-delivery or copyright violation).
  - 100% Release to Creator (in case brand refuses valid deliverables).
  - Partial Settlement (e.g. 50% / 50% split).

---

## 2. Indian Corporate, GST & Legal Compliance Architecture

VyaparMedia is engineered from day one to comply strictly with Indian tax, corporate, banking, and contract laws.

```
                      ┌─────────────────────────────────────────┐
                      │    VYAPARMEDIA TECHNOLOGIES PVT LTD     │
                      │  CIN: U74999DL2024PTC123456 | PAN | TAN  │
                      └────────────────────┬────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         │                                 │                                 │
┌────────▼──────────────┐       ┌──────────▼────────────┐       ┌────────────▼──────────────┐
│  GSTN Compliance      │       │  Income Tax & TDS     │       │  RBI Nodal Escrow Model   │
│  - GSTIN: 07AABCV...  │       │  - Section 194J (1%)  │       │  - Payment Aggregator     │
│  - SAC: 998371        │       │  - Sec 206AA (20% No  │       │  - Trustee Nodal Account  │
│  - 18% GST (CGST/SGST/│       │    PAN fallback)      │       │  - Penny Drop IFSC verify │
│    IGST) B2B Invoices │       │  - Form 26Q & 16A gen │       │  - Daily Ledger Balancing │
└───────────────────────┘       └───────────────────────┘       └───────────────────────────┘
```

### 2.1 Corporate Entity, MCA & MSME Udyam Registration

1. **Company Legal Name**: `VYAPARMEDIA TECHNOLOGIES PRIVATE LIMITED`
2. **Corporate Identification Number (CIN)**: 21-digit alphanumeric code registered under Ministry of Corporate Affairs (MCA), e.g., `U74999DL2024PTC123456`.
3. **Registered Office Address**: Set via environment variable `PLATFORM_ADDRESS` and printed on all legal exports, statements, and tax invoices.
4. **Permanent Account Number (PAN)**: 10-digit alphanumeric corporate tax identifier (`PLATFORM_PAN`).
5. **Tax Deduction and Collection Account Number (TAN)**: Used for remitting monthly TDS deducted from creator earnings to the Income Tax Department.
6. **MSME / Udyam Registration**: Registered under the Micro, Small & Medium Enterprises Development Act, 2006 to benefit from priority sector lending and dispute resolution protections.

---

### 2.2 GST (Goods & Services Tax) Architecture & SAC Codes

VyaparMedia acts as a digital intermediary providing software infrastructure and facilitation services between Brands and Creators.

#### 1. Platform GSTIN & State Code
- Configured via `PLATFORM_GSTIN`.
- Format: 15 characters (e.g. `07AABCV1234F1Z5`), where `07` is Delhi state code, followed by corporate PAN, entity number, `Z`, and checksum.

#### 2. Services Accounting Codes (SAC)
All invoices generated by the platform classify services under official Indian SAC codes:
- **SAC 998371**: Advertising and marketing services (Creator sponsored campaigns, digital promotions, influencer endorsement facilitation).
- **SAC 998314**: Information technology software design and escrow infrastructure development.
- **SAC 998599**: Other business support services and marketplace transaction fees.

#### 3. GST Rate Calculation Logic
GST applies at **18%** on VyaparMedia's Platform Commission (10% fee):

- **Intra-State Supply** (Brand and VyaparMedia in the same state, e.g., Delhi to Delhi):
  $$\text{CGST} = 9\% \quad\text{and}\quad \text{SGST} = 9\% \quad (\text{Total } = 18\%)$$
- **Inter-State Supply** (Brand in Mumbai, VyaparMedia in Delhi):
  $$\text{IGST} = 18\%$$

#### 4. B2B Tax Invoices & Input Tax Credit (ITC)
- Brands enter their corporate GSTIN during onboarding.
- Upon completion of a campaign or deal, the platform automatically generates an official **B2B Tax Invoice** with:
  - Unique Sequential Invoice Number (e.g., `VM/2026-27/00482`).
  - Brand Corporate Name, Registered Address, and GSTIN.
  - VyaparMedia Name, Address, CIN, and GSTIN.
  - SAC Code `998371`, Place of Supply, and State Code.
  - Taxable Value, CGST/SGST/IGST breakdown, and Total Payable.
- Brands can utilize this invoice to claim **100% Input Tax Credit (ITC)** against their outward GST liabilities in their monthly **GSTR-3B** return.

#### 5. Monthly GST Reporting & GSTR-1
The platform's `/admin/financial` section exports consolidated CSV reports matching the exact format required for quarterly and monthly **GSTR-1** (Outward Supplies) filing.

---

### 2.3 Income Tax & TDS Compliance (Section 194J & 206AA)

Influencer marketing services in India qualify as **Fees for Professional or Technical Services** under **Section 194J** of the Income Tax Act, 1961.

#### 1. Statutory TDS Deduction Thresholds
- **Verified PAN Present**: TDS is deducted at **1%** (for technical/advertising facilitation contracts).
- **Inoperative or Missing PAN (Section 206AA)**: If a creator has not submitted a valid PAN or PAN-Aadhaar linking is incomplete, TDS is automatically deducted at the penal rate of **20%**.

#### 2. Escrow Settlement Math Example
Agreed Creator Deal Fee: ₹50,000 (5,000,000 Paise)

| Line Item | With Verified PAN (1% TDS) | Without PAN (20% TDS) |
|---|---|---|
| **Agreed Deal Fee** | ₹50,000 | ₹50,000 |
| **Platform Commission (10%)** | ₹5,000 | ₹5,000 |
| **GST on Platform Fee (18%)** | ₹900 | ₹900 |
| **Net Creator Compensation** | ₹45,000 | ₹45,000 |
| **TDS Withheld (Section 194J)** | **₹450 (1%)** | **₹9,000 (20%)** |
| **Direct Bank Disbursement to Creator** | **₹44,550** | **₹36,000** |
| **TDS Remitted to Income Tax Dept** | **₹450** | **₹9,000** |

#### 3. Monthly Challan 281 & Form 26Q Returns
1. All TDS withheld in a calendar month is credited to the `TreasuryLedger` in PostgreSQL.
2. Platform finance team deposits the total TDS to the Central Government using **Challan ITNS 281** on or before the **7th of the following month**.
3. Every quarter, VyaparMedia files **Form 26Q** with the Income Tax Department.
4. **Form 16A Certificates**: The platform provides automated downloadable Form 16A certificates in the creator dashboard for their annual income tax filing.

---

### 2.4 RBI Nodal & Escrow Account Regulations (Payment Aggregator)

Under the **Reserve Bank of India (RBI) Master Directions for Regulation of Payment Aggregators and Payment Gateways (PA/PG Guidelines)**:

1. **Strict Segregation of Funds**:
   - Customer escrow deposits are maintained in a **Nodal / Escrow Account** with a scheduled commercial bank (e.g. Axis Bank, ICICI Bank, Razorpay Nodal Escrow).
   - Escrow balances are held in trust and **never co-mingled** with VyaparMedia's operational expenses or working capital accounts.
2. **Settlement Timelines**:
   - Payout disbursements to creators are executed within **T+1 / T+2 bank business days** of deal approval.
3. **Penny-Drop Bank Verification**:
   - Before any withdrawal is permitted, the creator's bank account undergoes penny-drop verification (Razorpay Fund Account Validation) to verify account holder name matches KYC PAN records.

---

### 2.5 Indian Contract Act 1872 & IT Act 2000 Electronic Agreements

Every deal room generated on VyaparMedia creates a **legally binding, digital contract**:
- **Section 10A of the Information Technology Act, 2000**: Recognizes the legal validity of electronic contracts formed through digital acceptance and electronic records.
- **Section 65B of the Indian Evidence Act, 1872**: Every contract includes a cryptographically verifiable electronic audit trail:
  - Immutable SHA-256 hash of agreed contract terms.
  - Signer User ID, verified email, and phone OTP verification timestamp.
  - Client IP Address and User-Agent signature.
  - Signed using `CONTRACT_SIGNING_SECRET`.

---

### 2.6 Financial Statements & Tax Invoice Generation

The platform provides live printable, PDF-exportable statements (`StatementPrintView.tsx`):
- Includes complete corporate letterhead: Company Legal Name, CIN, GSTIN, and Registered Address.
- Complies with RBI guidelines and Indian Contract Act disclosures.
- Displays opening balance, total credits, total debits, TDS withheld, platform commission, and closing wallet balance.

---

## 3. Third-Party Services Directory

### 3.1 Database: Supabase PostgreSQL (AWS Mumbai)
- **Role**: Primary database, relational data, and connection pooler.
- **Website**: [supabase.com](https://supabase.com)
- **Free Tier**: 500 MB DB, 50,000 monthly active users, 500 pooler connections via Supavisor.
- **Paid Tier ($25/mo - Pro)**: 8 GB storage, 100,000 monthly active users, daily automated backups with PITR.
- **Configuration**:
  - `DATABASE_URL` (Port 6543): Transaction Pooler (`?sslmode=require&pgbouncer=true&connection_limit=1`)
  - `DIRECT_URL` (Port 5432): Session Mode direct connection for migrations.

---

### 3.2 Caching & Distributed Locks: Upstash Redis
- **Role**: Distributed rate limiting, Redis session storage, and landing page cache.
- **Website**: [upstash.com](https://upstash.com)
- **Free Tier**: 10,000 commands/day, 256 MB storage.
- **Paid Tier**: $0.20 per 100,000 commands (Serverless Pay-As-You-Go).
- **Configuration**: `REDIS_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

---

### 3.3 Serverless Cron Scheduling: Upstash QStash
- **Role**: Dispatches scheduled HTTP webhooks to trigger platform maintenance jobs without long-running servers.
- **Website**: [upstash.com/docs/qstash](https://upstash.com/docs/qstash)
- **Free Tier**: 500 messages per day, 3 automated retries.
- **Paid Tier**: $1.00 per 100,000 messages.
- **Configuration**: `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`.

---

### 3.4 Payments & Escrow: Razorpay & RazorpayX
- **Role**: Brand UPI/Credit Card deposits and instant IMPS creator payouts.
- **Website**: [razorpay.com](https://razorpay.com)
- **Pricing**:
  - Sandbox Test Mode: 100% Free (`rzp_test_...`).
  - Inbound Gateway: 2% + GST per successful transaction.
  - RazorpayX Bank Payouts: ₹2 to ₹9 per transfer.
  - Razorpay Route Split Transfer: ₹0 to creator linked account.
- **Webhook Endpoints**:
  - Payment Captures: `https://yourdomain.com/api/webhooks/razorpay`
  - Route Split Transfer Reconciliation: `https://yourdomain.com/api/webhooks/razorpay/process`

---

### 3.5 Logistics & Fulfillment: Shiprocket API
- **Role**: Courier booking, AWB assignment, and real-time delivery tracking.
- **Website**: [shiprocket.in](https://shiprocket.in)
- **Pricing**:
  - Account: 100% Free (No monthly maintenance fee).
  - Shipping Cost: Pay only carrier freight fees (starts ~₹40 per 500g via Delhivery Surface).
- **Webhook Endpoint**: `https://yourdomain.com/api/webhooks/shiprocket`

---

### 3.6 Transactional Communications: Resend & WhatsApp Cloud API
- **Resend (Email)**:
  - Free Tier: 3,000 emails/month (100 emails/day), custom DKIM domain.
  - Paid Tier: $20/month for 50,000 emails.
- **Meta WhatsApp Cloud API (2FA & Alerts)**:
  - Free Tier: First 1,000 service conversations every month are **100% Free**.
  - Paid: Utility template messages cost ~₹0.35–₹0.75 per message.

---

### 3.7 Cloud Object Storage: Cloudflare R2 (Zero Egress)
- **Role**: Storage for media attachments, contract PDFs, and delivery proof images.
- **Website**: [cloudflare.com/developer-platform/r2](https://www.cloudflare.com/developer-platform/r2/)
- **Free Tier**:
  - **10 GB storage per month**
  - **1,000,000 Class A operations (writes) per month**
  - **10,000,000 Class B operations (reads) per month**
  - **$0.00 Egress Fees** (Zero bandwidth charges!).
- **Paid Tier**: $0.015 per GB/month for additional storage.

---

### 3.8 Identity, KYC & Tax Compliance: Surepass & DigiLocker
- **Manual Mode**: Default mode is **100% Free**. Creators upload PAN/Aadhaar photos; platform admin approves via `/admin/verifications`.
- **Automated Surepass API**: Real-time NSDL PAN validation and Aadhaar OTP verification (~₹1.50 per verification).

---

### 3.9 Social Metrics: Instagram Graph API & YouTube Data API
- **Instagram Business Login (Meta Graph API v22.0)**:
  - 100% Free. Requires Meta Developer App setup and review for production approval.
- **YouTube Data API v3**:
  - 100% Free (10,000 daily quota units from Google Cloud Console).

---

### 3.10 Computer Vision & Contact Leakage: Google Cloud Vision
- **Free Tier**: 1,000 images per month 100% Free.
- **Paid Tier**: $1.50 per 1,000 images.

---

### 3.11 Error Tracking & Telemetry: Sentry
- **Free Tier**: 5,000 error events/month, 10,000 performance transactions.
- **Paid Tier**: $26/month for Team Plan.

---

## 4. Complete API Endpoints & Webhooks Directory

### Authentication & User Profiles
- `POST /api/auth/register`: Register new creator or brand with role assignment.
- `POST /api/auth/login`: Email/password and phone OTP verification.
- `GET /api/auth/session`: Active NextAuth session details.
- `POST /api/auth/otp/send`: Request WhatsApp/SMS OTP.
- `POST /api/auth/otp/verify`: Verify 6-digit OTP token.

### Campaigns & Discovery
- `GET /api/campaigns`: Paginated campaigns feed with category and budget filters.
- `POST /api/campaigns`: Brand creates campaign with deliverable requirements.
- `GET /api/campaigns/[id]`: Comprehensive campaign details and application status.
- `GET /api/creators`: Full-text GIN search for creators across categories and DRS scores.

### Deals & Escrow Contracts
- `POST /api/deals/apply`: Creator applies to campaign with pitch and proposed fee.
- `POST /api/deals/[id]/accept`: Brand accepts applicant and generates deal room.
- `POST /api/deals/[id]/fund-escrow`: Locks deal budget into platform escrow.
- `POST /api/deals/[id]/shipping-address`: Creator submits physical product delivery address.
- `POST /api/deals/[id]/dispatch`: Brand initiates Shiprocket courier dispatch.
- `POST /api/deals/[id]/submit-content`: Creator uploads published post/video links.
- `POST /api/deals/[id]/approve`: Brand approves deliverables and triggers escrow release.

### Financial Wallet & Payouts
- `GET /api/wallet/balance`: Active balance, locked escrow holds, and ledger statement.
- `POST /api/wallet/deposit`: Create Razorpay payment order for wallet topup.
- `POST /api/wallet/withdraw`: Request bank withdrawal with TDS Section 194J deduction.

### Webhook Receivers
- `POST /api/webhooks/razorpay`: Verifies `X-Razorpay-Signature` and processes payment captures.
- `POST /api/webhooks/shiprocket`: Timing-safe `x-api-key` validation for delivery checkpoints.

### Scheduled Background Crons (QStash)
- `POST /api/cron/escrow-expiry`: Auto-releases escrow if brand doesn't review within 48h.
- `POST /api/cron/sync-shipments`: Syncs in-flight courier checkpoints with Shiprocket.
- `POST /api/cron/daily-digest`: Daily financial ledger reconciliation and TDS calculations.
- `POST /api/cron/kyc-audit`: Cleans up expired temporary verification tokens.

### System Monitoring
- `GET /api/health`: System healthcheck (PostgreSQL, Redis, Storage connectivity).
- `GET /api/metrics`: Prometheus-compatible performance metrics.

---

## 5. Environment Variables Dictionary (.env.production)

```bash
# ==============================================================================
# 1. APPLICATION CORE
# ==============================================================================
NODE_ENV="production"
PORT=3000
NEXTAUTH_URL="https://vyaparmedia-nine.vercel.app"
NEXT_PUBLIC_APP_URL="https://vyaparmedia-nine.vercel.app"
APP_BASE_URL="https://vyaparmedia-nine.vercel.app"
LOG_LEVEL="info"

# Cryptographic Keys (Generate each using: openssl rand -hex 32)
NEXTAUTH_SECRET="<64-hex-chars>"
AUTH_SECRET="<64-hex-chars>"
OTP_HASH_SECRET="<64-hex-chars>"
CONTRACT_SIGNING_SECRET="<64-hex-chars>"
CRON_SECRET="<64-hex-chars>"
HEALTHCHECK_SECRET="<64-hex-chars>"

# AES-256-GCM Banking Encryption Keys
ENCRYPTION_KEYS="v1:<64-hex-chars>"
ENCRYPTION_KEY="<64-hex-chars>"
HMAC_KEY="<64-hex-chars>"

# ==============================================================================
# 2. CORPORATE ENTITY & GST COMPLIANCE
# ==============================================================================
PLATFORM_CIN="U74999KA2024PTC123456"
PLATFORM_GSTIN="29AABCV1234F1Z5"
PLATFORM_PAN="AABCV1234F"
PLATFORM_ADDRESS="Bellandur, Outer Ring Road, Bengaluru, Karnataka 560103"
PLATFORM_EMAIL="support@vyaparmedia.in"
PLATFORM_PHONE="+91-8045678900"
PLATFORM_WEBSITE="https://vyaparmedia-nine.vercel.app"

# ==============================================================================
# 3. DATABASE (SUPABASE POSTGRESQL)
# ==============================================================================
DATABASE_URL="postgresql://postgres.<REF>:<PASS>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:<PASS>@db.<REF>.supabase.co:5432/postgres?sslmode=require"
ALLOW_INSECURE_DATABASE="false"

# ==============================================================================
# 4. REDIS & CRONS (UPSTASH)
# ==============================================================================
REDIS_URL="rediss://default:<PASS>@<HOST>.upstash.io:6379"
UPSTASH_REDIS_REST_URL="https://<HOST>.upstash.io"
UPSTASH_REDIS_REST_TOKEN="<TOKEN>"
QSTASH_TOKEN="<TOKEN>"
QSTASH_CURRENT_SIGNING_KEY="<KEY>"
QSTASH_NEXT_SIGNING_KEY="<KEY>"

# ==============================================================================
# 5. PAYMENTS & ESCROW (RAZORPAY)
# ==============================================================================
RAZORPAY_KEY_ID="rzp_live_XXXXXXXXXXXX"
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_live_XXXXXXXXXXXX"
RAZORPAY_KEY_SECRET="XXXXXXXXXXXX"
RAZORPAY_WEBHOOK_SECRET="<WEBHOOK_SECRET>"
RAZORPAY_ACCOUNT_NUMBER="XXXXXXXXXXXX"

# ==============================================================================
# 6. LOGISTICS (SHIPROCKET)
# ==============================================================================
SHIPROCKET_EMAIL="logistics@yourdomain.com"
SHIPROCKET_PASSWORD="YourShiprocketPassword"
SHIPROCKET_PICKUP_LOCATION="Primary"
SHIPROCKET_PICKUP_PINCODE="400001"
SHIPROCKET_WEBHOOK_SECRET="<64-hex-chars>"

# ==============================================================================
# 7. OBJECT STORAGE (CLOUDFLARE R2)
# ==============================================================================
STORAGE_PROVIDER="r2"
S3_BUCKET="vyaparmedia-prod"
S3_REGION="auto"
S3_ACCESS_KEY="<R2_ACCESS_KEY_ID>"
S3_SECRET_KEY="<R2_SECRET_ACCESS_KEY>"
S3_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
STORAGE_PUBLIC_URL="https://cdn.yourdomain.com"

# ==============================================================================
# 8. COMMUNICATIONS
# ==============================================================================
RESEND_API_KEY="re_XXXXXXXXXXXX"
FROM_EMAIL="notifications@yourdomain.com"
REPLY_TO_EMAIL="support@yourdomain.com"
OTP_PRIMARY_CHANNEL="whatsapp"
OTP_SMS_FALLBACK="true"

# ==============================================================================
# 9. BUSINESS RULES
# ==============================================================================
PLATFORM_FEE_PERCENTAGE=10
GATEWAY_FEE_PERCENTAGE=2
MIN_WITHDRAWAL_AMOUNT=50000        # ₹500 in Paise
MAX_WITHDRAWAL_AMOUNT=50000000     # ₹5,00,000 in Paise
```

---

## 6. Database Initialization, Triggers & Hardening

Execute these commands in sequence during CI/CD deployment:

```bash
# 1. Generate Prisma Client
npm run db:generate

# 2. Deploy schema migrations
npm run db:migrate:deploy

# 3. Apply append-only ledger immutability triggers and RLS policies
npx tsx scripts/apply-hardening-migration.ts

# 4. Seed Platform Treasury & Gamification Badges
npm run seed:treasury
npm run seed:badges
```

---

## 7. Deployment Options

### Option A: Vercel Serverless (Recommended)

1. Connect your Git repository to Vercel.
2. Set Framework Preset: **Next.js**.
3. Set Root Directory: `vyaparmedia`.
4. Configure Build Command:
   ```bash
   prisma generate && npx prisma migrate deploy && next build && node scripts/prepare-standalone.mjs
   ```
5. Add all Environment Variables from Section 5.
6. Click **Deploy**. Vercel deploys serverless functions globally with edge caching.

---

### Option B: Self-Hosted Docker & VPS (Ubuntu / Nginx / PM2)

#### 1. Setup Server
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git certbot python3-certbot-nginx
sudo npm install -g pm2
```

#### 2. Clone & Build
```bash
git clone https://github.com/your-org/vyaparmedia.git /var/www/vyaparmedia
cd /var/www/vyaparmedia/vyaparmedia
cp .env.example .env
nano .env

npm ci
npm run db:generate
npm run db:migrate:deploy
npm run build
```

#### 3. PM2 Process Configuration
Create `/var/www/vyaparmedia/vyaparmedia/ecosystem.config.cjs`:
```javascript
module.exports = {
  apps: [
    {
      name: "vyaparmedia",
      script: ".next/standalone/server.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
```
Start PM2:
```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

#### 4. Nginx Reverse Proxy with SSL
```nginx
server {
    server_name vyaparmedia.in www.vyaparmedia.in;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Install SSL certificate:
```bash
sudo certbot --nginx -d vyaparmedia.in -d www.vyaparmedia.in
```

---

## 8. Automated Cron Schedules Registration

Register recurring cron triggers with Upstash QStash using the automated script:

```bash
npx tsx scripts/setup-qstash-crons.ts
```

| Cron Name | Schedule | Endpoint | Purpose |
|---|---|---|---|
| **Escrow Expiry Guard** | Hourly (`0 * * * *`) | `/api/cron/escrow-expiry` | Auto-releases escrow if brand doesn't review within 48h |
| **Logistics Checkpoint Sync** | Every 30m (`*/30 * * * *`) | `/api/cron/sync-shipments` | Syncs courier status and marks delivered packages as `RECEIVED` |
| **Daily Financial Digest** | Daily 00:00 UTC | `/api/cron/daily-digest` | Reconciles ledger transactions, platform fees, and TDS accounts |
| **KYC Audit Cleanup** | Weekly Sun 02:00 UTC | `/api/cron/kyc-audit` | Prunes expired verification tokens |

---

## 8.1 Domain Authentication & Email Delivery (SPF, DKIM, DMARC)

Under Google & Yahoo sender compliance requirements (effective Feb 2024), all transactional email delivery requires authenticated domains:

### 1. Resend DNS Configuration for `vyaparmedia.in`
Publish the following DNS records in Cloudflare / domain registrar:

| Type | Name | Content / Value | Priority / TTL |
|---|---|---|---|
| **TXT** | `@` / `vyaparmedia.in` | `v=spf1 include:resend.com ~all` | Auto |
| **CNAME** | `resend._domainkey` | `dkim.resend.com.` | Auto |
| **CNAME** | `email.vyaparmedia.in` | `send.resend.com.` | Auto |
| **TXT** | `_dmarc.vyaparmedia.in` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@vyaparmedia.in; pct=100; adkim=r; aspf=r` | Auto |

### 2. Pre-Flight Verification
Verify domain verification status via Resend CLI or dig:
```bash
dig TXT vyaparmedia.in +short
# Must return: "v=spf1 include:resend.com ~all"

dig TXT _dmarc.vyaparmedia.in +short
# Must return: "v=DMARC1; p=quarantine; ..."
```

---

## 8.2 Zero-Downtime Database Migration Strategy (Expand-Contract Policy)

To eliminate the risk of production downtime during the 1-4 minute window between `prisma migrate deploy` and Vercel build/CDN deployment:

### The 3-Phase Expand-Contract Workflow:
1. **Phase 1: Expand (Non-Breaking Schema Changes)**
   - Add new nullable columns or default values.
   - Add new tables, views, or indexes.
   - **Rule**: NEVER drop columns, rename columns, or add `NOT NULL` without defaults in this phase.
   - Run `npx prisma migrate deploy` safely against production.
2. **Phase 2: Deploy Application Code**
   - Application code is deployed to Vercel.
   - Code writes to both old and new schema columns (dual-write).
   - Code reads from the new schema with fallback to old schema.
   - Old and new Vercel lambdas function without crashing regardless of replica timing.
3. **Phase 3: Contract (Cleanup Deprecations)**
   - Once all traffic is routed to the new bundle and verified on `/api/health`, deploy a final cleanup migration removing deprecated columns and views.

---

## 9. Production Pre-Flight Checklist

Before opening registration to live creators and brands, verify these 4 commands exit cleanly:

- [ ] **1. TypeScript Compiler**:
  ```bash
  npm run typecheck
  ```
  *(Must exit with 0 errors)*

- [ ] **2. Action-Button Rule Linter**:
  ```bash
  npm run lint:actions
  ```
  *(50/50 state-changing buttons gated with eligibility predicates)*

- [ ] **3. End-to-End Deal Lifecycle Test**:
  ```bash
  npm run test:e2e
  ```
  *(Runs complete real transaction cycle against PostgreSQL)*

- [ ] **4. Production Performance Benchmark**:
  ```bash
  npx tsx scripts/benchmark-all-pages-and-actions.ts
  ```
  *(Verifies all 16 pages and 13 actions pass SLA thresholds)*

---

## 10. Cost Breakdown: $0 Bootstrapping vs. Scaled Production

| Infrastructure Component | Bootstrapping Tier ($0 / month) | Scaled Production (100k Users) |
|---|---|---|
| **Hosting & Compute** | Vercel Hobby ($0) / Oracle Free Cloud | Vercel Pro ($20/mo) / AWS EC2 ($25/mo) |
| **PostgreSQL Database** | Supabase Free (500MB DB, 50k MAU) | Supabase Pro ($25/mo) |
| **Redis Cache** | Upstash Redis Free (10k cmds/day) | Upstash Pay-As-You-Go (~$5/mo) |
| **Cron Scheduling** | Upstash QStash Free (500 msgs/day) | Upstash QStash (~$2/mo) |
| **Object Storage** | Cloudflare R2 Free (10GB + $0 Egress) | Cloudflare R2 (~$3/mo) |
| **Logistics API** | Shiprocket Free Account | Shiprocket Free Account (Freight charged to brands) |
| **Payment Gateway** | Razorpay (2% per transaction, ₹0 monthly) | Razorpay (2% per transaction, ₹0 monthly) |
| **Transactional Email** | Resend Free (3,000 emails/mo) | Resend Pro ($20/mo) |
| **Total Monthly Fixed Cost** | **$0.00 / month** | **~$75.00 / month** |

---

### 🎉 Your VyaparMedia production environment is fully documented, legally compliant, and ready for deployment!
For design tokens or architecture patterns, see [`ARCHITECTURE_PATTERNS.md`](file:///c:/Decisional-main/ARCHITECTURE_PATTERNS.md) and [`AGENTS.md`](file:///c:/Decisional-main/AGENTS.md).
