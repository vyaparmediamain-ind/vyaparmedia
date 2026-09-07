import Module from "node:module";
const originalRequire = Module.prototype.require;
Module.prototype.require = function (this: unknown, path: string) {
  if (path === "server-only") return {};
  return originalRequire.call(this, path);
};


import bcrypt from "bcryptjs";
import { DocumentType } from "@prisma/client";
import prisma from "../src/lib/db";
import { seedTreasury } from "./seed-treasury";
import { seedBadges } from "./seed-badges";

const PASSWORD = process.env.TEST_ACCOUNT_PASSWORD ?? "Test@1234";
const BRAND_WALLET_PAISE = 100_000 * 100; // Rs 1,00,000

async function upsertUser(email: string, phone: string, userType: "INFLUENCER" | "BRAND" | "ADMIN") {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { phone }],
    },
  });

  if (existing) {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { email, phone, status: "ACTIVE", verificationLevel: "FULL", emailVerified: true, phoneVerified: true, passwordHash, userType },
    });
    console.log("+ User [" + userType + "] updated: " + email + " (id: " + user.id + ")");
    return user;
  }

  const user = await prisma.user.create({
    data: { email, phone, passwordHash, userType, status: "ACTIVE", verificationLevel: "FULL", emailVerified: true, phoneVerified: true },
  });
  console.log("+ User [" + userType + "] created: " + email + " (id: " + user.id + ")");
  return user;
}

async function seedDoc(userId: string, docId: string, type: DocumentType, label: string) {
  await prisma.verificationDocument.upsert({
    where: { id: docId },
    update: { status: "VERIFIED", verifiedAt: new Date() },
    create: {
      id: docId,
      userId,
      type,
      documentUrl: "https://placehold.co/" + docId + ".jpg",
      status: "VERIFIED",
      verifiedAt: new Date(),
      metadata: { seeded: true },
    },
  });
  console.log("  + KYC: " + label + " (Verified)");
}

async function seedTaxCompliance(userId: string, isBrand: boolean) {
  await prisma.indiaTaxCompliance.upsert({
    where: { userId },
    update: {
      status: "READY",
      panLast4: "1234",
      gstinLast4: isBrand ? "5678" : null,
      gstRegistrationType: isBrand ? "REGISTERED" : "UNREGISTERED",
      eInvoiceApplicable: isBrand,
      verifiedAt: new Date(),
    },
    create: {
      userId,
      panNumber: "ABCDE1234F",
      panLast4: "1234",
      gstin: isBrand ? "27AAAAA1111A1Z1" : null,
      gstinLast4: isBrand ? "5678" : null,
      gstRegistrationType: isBrand ? "REGISTERED" : "UNREGISTERED",
      eInvoiceApplicable: isBrand,
      status: "READY",
      verifiedAt: new Date(),
    },
  });
  console.log("  + Tax Compliance status set to READY");
}

async function seedBankAccount(userId: string, accountName: string, bankName: string) {
  const account = await prisma.bankAccount.findFirst({
    where: { userId },
  });

  if (account) {
    await prisma.bankAccount.update({
      where: { id: account.id },
      data: {
        accountName,
        accountNumber: "912345678901",
        ifscCode: "HDFC0000123",
        bankName,
        upiId: userId.substring(0, 8) + "@okaxis",
        isDefault: true,
      },
    });
  } else {
    await prisma.bankAccount.create({
      data: {
        userId,
        accountName,
        accountNumber: "912345678901",
        ifscCode: "HDFC0000123",
        bankName,
        upiId: userId.substring(0, 8) + "@okaxis",
        isDefault: true,
      },
    });
  }
  console.log("  + Bank Account seeded and set as default: " + bankName);
}

