/**
 * Deterministic test factories for VyaparMedia domain models.
 * Rules enforced:
 * - Money strictly represented as integer paise (Rs 1.00 = 100 paise).
 * - Rates strictly represented as basis points (bps).
 * - Quality flags: VERIFIED | ESTIMATED | SELF_REPORTED | UNAVAILABLE.
 */

export interface TestUser {
  id: string;
  email: string;
  phone: string;
  userType: "BRAND" | "INFLUENCER" | "ADMIN" | "SCOUT" | "AGENCY";
  status: "ACTIVE" | "PENDING_VERIFICATION" | "SUSPENDED" | "DELETED";
  verificationLevel: "NONE" | "PARTIAL" | "FULL";
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function userFactory(overrides?: Partial<TestUser>): TestUser {
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return {
    id: `usr_${rand}`,
    email: `user_${rand}@test.vyaparmedia.in`,
    phone: `+9198765${rand}`,
    userType: "BRAND",
    status: "ACTIVE",
    verificationLevel: "FULL",
    emailVerified: true,
    phoneVerified: true,
    twoFactorEnabled: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

export interface TestBrandProfile {
  id: string;
  userId: string;
  companyName: string;
  brandName: string;
  website: string;
  industry: string;
  gstNumber: string;
  panNumber: string;
  isGstVerified: boolean;
  isPanVerified: boolean;
  walletBalancePaise: number; // Integer paise
  qualityFlag: "VERIFIED" | "ESTIMATED" | "SELF_REPORTED" | "UNAVAILABLE";
  createdAt: Date;
  updatedAt: Date;
}

export function brandProfileFactory(overrides?: Partial<TestBrandProfile>): TestBrandProfile {
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return {
    id: `brd_${rand}`,
    userId: `usr_brand_${rand}`,
    companyName: `Brand Co ${rand} Pvt Ltd`,
    brandName: `Brand ${rand}`,
    website: `https://brand${rand}.example.com`,
    industry: "Retail & E-commerce",
    gstNumber: "27AAAAA1111A1Z1",
    panNumber: "ABCDE1234F",
    isGstVerified: true,
    isPanVerified: true,
    walletBalancePaise: 10_000_000, // 1 Lakh INR in paise
    qualityFlag: "VERIFIED",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

export interface TestInfluencerProfile {
  id: string;
  userId: string;
  displayName: string;
  instagramHandle: string;
  youtubeHandle: string | null;
  minRatePaise: number; // Integer paise
  maxRatePaise: number; // Integer paise
  instagramFollowers: number;
  instagramEngagementRateBps: number; // Basis points (e.g. 350 = 3.50%)
  drsScore: number;
  verificationTier: "NANO" | "MICRO" | "MID_TIER" | "MACRO" | "MEGA";
  qualityFlag: "VERIFIED" | "ESTIMATED" | "SELF_REPORTED" | "UNAVAILABLE";
  createdAt: Date;
  updatedAt: Date;
}

export function influencerProfileFactory(overrides?: Partial<TestInfluencerProfile>): TestInfluencerProfile {
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return {
    id: `inf_${rand}`,
    userId: `usr_influencer_${rand}`,
    displayName: `Creator ${rand}`,
    instagramHandle: `creator_${rand}`,
    youtubeHandle: null,
    minRatePaise: 50_000, // Rs 500 in paise
    maxRatePaise: 5_000_000, // Rs 50,000 in paise
    instagramFollowers: 75_000,
    instagramEngagementRateBps: 380, // 3.80%
    drsScore: 785,
    verificationTier: "MID_TIER",
    qualityFlag: "VERIFIED",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

export interface TestCampaign {
  id: string;
  brandId: string;
  title: string;
  description: string;
  budgetPaise: number; // Integer paise
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  deliverables: Array<{ type: string; count: number }>;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export function campaignFactory(overrides?: Partial<TestCampaign>): TestCampaign {
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return {
    id: `cmp_${rand}`,
    brandId: `brd_${rand}`,
    title: `Campaign ${rand} Festive Promotion`,
    description: "Multi-channel festive season brand awareness campaign.",
    budgetPaise: 50_000_000, // Rs 5,00,000 in paise
    status: "ACTIVE",
    deliverables: [{ type: "INSTAGRAM_REEL", count: 2 }],
    startDate: new Date("2026-10-01T00:00:00.000Z"),
    endDate: new Date("2026-10-31T23:59:59.000Z"),
    createdAt: new Date("2026-09-15T00:00:00.000Z"),
    updatedAt: new Date("2026-09-15T00:00:00.000Z"),
    ...overrides,
  };
}

export interface TestDeal {
  id: string;
  campaignId: string;
  brandId: string;
  influencerId: string;
  amountPaise: number; // Integer paise
  platformFeePaise: number; // Integer paise
  taxPaise: number; // Integer paise
  netPayoutPaise: number; // Integer paise
  status: "PROPOSED" | "ACCEPTED" | "ESCROW_LOCKED" | "SUBMITTED" | "APPROVED" | "RELEASED" | "DISPUTED";
  escrowStatus: "UNFUNDED" | "HELD" | "PARTIALLY_RELEASED" | "RELEASED" | "REFUNDED";
  createdAt: Date;
  updatedAt: Date;
}

export function dealFactory(overrides?: Partial<TestDeal>): TestDeal {
  const rand = Math.floor(Math.random() * 90000) + 10000;
  const amountPaise = overrides?.amountPaise ?? 1_000_000; // Rs 10,000
  const platformFeePaise = Math.round((amountPaise * 500) / 10000); // 5.00% fee
  const taxPaise = Math.round((platformFeePaise * 1800) / 10000); // 18% GST on fee
  const netPayoutPaise = amountPaise - platformFeePaise;

  return {
    id: `del_${rand}`,
    campaignId: `cmp_${rand}`,
    brandId: `brd_${rand}`,
    influencerId: `inf_${rand}`,
    amountPaise,
    platformFeePaise,
    taxPaise,
    netPayoutPaise,
    status: "ACCEPTED",
    escrowStatus: "HELD",
    createdAt: new Date("2026-10-05T00:00:00.000Z"),
    updatedAt: new Date("2026-10-05T00:00:00.000Z"),
    ...overrides,
  };
}

export interface TestDrsScoreSnapshot {
  id: string;
  influencerId: string;
  drsScore: number;
  deliveryScore: number;
  reliabilityScore: number;
  scalabilityScore: number;
  qualityFlag: "VERIFIED" | "ESTIMATED" | "SELF_REPORTED" | "UNAVAILABLE";
  capturedAt: Date;
}

export function drsScoreSnapshotFactory(overrides?: Partial<TestDrsScoreSnapshot>): TestDrsScoreSnapshot {
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return {
    id: `drs_${rand}`,
    influencerId: `inf_${rand}`,
    drsScore: 820,
    deliveryScore: 840,
    reliabilityScore: 810,
    scalabilityScore: 810,
    qualityFlag: "VERIFIED",
    capturedAt: new Date("2026-10-15T12:00:00.000Z"),
    ...overrides,
  };
}
