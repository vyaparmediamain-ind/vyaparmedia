import { DEFAULT_SCOUT_ROYALTY_PERCENT } from "@/constants/deals";
import prisma, { ensurePlatformTreasury } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { generateReferralCode } from "@/lib/utils";
import { NotificationService } from "@/services/notification.service";
import { createActivityLog } from "@/lib/audit";

export interface SubmitScoutKycInput {
  fullName: string;
  phone: string;
  city: string;
  state?: string | undefined;
  college?: string | undefined;
  panNumber: string;
  aadhaarNumber: string;
  panDocumentUrl?: string | undefined;
  aadhaarDocumentUrl?: string | undefined;
  selfieUrl?: string | undefined;
}

export interface ScoutDashboardStats {
  isRegistered: boolean;
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED" | "NOT_REGISTERED";
  rejectionReason: string | null;
  scoutCode: string | null;
  scoutProfile: {
    fullName: string;
    city: string;
    college: string | null;
    royaltyPercent: number;
    isRoyaltyPaused: boolean;
    streakMonths: number;
    totalRoyaltyEarnedPaise: number;
    selfieUrl?: string | null;
  } | null;
  monthlyQuota: {
    isMet: boolean;
    reason: string;
    targetCount: number;
    currentMonthNewVerified: number;
    currentMonthDeals: number;
    isExempt: boolean;
    exemptUntil: string | null;
    daysRemaining: number;
  };
  networkStats: {
    totalOnboarded: number;
    verifiedCreators: number;
    pendingCreators: number;
    verifiedBrands: number;
    pendingBrands: number;
  };
  financials: {
    lifetimeRoyaltyPaise: number;
    thisMonthRoyaltyPaise: number;
  };
  shareableLinks: {
    creatorInviteLink: string;
    brandInviteLink: string;
    generalInviteLink: string;
  };
}

