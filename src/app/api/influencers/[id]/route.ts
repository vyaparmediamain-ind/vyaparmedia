import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { apiWrapper, type AuthenticatedRequest } from "@/lib/api-wrapper";
import prisma from "@/lib/db";
import { WalletService } from "@/services/wallet.service";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { isAdmin } from "@/lib/rbac";

export const GET = apiWrapper(async (req, { params }) => {
const session = (req as AuthenticatedRequest).session;
if (isAdmin(session.user.userType)) {
await requireActiveAdmin(session.user);
}

const influencerId = (await params).id as string;
const userId = session.user.id;

const influencer = await prisma.influencerProfile.findUnique({
where: { id: influencerId },
include: { user: { select: { trustScore: true } } },
});

if (!influencer) {
return NextResponse.json(
{ error: "Influencer not found" },
{ status: 404 },
);
}

// Include the viewer's wallet info so the frontend knows if they can afford the minRate
let walletInfo = null;
try {
walletInfo = await WalletService.getWallet(
userId,
1,
1,
);
} catch (error) {
logger.warn("Failed to fetch viewer wallet in influencer profile detail API", { error });
}

return NextResponse.json({
influencer: {
id: influencer.id,
userId: influencer.userId,
displayName: influencer.displayName,
bio: influencer.bio,
avatar: influencer.avatar,
city: influencer.city,
state: influencer.state,
instagramHandle: influencer.instagramHandle,
instagramFollowers: influencer.instagramFollowers,
instagramEngagementRate: influencer.instagramEngagementRate,
youtubeHandle: influencer.youtubeHandle,
youtubeSubscribers: influencer.youtubeSubscribers,
youtubeEngagementRate: influencer.youtubeEngagementRate,
categories: influencer.categories,
languages: influencer.languages,
minRate: influencer.minRate,
maxRate: influencer.maxRate,
trustScore: influencer.user.trustScore,
totalCompletedDeals: influencer.completedDeals,
averageRating: influencer.averageRating,
isFeatured: influencer.isFeatured,
featuredUntil: influencer.featuredUntil,
},
viewerWallet: walletInfo?.wallet
? {
balance: walletInfo.wallet.balance,
availableBalance: walletInfo.wallet.balance, // totalHeld field doesn't exist in Wallet schema
}
: null,
});
}, {
requirePermission: "VIEW_INFLUENCERS",
});
