import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { apiWrapper, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { createActivityLog } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { AppError } from "@/lib/errors";
import { deleteFile } from "@/lib/storage";

function getStorageKeyFromUrl(url: string): string | null {
  if (!url) return null;
  const folders = ["verification", "content", "avatars", "logos", "posts"];
  for (const folder of folders) {
    const index = url.indexOf(`/${folder}/`);
    if (index !== -1) {
      return url.substring(index + 1);
    }
    const localPrefix = `uploads/${folder}/`;
    const localIndex = url.indexOf(localPrefix);
    if (localIndex !== -1) {
      return url.substring(localIndex);
    }
    if (url.startsWith(`${folder}/`)) {
      return url;
    }
  }
  return null;
}

const deleteSchema = z.object({
  password: z.string().min(1, "Password required for account deletion"),
  reason: z.string().optional(),
});

async function validateDeletionEligibility(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const activeDeals = await tx.deal.count({
    where: {
      OR: [
        { influencer: { userId } },
        { brand: { userId } },
      ],
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
  });

  if (activeDeals > 0) {
    throw new AppError("Cannot delete account with active or disputed deals. Please complete, cancel, or resolve all deals first.", 409);
  }

  const wallet = await tx.wallet.findUnique({
    where: { userId },
    select: { balance: true, pendingBalance: true, debt: true },
  });

  if (wallet) {
    if (wallet.balance > 0) {
      throw new AppError(`Cannot delete account with a wallet balance of \u20b9${(wallet.balance / 100).toFixed(2)}. Please withdraw your funds first.`, 409);
    }
    if (wallet.pendingBalance > 0) {
      throw new AppError("Cannot delete account with pending funds. Please wait for all pending transactions to settle.", 409);
    }
    if ((wallet.debt ?? 0) > 0) {
      throw new AppError(`Cannot delete account with an outstanding debt of \u20b9${((wallet.debt ?? 0) / 100).toFixed(2)}. Please clear your debt first.`, 409);
    }
  }
}

async function collectFileUrlsToDelete(tx: Prisma.TransactionClient, userId: string): Promise<string[]> {
  const fileUrlsToDelete: string[] = [];

  const influencer = await tx.influencerProfile.findUnique({
    where: { userId },
    select: { avatar: true },
  });
  if (influencer?.avatar) {
    fileUrlsToDelete.push(influencer.avatar);
  }

  const brand = await tx.brandProfile.findUnique({
    where: { userId },
    select: { logo: true },
  });
  if (brand?.logo) {
    fileUrlsToDelete.push(brand.logo);
  }

  const verificationDocs = await tx.verificationDocument.findMany({
    where: { userId },
    select: { documentUrl: true },
  });
  for (const doc of verificationDocs) {
    fileUrlsToDelete.push(doc.documentUrl);
  }

  const sentMessagesWithFiles = await tx.message.findMany({
    where: { senderId: userId, fileUrl: { not: null } },
    select: { fileUrl: true },
  });
  for (const msg of sentMessagesWithFiles) {
    if (msg.fileUrl) {
      fileUrlsToDelete.push(msg.fileUrl);
    }
  }

  return fileUrlsToDelete;
}

async function anonymizeUserData(tx: Prisma.TransactionClient, userId: string, anonymizedEmail: string): Promise<void> {
  await tx.user.update({
    where: { id: userId },
    data: {
      email: anonymizedEmail,
      phone: null,
      passwordHash: `del:${randomBytes(32).toString("hex")}`,
      status: "DELETED",
      isTwoFactorEnabled: false,
      twoFactorSecret: null,
      emailVerified: false,
    },
  });

  await tx.influencerProfile.updateMany({
    where: { userId },
    data: {
      displayName: "Deleted User",
      bio: null,
      avatar: null,
      instagramHandle: null,
      youtubeHandle: null,
      city: null,
      state: null,
    },
  });

  await tx.brandProfile.updateMany({
    where: { userId },
    data: {
      companyName: "Deleted Brand",
      logo: null,
      description: null,
      website: null,
    },
  });

  await tx.oAuthState.deleteMany({ where: { userId } });
  await tx.otpToken.deleteMany({ where: { userId } });
  await tx.userBadge.deleteMany({ where: { userId } });
  await tx.notification.deleteMany({ where: { userId } });
  await tx.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });
  await tx.deviceFingerprint.deleteMany({ where: { userId } });
  await tx.oAuthAccount.deleteMany({ where: { userId } });
  await tx.bankAccount.deleteMany({ where: { userId } });
  await tx.verificationDocument.deleteMany({ where: { userId } });
  await tx.userChallengeProgress.deleteMany({ where: { userId } });

  await tx.message.updateMany({
    where: { senderId: userId },
    data: {
      content: "[deleted]",
      fileUrl: null,
    },
  });

  await tx.review.updateMany({
    where: { reviewerId: userId },
    data: {
      comment: "[deleted]",
    },
  });

  await tx.userBlock.deleteMany({
    where: {
      OR: [
        { blockingUserId: userId },
        { blockedUserId: userId },
      ],
    },
  });

  await tx.userReport.deleteMany({
    where: {
      OR: [
        { reporterId: userId },
        { reportedId: userId },
      ],
    },
  });
}

async function deletePhysicalFiles(fileUrls: string[]): Promise<void> {
  for (const url of fileUrls) {
    const key = getStorageKeyFromUrl(url);
    if (!key) continue;
    try {
      const delRes = await deleteFile(key);
      if (!delRes.success) {
        logger.warn("Failed to delete user PII file from storage", { url, key, error: delRes.error });
      }
    } catch (err) {
      logger.error("Error deleting user PII file from storage", err, { url, key });
    }
  }
}

export const POST = apiWrapper(async (req) => {
  const session = (req as AuthenticatedRequest).session;
  const userId = session.user.id;
  const parsed = req.validBody as z.infer<typeof deleteSchema>;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, email: true },
  });

  if (!user?.passwordHash) {
    return NextResponse.json({ error: "Cannot verify identity" }, { status: 400 });
  }

  const passwordValid = await bcrypt.compare(parsed.password, user.passwordHash);
  if (!passwordValid) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 403 });
  }

  try {
    const anonymizedEmail = `deleted_${userId}@anonymized.local`;
    let fileUrlsToDelete: string[] = [];

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await validateDeletionEligibility(tx, userId);
      fileUrlsToDelete = await collectFileUrlsToDelete(tx, userId);
      await anonymizeUserData(tx, userId, anonymizedEmail);

      await createActivityLog({
        userId,
        action: "ACCOUNT_DELETION",
        entityType: "User",
        entityId: userId,
        metadata: {
          reason: parsed.reason || "User requested",
          originalEmail: user.email,
          deletedAt: new Date().toISOString(),
        },
      }, tx);
    });

    await deletePhysicalFiles(fileUrlsToDelete);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }
    const errStatus = (error as { statusCode?: number })?.statusCode;
    if (errStatus && errStatus >= 400 && errStatus < 500) {
      const message = (error as { message?: string })?.message || "Account deletion could not be completed. Please try again.";
      return NextResponse.json({ success: false, message }, { status: errStatus });
    }
    throw error;
  }

  logger.info("Account deleted (anonymized)", { userId });

  return NextResponse.json({
    success: true,
    message: "Account deleted. All personal data has been anonymized.",
  });
}, {
  requireAuth: true,
  userRateLimit: {
    bucket: "AUTH",
    errorMessage: "Too many sensitive account requests",
  },
  validate: {
    body: deleteSchema,
  },
});
