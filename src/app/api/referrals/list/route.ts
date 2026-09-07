import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import { roundPaise } from "@/lib/utils";
import { paginationSchema } from "@/lib/validations";

async function _handler_GET(req: NextRequest) {
try {
const session = await auth();
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const { searchParams } = new URL(req.url);
const parsedPagination = paginationSchema.safeParse({
page: searchParams.get("page") || undefined,
limit: searchParams.get("limit") || undefined,
});
if (!parsedPagination.success) {
return NextResponse.json({ error: "Invalid pagination parameters" }, { status: 400 });
}
const { page, limit } = parsedPagination.data;
const skip = (page - 1) * limit;

const total = await prisma.user.count({
where: { referredBy: session.user.id },
});

const referrals = await prisma.user.findMany({
where: { referredBy: session.user.id },
select: {
id: true,
email: true,
userType: true,
createdAt: true,
status: true,
verificationLevel: true,
influencerProfile: { select: { displayName: true, completedDeals: true } },
brandProfile: { select: { companyName: true, totalCampaigns: true, totalSpent: true } },
},
orderBy: { createdAt: "desc" },
skip,
take: limit,
});

// Fetch all referral rewards for the user's wallet to compute unattributed earnings and exact referral matching
const referralRewards = await prisma.transaction.findMany({
    take: 200,
where: {
wallet: { userId: session.user.id },
type: "CREDIT",
status: "COMPLETED",
metadata: {
path: ["referralUserId"],
not: Prisma.AnyNull,
},
},
select: { amount: true, metadata: true },
});

const exactEarningsByReferral = new Map<string, number>();
let unattributedEarnings = 0;
for (const reward of referralRewards) {
const metadata = reward.metadata as { referralUserId?: string } | null;
const referralUserId = metadata?.referralUserId;
if (referralUserId) {
exactEarningsByReferral.set(
referralUserId,
(exactEarningsByReferral.get(referralUserId) || 0) + reward.amount,
);
} else {
unattributedEarnings += reward.amount;
}
}

const unattributedShare =
total > 0 ? roundPaise(unattributedEarnings / total) : 0;

const formattedReferrals = referrals.map((ref) => {
let isActive = false;
if (ref.influencerProfile) {
isActive = ref.influencerProfile.completedDeals > 0;
} else if (ref.brandProfile) {
isActive = ref.brandProfile.totalSpent > 0 || ref.brandProfile.totalCampaigns > 0;
}

const emailParts = ref.email.split("@");
const part1 = emailParts[0];
const part2 = emailParts[1];
let maskedEmail = ref.email;
if (part1 && part2) {
if (part1.length <= 2) {
maskedEmail = `${part1}***@${part2}`;
} else {
maskedEmail = `${part1.slice(0, 2)}***@${part2}`;
}
}

return {
id: ref.id,
name:
ref.influencerProfile?.displayName ||
ref.brandProfile?.companyName ||
ref.email.split("@")[0],
email: maskedEmail,
joinedAt: ref.createdAt,
status: isActive ? "ACTIVE" : "PENDING",
verified: ref.verificationLevel !== "NONE",
type: ref.userType,
earnings: (exactEarningsByReferral.get(ref.id) || 0) + unattributedShare,
};
});

return NextResponse.json({
referrals: formattedReferrals,
total,
page,
limit,
});
} catch (error) {
logger.error("Failed to fetch referrals list", error);
return NextResponse.json(
{ error: "Internal Server Error" },
{ status: 500 },
);
}
}


// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET);