export class ScoutService {
  /**
   * Submit or update Scout 18+ KYC details
   */
  static async submitKyc(userId: string, input: SubmitScoutKycInput) {
    // 1. Format and validate PAN (10 chars uppercase alphanumeric)
    const panClean = input.panNumber.trim().toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panClean)) {
      throw AppError.badRequest("Invalid PAN card format (Must be 10 characters e.g. ABCDE1234F)");
    }

    // 2. Format and validate Aadhaar (12 digits)
    const aadhaarClean = input.aadhaarNumber.replaceAll(/\s|-/g, "");
    if (!/^\d{12}$/.test(aadhaarClean)) {
      throw AppError.badRequest("Invalid Aadhaar number format (Must be 12 digits)");
    }

    // 3. Generate memorable Scout code if not existing
    const cleanCity = input.city.trim().toUpperCase().replaceAll(/[^A-Z]/g, "").slice(0, 4) || "SCT";
    const newScoutCode = generateReferralCode(`SC-${cleanCity}`);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, userType: true, scoutProfile: true },
    });

    if (!user) throw AppError.notFound("User not found");

    const scout = await prisma.$transaction(async (tx) => {
      // Update User role to SCOUT if not admin
      if (user.userType !== "ADMIN") {
        await tx.user.update({
          where: { id: userId },
          data: { userType: "SCOUT" },
        });
      }

      // Upsert ScoutProfile
      return tx.scoutProfile.upsert({
        where: { userId },
        create: {
          userId,
          scoutCode: newScoutCode,
          fullName: input.fullName.trim(),
          phone: input.phone.trim(),
          city: input.city.trim(),
          state: input.state?.trim() || null,
          college: input.college?.trim() || null,
          panNumber: panClean,
          aadhaarNumber: `XXXXXXXX${aadhaarClean.slice(-4)}`, // Store masked last 4 digits for privacy
          panDocumentUrl: input.panDocumentUrl || null,
          aadhaarDocumentUrl: input.aadhaarDocumentUrl || null,
          selfieUrl: input.selfieUrl || null,
          verificationStatus: "PENDING",
          rejectionReason: null,
        },
        update: {
          fullName: input.fullName.trim(),
          phone: input.phone.trim(),
          city: input.city.trim(),
          state: input.state?.trim() || null,
          college: input.college?.trim() || null,
          panNumber: panClean,
          aadhaarNumber: `XXXXXXXX${aadhaarClean.slice(-4)}`,
          panDocumentUrl: input.panDocumentUrl ?? null,
          aadhaarDocumentUrl: input.aadhaarDocumentUrl ?? null,
          selfieUrl: input.selfieUrl ?? null,
          verificationStatus: "PENDING",
          rejectionReason: null,
        },
      });
    });

    await createActivityLog({
      userId,
      action: "SCOUT_KYC_SUBMITTED",
      metadata: { scoutId: scout.id, city: input.city, scoutCode: scout.scoutCode },
    });

    logger.info("Scout KYC submitted for verification", { userId, scoutId: scout.id, city: input.city });
    return scout;
  }

  /**
   * Get Scout Dashboard metrics, verification status & monthly active quota
   */
  static async getDashboard(userId: string): Promise<ScoutDashboardStats> {
    const scout = await prisma.scoutProfile.findUnique({
      where: { userId },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vyaparmedia.vercel.app";

    if (!scout) {
      return {
        isRegistered: false,
        verificationStatus: "NOT_REGISTERED",
        rejectionReason: null,
        scoutCode: null,
        scoutProfile: null,
        monthlyQuota: {
          isMet: false,
          reason: "Not registered as Scout",
          targetCount: 1,
          currentMonthNewVerified: 0,
          currentMonthDeals: 0,
          isExempt: false,
          exemptUntil: null,
          daysRemaining: 0,
        },
        networkStats: {
          totalOnboarded: 0,
          verifiedCreators: 0,
          pendingCreators: 0,
          verifiedBrands: 0,
          pendingBrands: 0,
        },
        financials: {
          lifetimeRoyaltyPaise: 0,
          thisMonthRoyaltyPaise: 0,
        },
        shareableLinks: {
          creatorInviteLink: `${baseUrl}/register?role=creator`,
          brandInviteLink: `${baseUrl}/register?role=brand`,
          generalInviteLink: `${baseUrl}/register`,
        },
      };
    }

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const daysRemaining = endOfMonth.getDate() - now.getDate();

    // 1. Fetch all users referred by this Scout
    type DashboardReferredUser = {
      id: string;
      userType: "INFLUENCER" | "BRAND" | "SCOUT" | "ADMIN";
      createdAt: Date;
      status: string;
      influencerProfile?: {
        id: string;
        instagramHandle: string | null;
        completedDeals: number;
      } | null;
      brandProfile?: {
        id: string;
        isGstVerified: boolean;
        isPanVerified: boolean;
        totalSpent: number;
      } | null;
    };

    const rawReferredUsers = await prisma.user.findMany({
      where: { referredBy: userId },
      select: {
        id: true,
        userType: true,
        createdAt: true,
        status: true,
        influencerProfile: {
          select: {
            id: true,
            instagramHandle: true,
            completedDeals: true,
          },
        },
        brandProfile: {
          select: {
            id: true,
            isGstVerified: true,
            isPanVerified: true,
            totalSpent: true,
          },
        },
      },
    });

    const referredUsers = rawReferredUsers as unknown as DashboardReferredUser[];

    let verifiedCreators = 0;
    let pendingCreators = 0;
    let verifiedBrands = 0;
    let pendingBrands = 0;
    let currentMonthNewVerified = 0;

    for (const u of referredUsers) {
      if (u.userType === "INFLUENCER") {
        const isVerified = Boolean(u.status === "ACTIVE" || u.influencerProfile?.instagramHandle);
        if (isVerified) {
          verifiedCreators++;
          if (u.createdAt >= startOfMonth) currentMonthNewVerified++;
        } else {
          pendingCreators++;
        }
      } else if (u.userType === "BRAND") {
        const isVerified = Boolean(u.brandProfile?.isGstVerified || u.brandProfile?.isPanVerified || (u.status === "ACTIVE" && u.brandProfile?.totalSpent && u.brandProfile.totalSpent > 0));
        if (isVerified) {
          verifiedBrands++;
          if (u.createdAt >= startOfMonth) currentMonthNewVerified++;
        } else {
          pendingBrands++;
        }
      }
    }

    // 2. Deals count in network this month
    const referredInfluencerProfileIds = referredUsers.map((u) => u.influencerProfile?.id).filter(Boolean) as string[];
    const referredBrandProfileIds = referredUsers.map((u) => u.brandProfile?.id).filter(Boolean) as string[];

    const currentMonthDeals = await prisma.deal.count({
      where: {
        status: "COMPLETED",
        updatedAt: { gte: startOfMonth, lte: endOfMonth },
        OR: [
          { influencerId: { in: referredInfluencerProfileIds } },
          { brandId: { in: referredBrandProfileIds } },
        ],
      },
    });

    // 3. Check monthly quota status
    const isExempt = Boolean(scout.monthlyQuotaExemptUntil && scout.monthlyQuotaExemptUntil >= now);
    const isQuotaMet = isExempt || currentMonthNewVerified >= 1 || currentMonthDeals >= 1;

    let quotaReason = "Quota active";
    if (isExempt) {
      quotaReason = `Exempt until ${scout.monthlyQuotaExemptUntil?.toLocaleDateString()}`;
    } else if (currentMonthNewVerified >= 1) {
      quotaReason = `Verified 1+ partner this month (${currentMonthNewVerified} added)`;
    } else if (currentMonthDeals >= 1) {
      quotaReason = `Network deal completed this month (${currentMonthDeals} deals)`;
    } else {
      quotaReason = `Target: Add 1 verified creator or brand before month end (${daysRemaining} days left)`;
    }

    // 4. Calculate this month's royalty
    const scoutWallet = await prisma.wallet.findUnique({
      where: { userId },
      select: { id: true },
    });

    let thisMonthRoyaltyPaise = 0;
    if (scoutWallet) {
      const agg = await prisma.transaction.aggregate({
        where: {
          walletId: scoutWallet.id,
          type: "CREDIT",
          status: "COMPLETED",
          createdAt: { gte: startOfMonth, lte: endOfMonth },
          description: { contains: "Scout Royalty", mode: "insensitive" },
        },
        _sum: { amount: true },
      });
      thisMonthRoyaltyPaise = agg._sum.amount || 0;
    }

    const shareableLinks = {
      creatorInviteLink: `${baseUrl}/register?ref=${scout.scoutCode}&role=creator`,
      brandInviteLink: `${baseUrl}/register?ref=${scout.scoutCode}&role=brand`,
      generalInviteLink: `${baseUrl}/register?ref=${scout.scoutCode}`,
    };

    return {
      isRegistered: true,
      verificationStatus: scout.verificationStatus,
      rejectionReason: scout.rejectionReason,
      scoutCode: scout.scoutCode,
      scoutProfile: {
        fullName: scout.fullName,
        city: scout.city,
        college: scout.college,
        royaltyPercent: scout.royaltyPercent,
        isRoyaltyPaused: scout.isRoyaltyPaused,
        streakMonths: scout.streakMonths,
        totalRoyaltyEarnedPaise: scout.totalRoyaltyEarned,
        selfieUrl: scout.selfieUrl || null,
      },
      monthlyQuota: {
        isMet: isQuotaMet,
        reason: quotaReason,
        targetCount: 1,
        currentMonthNewVerified,
        currentMonthDeals,
        isExempt,
        exemptUntil: scout.monthlyQuotaExemptUntil?.toISOString() || null,
        daysRemaining,
      },
      networkStats: {
        totalOnboarded: referredUsers.length,
        verifiedCreators,
        pendingCreators,
        verifiedBrands,
        pendingBrands,
      },
      financials: {
        lifetimeRoyaltyPaise: scout.totalRoyaltyEarned,
        thisMonthRoyaltyPaise,
      },
      shareableLinks,
    };
  }

  /**
   * Get detailed list of referred Creators and Brands with verification state and pre-formatted WhatsApp nudges
   */
  static async getNetworkList(userId: string) {
    type NetworkReferredUser = {
      id: string;
      email: string;
      userType: "INFLUENCER" | "BRAND" | "SCOUT" | "ADMIN";
      createdAt: Date;
      status: string;
      influencerProfile?: {
        id: string;
        displayName: string | null;
        instagramHandle: string | null;
        completedDeals: number;
        totalEarnings: number;
      } | null;
      brandProfile?: {
        id: string;
        companyName: string | null;
        isGstVerified: boolean;
        isPanVerified: boolean;
        totalSpent: number;
        totalCampaigns: number;
      } | null;
    };

    const rawReferred = await prisma.user.findMany({
      where: { referredBy: userId },
      select: {
        id: true,
        email: true,
        userType: true,
        createdAt: true,
        status: true,
        influencerProfile: {
          select: {
            id: true,
            displayName: true,
            instagramHandle: true,
            completedDeals: true,
            totalEarnings: true,
          },
        },
        brandProfile: {
          select: {
            id: true,
            companyName: true,
            isGstVerified: true,
            isPanVerified: true,
            totalSpent: true,
            totalCampaigns: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const referredUsers = rawReferred as unknown as NetworkReferredUser[];

    return referredUsers.map((u) => {
      if (u.userType === "INFLUENCER") {
        const isVerified = Boolean(u.status === "ACTIVE" || u.influencerProfile?.instagramHandle);
        const name = u.influencerProfile?.displayName || (u.influencerProfile?.instagramHandle ? `@${u.influencerProfile.instagramHandle}` : u.email.split("@")[0]);
        const nudgeText = encodeURIComponent(
          `Hi ${name}! Aapka VyaparMedia account create ho gaya hai. Paid deals unlock karne ke liye apna Instagram connect aur KYC verify kar lein: https://vyaparmedia.in/dashboard/settings`
        );

        return {
          id: u.id,
          name,
          handle: u.influencerProfile?.instagramHandle ? `@${u.influencerProfile.instagramHandle}` : null,
          userType: "CREATOR" as const,
          joinedAt: u.createdAt,
          isVerified,
          status: isVerified ? "VERIFIED" : "PENDING_KYC",
          dealsCompleted: u.influencerProfile?.completedDeals || 0,
          totalVolumePaise: u.influencerProfile?.totalEarnings || 0,
          nudgeUrl: `https://wa.me/?text=${nudgeText}`,
        };
      }

      // Brand
      const isVerified = Boolean(u.brandProfile?.isGstVerified || u.brandProfile?.isPanVerified || (u.brandProfile?.totalSpent && u.brandProfile.totalSpent > 0));
      const name = u.brandProfile?.companyName || u.email.split("@")[0];
      const nudgeText = encodeURIComponent(
        `Hi ${name}! VyaparMedia par aapka brand account ready hai. Verified creators se 100% Escrow safe deals run karne ke liye profile verify kar lein: https://vyaparmedia.in/dashboard/settings`
      );

      return {
        id: u.id,
        name,
        handle: null,
        userType: "BRAND" as const,
        joinedAt: u.createdAt,
        isVerified,
        status: isVerified ? "VERIFIED" : "PENDING_KYC",
        dealsCompleted: u.brandProfile?.totalCampaigns || 0,
        totalVolumePaise: u.brandProfile?.totalSpent || 0,
        nudgeUrl: `https://wa.me/?text=${nudgeText}`,
      };
    });
  }

  /**
   * Process 1% (or custom %) Scout Royalty for a completed deal
   * Executed atomically within deal completion transaction
   */
  static async processDealRoyalty(
    tx: Prisma.TransactionClient,
    dealId: string,
    dealAmountPaise: number,
    influencerUserId: string,
    brandUserId: string,
  ): Promise<{ creditedScoutsCount: number }> {
    // 1. Find referrers of influencer and brand
    const [influencerUser, brandUser] = await Promise.all([
      tx.user.findUnique({
        where: { id: influencerUserId },
        select: { referredBy: true, influencerProfile: { select: { displayName: true } } },
      }),
      tx.user.findUnique({
        where: { id: brandUserId },
        select: { referredBy: true, brandProfile: { select: { companyName: true } } },
      }),
    ]);

    const potentialScoutIds = Array.from(new Set([influencerUser?.referredBy, brandUser?.referredBy])).filter(Boolean) as string[];
    if (potentialScoutIds.length === 0) return { creditedScoutsCount: 0 };

    // 2. Fetch approved scouts who have royalty active
    const scouts = await tx.scoutProfile.findMany({
      where: {
        userId: { in: potentialScoutIds },
        verificationStatus: "APPROVED",
        isRoyaltyPaused: false,
      },
    });

    if (scouts.length === 0) return { creditedScoutsCount: 0 };

    let creditedCount = 0;
    const treasury = await ensurePlatformTreasury(tx);

    for (const scout of scouts) {
      // Calculate royalty
      const royaltyPercent = scout.royaltyPercent || DEFAULT_SCOUT_ROYALTY_PERCENT;
      const royaltyPaise = Math.max(1, Math.round((dealAmountPaise * royaltyPercent) / 100));

      // Idempotency: check if already credited
      const existing = await tx.transaction.findFirst({
        where: {
          dealId,
          type: "CREDIT",
          description: { contains: `Scout Royalty for ${scout.userId}` },
        },
        select: { id: true },
      });
      if (existing) continue;

      // Double-entry: Debit treasury
      const treasuryDebit = await tx.wallet.updateMany({
        where: {
          id: treasury.id,
          balance: { gte: royaltyPaise },
          isFrozen: false,
        },
        data: { balance: { decrement: royaltyPaise } },
      });

      if (treasuryDebit.count === 0) {
        logger.error("Treasury underfunded for scout royalty", { scoutUserId: scout.userId, dealId, royaltyPaise });
        continue;
      }

      await tx.transaction.create({
        data: {
          walletId: treasury.id,
          dealId,
          type: "DEBIT",
          amount: royaltyPaise,
          status: "COMPLETED",
          description: `Treasury Debit: ${royaltyPercent}% Scout Royalty to ${scout.scoutCode} for Deal ${dealId}`,
          metadata: { scoutUserId: scout.userId, dealId },
        },
      });

      // Credit Scout Wallet
      const scoutWallet = await tx.wallet.upsert({
        where: { userId: scout.userId },
        create: { userId: scout.userId, balance: royaltyPaise, totalEarned: royaltyPaise },
        update: {
          balance: { increment: royaltyPaise },
          totalEarned: { increment: royaltyPaise },
        },
      });

      await tx.transaction.create({
        data: {
          walletId: scoutWallet.id,
          dealId,
          type: "CREDIT",
          amount: royaltyPaise,
          status: "COMPLETED",
          description: `${royaltyPercent}% Scout Royalty for ${scout.userId} on Deal #${dealId}`,
          metadata: { scoutRoyalty: true, dealId, dealAmountPaise, royaltyPercent },
        },
      });

      // Update ScoutProfile total earnings
      await tx.scoutProfile.update({
        where: { id: scout.id },
        data: {
          totalRoyaltyEarned: { increment: royaltyPaise },
          lastActiveMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
        },
      });

      // Notify Scout
      await NotificationService.createNotification(
        {
          userId: scout.userId,
          type: "wallet_credit",
          title: "🎉 Scout Passive Royalty Received!",
          message: `You earned ₹${(royaltyPaise / 100).toFixed(2)} (${royaltyPercent}% royalty) on a completed deal in your network!`,
        },
        tx
      );

      creditedCount++;
      logger.info("Credited Scout Royalty", { scoutId: scout.id, dealId, royaltyPaise });
    }

    return { creditedScoutsCount: creditedCount };
  }

  /**
   * Admin Actions
   */
  static async adminListScouts(options?: {
    status?: "PENDING" | "APPROVED" | "REJECTED" | "ALL" | undefined;
    city?: string | undefined;
    search?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  }) {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(1, options?.limit || 20));

    const where: Prisma.ScoutProfileWhereInput = {
      ...(options?.status && options.status !== "ALL" ? { verificationStatus: options.status } : {}),
      ...(options?.city ? { city: { contains: options.city, mode: "insensitive" } } : {}),
      ...(options?.search
        ? {
            OR: [
              { fullName: { contains: options.search, mode: "insensitive" } },
              { scoutCode: { contains: options.search, mode: "insensitive" } },
              { phone: { contains: options.search } },
              { panNumber: { contains: options.search, mode: "insensitive" } },
              { user: { email: { contains: options.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [scouts, total] = await Promise.all([
      prisma.scoutProfile.findMany({
        where,
        include: {
          user: {
            select: {
              email: true,
              createdAt: true,
              _count: { select: { referredUsers: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.scoutProfile.count({ where }),
    ]);

    return {
      scouts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async adminApproveScout(scoutId: string, adminUserId: string) {
    const scout = await prisma.scoutProfile.update({
      where: { id: scoutId },
      data: {
        verificationStatus: "APPROVED",
        verifiedAt: new Date(),
        rejectionReason: null,
      },
    });

    await NotificationService.createNotification({
      userId: scout.userId,
      type: "system",
      title: "✅ Scout Identity Verified!",
      message: "Congratulations! Your 18+ Scout Profile has been approved. Your 1% lifetime passive royalty is now active.",
    });

    await createActivityLog({
      userId: adminUserId,
      action: "ADMIN_APPROVED_SCOUT",
      metadata: { scoutId, scoutUserId: scout.userId },
    });

    return scout;
  }

  static async adminRejectScout(scoutId: string, reason: string, adminUserId: string) {
    const scout = await prisma.scoutProfile.update({
      where: { id: scoutId },
      data: {
        verificationStatus: "REJECTED",
        rejectionReason: reason,
      },
    });

    await NotificationService.createNotification({
      userId: scout.userId,
      type: "system",
      title: "⚠️ Scout Verification Required Revision",
      message: `Your Scout verification could not be approved: ${reason}. Please update your details.`,
    });

    await createActivityLog({
      userId: adminUserId,
      action: "ADMIN_REJECTED_SCOUT",
      metadata: { scoutId, reason },
    });

    return scout;
  }

  static async adminToggleRoyaltyPause(scoutId: string, pause: boolean, reason?: string, adminUserId?: string) {
    const scout = await prisma.scoutProfile.update({
      where: { id: scoutId },
      data: {
        isRoyaltyPaused: pause,
        royaltyPausedReason: pause ? reason || "Paused by administrator" : null,
      },
    });

    if (adminUserId) {
      await createActivityLog({
        userId: adminUserId,
        action: pause ? "ADMIN_PAUSED_SCOUT_ROYALTY" : "ADMIN_RESUMED_SCOUT_ROYALTY",
        metadata: { scoutId, reason },
      });
    }

    return scout;
  }

  static async adminGrantQuotaExemption(scoutId: string, days: number, adminUserId: string) {
    const exemptUntil = new Date();
    exemptUntil.setDate(exemptUntil.getDate() + days);

    const scout = await prisma.scoutProfile.update({
      where: { id: scoutId },
      data: { monthlyQuotaExemptUntil: exemptUntil },
    });

    await createActivityLog({
      userId: adminUserId,
      action: "ADMIN_GRANTED_SCOUT_QUOTA_EXEMPTION",
      metadata: { scoutId, days, exemptUntil },
    });

    return scout;
  }

  static async adminUpdateRoyaltyPercent(scoutId: string, royaltyPercent: number, adminUserId: string) {
    if (royaltyPercent < 0.1 || royaltyPercent > 5.0) {
      throw AppError.badRequest("Royalty percent must be between 0.1% and 5.0%");
    }

    const scout = await prisma.scoutProfile.update({
      where: { id: scoutId },
      data: { royaltyPercent },
    });

    await createActivityLog({
      userId: adminUserId,
      action: "ADMIN_UPDATED_SCOUT_ROYALTY_PERCENT",
      metadata: { scoutId, royaltyPercent },
    });

    return scout;
  }
}
