import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiWrapper } from "@/lib/api-wrapper";
import prisma from "@/lib/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { calculateTotalAmount } from "@/lib/razorpay";
import { NotificationService } from "@/services/notification.service";
import { createActivityLog } from "@/lib/audit";
import { assertAccountCanTransact } from "@/lib/utils";

const updateMessageSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED"]),
});

type MessageWithProfiles = Prisma.MessageGetPayload<{
  include: {
    sender: {
      include: {
        brandProfile: true;
        influencerProfile: true;
      };
    };
    receiver: {
      include: {
        brandProfile: true;
        influencerProfile: true;
      };
    };
  };
}>;

interface OfferParticipants {
  brandProfile: NonNullable<MessageWithProfiles["sender"]["brandProfile"]>;
  influencerProfile: NonNullable<MessageWithProfiles["sender"]["influencerProfile"]>;
  brandUserId: string;
  influencerUserId: string;
}

interface OfferDeadlines {
  contentDeadline: Date;
  postingDeadline: Date;
}

function resolveDeadlines(currentMetadata: Prisma.JsonObject): OfferDeadlines {
  const now = new Date();
  const rawContentDeadline = currentMetadata.contentDeadline
    ? new Date(String(currentMetadata.contentDeadline))
    : null;
  const rawPostingDeadline = currentMetadata.postingDeadline
    ? new Date(String(currentMetadata.postingDeadline))
    : null;

  const isContentValid =
    rawContentDeadline !== null &&
    !Number.isNaN(rawContentDeadline.getTime()) &&
    rawContentDeadline > now;

  const contentDeadline = isContentValid
    ? rawContentDeadline
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const isPostingValid =
    rawPostingDeadline !== null &&
    !Number.isNaN(rawPostingDeadline.getTime()) &&
    rawPostingDeadline > contentDeadline;

  const postingDeadline = isPostingValid
    ? rawPostingDeadline
    : new Date(contentDeadline.getTime() + 7 * 24 * 60 * 60 * 1000);

  return { contentDeadline, postingDeadline };
}

function extractDirectParticipants(message: MessageWithProfiles) {
  const brandProfile = message.sender.brandProfile || message.receiver.brandProfile;
  const influencerProfile =
    message.sender.influencerProfile || message.receiver.influencerProfile;

  let brandUserId: string | null = null;
  if (message.sender.brandProfile) {
    brandUserId = message.senderId;
  } else if (message.receiver.brandProfile) {
    brandUserId = message.receiverId;
  }

  let influencerUserId: string | null = null;
  if (message.sender.influencerProfile) {
    influencerUserId = message.senderId;
  } else if (message.receiver.influencerProfile) {
    influencerUserId = message.receiverId;
  }

  return { brandProfile, influencerProfile, brandUserId, influencerUserId };
}

async function resolveOfferParticipants(
  message: MessageWithProfiles
): Promise<OfferParticipants | null> {
  const direct = extractDirectParticipants(message);
  let { brandProfile, influencerProfile, brandUserId, influencerUserId } = direct;

  if (!brandProfile || !influencerProfile || !brandUserId || !influencerUserId) {
    let brandUser = null;
    if (message.sender.userType === "BRAND") {
      brandUser = message.sender;
    } else if (message.receiver.userType === "BRAND") {
      brandUser = message.receiver;
    }

    let influencerUser = null;
    if (message.sender.userType === "INFLUENCER") {
      influencerUser = message.sender;
    } else if (message.receiver.userType === "INFLUENCER") {
      influencerUser = message.receiver;
    }

    if (brandUser && influencerUser) {
      brandUserId = brandUser.id;
      influencerUserId = influencerUser.id;
      brandProfile =
        brandUser.brandProfile ||
        (await prisma.brandProfile.findUnique({ where: { userId: brandUser.id } }));
      influencerProfile =
        influencerUser.influencerProfile ||
        (await prisma.influencerProfile.findUnique({ where: { userId: influencerUser.id } }));
    }
  }

  if (!brandProfile || !influencerProfile || !brandUserId || !influencerUserId) {
    return null;
  }

  return { brandProfile, influencerProfile, brandUserId, influencerUserId };
}

async function handleDeclinedOffer(
  message: MessageWithProfiles,
  currentMetadata: Prisma.JsonObject,
  sessionUserId: string
) {
  const updatedMetadata: Prisma.JsonObject = {
    ...currentMetadata,
    status: "DECLINED",
    declinedAt: new Date().toISOString(),
    declinedByUserId: sessionUserId,
  };

  const updatedMessage = await prisma.message.update({
    where: { id: message.id },
    data: { metadata: updatedMetadata },
  });

  await NotificationService.createNotification({
    userId: message.senderId,
    title: "Proposal Declined",
    message: `Your custom offer "${String(currentMetadata.title || "Custom Deal")}" was declined.`,
    type: "MESSAGE",
  });

  return NextResponse.json({
    success: true,
    message: updatedMessage,
  });
}

