import { PrismaClient } from "@prisma/client";

/**
 * Direct Prisma client for Playwright E2E backend state assertions.
 * Bypasses server-only restrictions by importing directly from @prisma/client.
 */
export const testPrisma = new PrismaClient({
  log: process.env.DEBUG ? ["query", "error", "warn"] : ["error"],
});

export async function getTestUser(email: string) {
  return testPrisma.user.findUnique({
    where: { email },
    include: {
      influencerProfile: true,
      brandProfile: true,
      scoutProfile: true,
      wallet: true,
    },
  });
}

export async function getCampaignByTitle(title: string) {
  return testPrisma.campaign.findFirst({
    where: { title: { contains: title } },
    include: {
      brand: true,
      applications: true,
      deals: true,
    },
  });
}

export async function getDealById(id: string) {
  return testPrisma.deal.findUnique({
    where: { id },
    include: {
      paymentHold: true,
      disputes: true,
    },
  });
}

export async function getWalletByUserId(userId: string) {
  return testPrisma.wallet.findUnique({
    where: { userId },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });
}

export async function getLatestAuditLog(action: string) {
  return testPrisma.auditLog.findFirst({
    where: { actionType: { contains: action } },
    orderBy: { timestamp: "desc" },
  });
}