async function main() {
  console.log("\n Seeding test accounts with full verification...\n");

  await seedTreasury();

  // --- ADMIN ---
  const admin = await upsertUser("admin@test.vyaparmedia.in", "+919000000001", "ADMIN");
  await seedDoc(admin.id, "seed-admin-pan-" + admin.id, "PAN_CARD", "Admin PAN");

  // --- BRAND ---
  const brand = await upsertUser("brand@test.vyaparmedia.in", "+919000000002", "BRAND");
  await prisma.brandProfile.upsert({
    where: { userId: brand.id },
    update: {
      companyName: "Test Brand Co.",
      industry: "Fashion",
      city: "Mumbai",
      state: "Maharashtra",
      isGstVerified: true,
      isPanVerified: true,
      isCinVerified: true,
      gstNumber: "27AAAAA1111A1Z1",
      panNumber: "ABCDE1234F",
      cinNumber: "L21090MH1985PLC012345",
    },
    create: {
      userId: brand.id,
      companyName: "Test Brand Co.",
      website: "https://testbrand.example.com",
      description: "Test brand for QA and development.",
      industry: "Fashion",
      city: "Mumbai",
      state: "Maharashtra",
      isGstVerified: true,
      isPanVerified: true,
      isCinVerified: true,
      gstNumber: "27AAAAA1111A1Z1",
      panNumber: "ABCDE1234F",
      cinNumber: "L21090MH1985PLC012345",
    },
  });
  console.log("  + BrandProfile upserted with GST, PAN & CIN Numbers");

  const wallet = await prisma.wallet.upsert({
    where: { userId: brand.id },
    update: { balance: BRAND_WALLET_PAISE, totalDeposited: BRAND_WALLET_PAISE },
    create: { userId: brand.id, balance: BRAND_WALLET_PAISE, totalDeposited: BRAND_WALLET_PAISE },
  });

  await prisma.transaction.upsert({
    where: { id: "seed-brand-deposit-" + brand.id },
    update: {},
    create: {
      id: "seed-brand-deposit-" + brand.id,
      walletId: wallet.id,
      type: "CREDIT",
      amount: BRAND_WALLET_PAISE,
      status: "COMPLETED",
      description: "Test seed deposit - Rs 1,00,000 initial wallet balance",
    },
  });
  console.log("  + Wallet: Rs 1,00,000 (" + BRAND_WALLET_PAISE + " paise)");

  // Seed KYC Docs for Brand
  await seedDoc(brand.id, "seed-brand-pan-" + brand.id, "PAN_CARD", "Brand PAN");
  await seedDoc(brand.id, "seed-brand-gst-" + brand.id, "GST_CERTIFICATE", "Brand GST");
  await seedDoc(brand.id, "seed-brand-cin-" + brand.id, "CIN_CERTIFICATE", "Brand CIN");
  await seedDoc(brand.id, "seed-brand-bank-" + brand.id, "BANK_STATEMENT", "Brand Bank Statement");
  await seedDoc(brand.id, "seed-brand-aadhaar-" + brand.id, "AADHAAR", "Brand Aadhaar");
  await seedDoc(brand.id, "seed-brand-selfie-" + brand.id, "SELFIE", "Brand Selfie");

  // Seed Tax and Bank details for Brand
  await seedTaxCompliance(brand.id, true);
  await seedBankAccount(brand.id, "Test Brand Co.", "HDFC Bank");

  // --- INFLUENCER ---
  const influencer = await upsertUser("influencer@test.vyaparmedia.in", "+919000000003", "INFLUENCER");
  await prisma.influencerProfile.upsert({
    where: { userId: influencer.id },
    update: {
      displayName: "Test Influencer",
      bio: "Fashion and lifestyle creator. QA test account.",
      city: "Delhi",
      state: "Delhi",
      gender: "Female",
      age: 24,
      categories: "Fashion,Lifestyle,Beauty",
      languages: "Hindi,English",
      instagramHandle: "test.influencer",
      instagramFollowers: 85000,
      instagramEngagementRate: 3.8,
      youtubeHandle: "testinfluencer",
      youtubeSubscribers: 42000,
      youtubeEngagementRate: 4.2,
      minRate: 50000,
      maxRate: 5000000,
      minInstagramRate: 30000,
      maxInstagramRate: 2000000,
      minYoutubeRate: 75000,
      maxYoutubeRate: 3500000,
      followerAuthenticityScore: 82,
      contentQualityScore: 78,
    },
    create: {
      userId: influencer.id,
      displayName: "Test Influencer",
      bio: "Fashion and lifestyle creator. QA test account.",
      city: "Delhi",
      state: "Delhi",
      gender: "Female",
      age: 24,
      categories: "Fashion,Lifestyle,Beauty",
      languages: "Hindi,English",
      instagramHandle: "test.influencer",
      instagramFollowers: 85000,
      instagramEngagementRate: 3.8,
      youtubeHandle: "testinfluencer",
      youtubeSubscribers: 42000,
      youtubeEngagementRate: 4.2,
      minRate: 50000,
      maxRate: 5000000,
      minInstagramRate: 30000,
      maxInstagramRate: 2000000,
      minYoutubeRate: 75000,
      maxYoutubeRate: 3500000,
      followerAuthenticityScore: 82,
      contentQualityScore: 78,
    },
  });
  console.log("  + InfluencerProfile upserted (85K IG, 42K YT)");

  // Seed KYC Docs for Influencer
  await seedDoc(influencer.id, "seed-influencer-pan-" + influencer.id, "PAN_CARD", "Influencer PAN");
  await seedDoc(influencer.id, "seed-influencer-aadhaar-" + influencer.id, "AADHAAR", "Influencer Aadhaar");
  await seedDoc(influencer.id, "seed-influencer-selfie-" + influencer.id, "SELFIE", "Influencer Selfie");
  await seedDoc(influencer.id, "seed-influencer-bank-" + influencer.id, "BANK_STATEMENT", "Influencer Bank Statement");

  // Seed Tax and Bank details for Influencer
  await seedTaxCompliance(influencer.id, false);
  await seedBankAccount(influencer.id, "Test Influencer", "ICICI Bank");

  // Seed badges definitions
  await seedBadges();

  console.log("\n Seed complete!");
  console.log("------------------------------------------------------");
  console.log("  Admin:       admin@test.vyaparmedia.in       | Test@1234");
  console.log("  Brand:       brand@test.vyaparmedia.in       | Test@1234");
  console.log("  Influencer:  influencer@test.vyaparmedia.in  | Test@1234");
  console.log("------------------------------------------------------");
  console.log("  Brand wallet: Rs 1,00,000 pre-loaded");
  console.log("  All accounts: KYC FULL, email + phone verified, Tax READY");
  console.log("------------------------------------------------------\n");
}

main()
  .catch((err) => { console.error("Seed failed:", err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