interface EscrowTxParams {
  brandUserId: string;
  brandProfileId: string;
  influencerProfileId: string;
  offerAmount: number;
  totalAmountToLock: number;
  paymentAmounts: ReturnType<typeof calculateTotalAmount>;
  offerTitle: string;
  offerDescription: string;
  offerDeliverables: string;
  contentDeadline: Date;
  postingDeadline: Date;
  messageId: string;
  currentMetadata: Prisma.JsonObject;
  sessionUserId: string;
}

async function executeOfferEscrowTransaction(params: EscrowTxParams) {
  return prisma.$transaction(
    async (tx) => {
      // 1. Row-level write lock on the Message to prevent concurrent double-acceptance
      await tx.$queryRaw`SELECT id FROM "Message" WHERE id = ${params.messageId} FOR UPDATE`;

      const freshMessage = await tx.message.findUnique({
        where: { id: params.messageId },
        select: { metadata: true, messageType: true, dealId: true },
      });

      if (!freshMessage || freshMessage.messageType !== "OFFER") {
        throw new Error("Offer message not found or invalid type");
      }

      const freshMeta = (freshMessage.metadata as Prisma.JsonObject) || {};
      if (freshMeta.status === "ACCEPTED" || freshMeta.status === "DECLINED" || freshMessage.dealId) {
        throw new Error(
          `Offer has already been ${String(freshMeta.status || "processed").toLowerCase()}`
        );
      }

      // 2. Row-level write lock on the Brand Wallet
      await tx.$queryRaw`SELECT id FROM "Wallet" WHERE "userId" = ${params.brandUserId} FOR UPDATE`;

      const brandWallet = await tx.wallet.findUnique({
        where: { userId: params.brandUserId },
      });

      if (!brandWallet || brandWallet.balance < params.totalAmountToLock) {
        const availableInr = brandWallet ? (brandWallet.balance / 100).toLocaleString("en-IN") : "0";
        const requiredInr = (params.totalAmountToLock / 100).toLocaleString("en-IN");
        throw new Error(
          `Insufficient brand wallet balance (Available: ₹${availableInr}, Required: ₹${requiredInr}). Please top up your wallet to accept this offer.`
        );
      }

      await tx.wallet.update({
        where: { id: brandWallet.id },
        data: {
          balance: { decrement: params.totalAmountToLock },
          pendingBalance: { increment: params.totalAmountToLock },
          totalSpent: { increment: params.totalAmountToLock },
        },
      });

      const campaign = await tx.campaign.create({
        data: {
          brandId: params.brandProfileId,
          title: params.offerTitle,
          description: params.offerDescription,
          requirements: params.offerDeliverables,
          deliverables: [
            {
              type: "CUSTOM",
              count: 1,
              specs: params.offerDeliverables,
            },
          ],
          totalBudget: params.offerAmount,
          perInfluencerBudget: params.offerAmount,
          fundedAmount: params.totalAmountToLock,
          reservedAmount: params.totalAmountToLock,
          reservedTotalAmount: params.totalAmountToLock,
          contentDeadline: params.contentDeadline,
          postingDeadline: params.postingDeadline,
          status: "ACTIVE",
          isDirectInvite: true,
          selectedInfluencers: 1,
          maxInfluencers: 1,
        },
      });

      const deal = await tx.deal.create({
        data: {
          campaignId: campaign.id,
          influencerId: params.influencerProfileId,
          brandId: params.brandProfileId,
          amount: params.offerAmount,
          platformFee: params.paymentAmounts.platformFee,
          gatewayFee: params.paymentAmounts.gatewayFee,
          totalAmount: params.totalAmountToLock,
          influencerPayout: params.paymentAmounts.influencerReceives,
          reservedFromWallet: true,
          status: "ACTIVE",
          submissionDeadline: params.contentDeadline,
          postingDeadline: params.postingDeadline,
          startedAt: new Date(),
          contractTerms: {
            title: params.offerTitle,
            scope: params.offerDescription,
            deliverables: params.offerDeliverables,
            dealAmount: params.offerAmount,
            platformFee: params.paymentAmounts.platformFee,
            gatewayFee: params.paymentAmounts.gatewayFee,
            totalAmount: params.totalAmountToLock,
            influencerPayout: params.paymentAmounts.influencerReceives,
            source: "in_chat_offer",
          } as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.deal.update({
        where: { id: deal.id },
        data: {
          contractTerms: {
            dealId: deal.id,
            title: params.offerTitle,
            scope: params.offerDescription,
            deliverables: params.offerDeliverables,
            dealAmount: params.offerAmount,
            platformFee: params.paymentAmounts.platformFee,
            gatewayFee: params.paymentAmounts.gatewayFee,
            totalAmount: params.totalAmountToLock,
            influencerPayout: params.paymentAmounts.influencerReceives,
            source: "in_chat_offer",
          } as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.transaction.create({
        data: {
          walletId: brandWallet.id,
          dealId: deal.id,
          type: "DEBIT",
          amount: params.totalAmountToLock,
          status: "COMPLETED",
          description: `Escrow hold for in-chat deal: ${params.offerTitle}`,
          metadata: {
            source: "in_chat_offer_acceptance",
            dealId: deal.id,
            dealAmount: params.offerAmount,
            platformFee: params.paymentAmounts.platformFee,
            gatewayFee: params.paymentAmounts.gatewayFee,
          },
        },
      });

      const updatedMetadata: Prisma.JsonObject = {
        ...params.currentMetadata,
        status: "ACCEPTED",
        dealId: deal.id,
        acceptedAt: new Date().toISOString(),
        acceptedByUserId: params.sessionUserId,
      };

      const updatedMessage = await tx.message.update({
        where: { id: params.messageId },
        data: {
          dealId: deal.id,
          metadata: updatedMetadata,
        },
      });

      await tx.brandProfile.update({
        where: { id: params.brandProfileId },
        data: {
          totalCampaigns: { increment: 1 },
          activeCampaigns: { increment: 1 },
          totalSpent: { increment: params.totalAmountToLock },
        },
      });

      await tx.influencerProfile.update({
        where: { id: params.influencerProfileId },
        data: {
          totalDeals: { increment: 1 },
        },
      });

      return { deal, message: updatedMessage };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
}

export const PATCH = apiWrapper(async (req, { params }) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messageId = (await params).id as string;
  if (!messageId) {
    return NextResponse.json({ error: "Message ID is required" }, { status: 400 });
  }

  const body = await req.json();
  const { status } = updateMessageSchema.parse(body);

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      sender: {
        include: {
          brandProfile: true,
          influencerProfile: true,
        },
      },
      receiver: {
        include: {
          brandProfile: true,
          influencerProfile: true,
        },
      },
    },
  });

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  if (message.receiverId !== session.user.id) {
    return NextResponse.json(
      { error: "Only the offer receiver can accept or decline it" },
      { status: 403 }
    );
  }

  assertAccountCanTransact(message.sender.status);
  assertAccountCanTransact(message.receiver.status);

  if (message.messageType !== "OFFER") {
    return NextResponse.json({ error: "Only offers can be updated" }, { status: 400 });
  }

  const currentMetadata = (message.metadata as Prisma.JsonObject) || {};
  if (currentMetadata.status === "ACCEPTED" || currentMetadata.status === "DECLINED") {
    return NextResponse.json(
      { error: `Offer has already been ${(currentMetadata.status as string).toLowerCase()}` },
      { status: 400 }
    );
  }

  if (status === "DECLINED") {
    return handleDeclinedOffer(message, currentMetadata, session.user.id);
  }

  const offerAmount = Number(currentMetadata.amount || 0);
  if (offerAmount <= 0) {
    return NextResponse.json(
      { error: "Invalid offer amount. Offer cannot be accepted." },
      { status: 400 }
    );
  }

  const offerTitle = String(currentMetadata.title || "Direct Collaboration Offer");
  const offerDescription = String(
    currentMetadata.description || "Custom deal agreement created from chat."
  );
  const offerDeliverables = String(
    currentMetadata.deliverables || "Deliverables as agreed in conversation."
  );

  const { contentDeadline, postingDeadline } = resolveDeadlines(currentMetadata);
  const participants = await resolveOfferParticipants(message);

  if (!participants) {
    return NextResponse.json(
      {
        error:
          "Both a registered Brand profile and Influencer profile are required to form an escrow deal.",
      },
      { status: 400 }
    );
  }

  const paymentAmounts = calculateTotalAmount(offerAmount);
  const totalAmountToLock = paymentAmounts.totalAmount;

  try {
    const result = await executeOfferEscrowTransaction({
      brandUserId: participants.brandUserId,
      brandProfileId: participants.brandProfile.id,
      influencerProfileId: participants.influencerProfile.id,
      offerAmount,
      totalAmountToLock,
      paymentAmounts,
      offerTitle,
      offerDescription,
      offerDeliverables,
      contentDeadline,
      postingDeadline,
      messageId,
      currentMetadata,
      sessionUserId: session.user.id,
    });

    await NotificationService.createNotifications([
      {
        userId: message.senderId,
        title: "🎉 Custom Offer Accepted!",
        message: `Your custom offer "${offerTitle}" (₹${(offerAmount / 100).toLocaleString(
          "en-IN"
        )}) has been accepted! Deal #${result.deal.id.slice(-6)} is now active.`,
        type: "DEAL_UPDATE",
        data: { dealId: result.deal.id },
      },
      {
        userId: message.receiverId,
        title: "🤝 Deal Activated!",
        message: `You accepted "${offerTitle}". Escrow funds of ₹${(
          totalAmountToLock / 100
        ).toLocaleString("en-IN")} are locked securely.`,
        type: "DEAL_UPDATE",
        data: { dealId: result.deal.id },
      },
    ]);

    await createActivityLog({
      userId: session.user.id,
      action: "IN_CHAT_OFFER_ACCEPTED",
      entityType: "Deal",
      entityId: result.deal.id,
      metadata: {
        messageId,
        amount: offerAmount,
        totalAmount: totalAmountToLock,
        title: offerTitle,
      },
    });

    return NextResponse.json({
      success: true,
      dealId: result.deal.id,
      message: result.message,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to accept offer and create deal";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
});
