import { AppError } from "@/lib/errors";
import prisma from "@/lib/db";

export class BlockService {
/**
* Block a user
*/
static async blockUser(blockingUserId: string, blockedUserId: string) {
if (blockingUserId === blockedUserId) {
throw AppError.badRequest("You cannot block yourself");
}

const targetUser = await prisma.user.findUnique({
where: { id: blockedUserId },
});
if (!targetUser) {
throw AppError.notFound("User to block not found");
}

const existingBlock = await prisma.userBlock.findUnique({
where: {
blockingUserId_blockedUserId: {
blockingUserId,
blockedUserId,
},
},
});

if (existingBlock) {
return existingBlock;
}

return await prisma.userBlock.create({
data: {
blockingUserId,
blockedUserId,
},
});
}

/**
* Unblock a user
*/
static async unblockUser(blockingUserId: string, blockedUserId: string) {
const existingBlock = await prisma.userBlock.findUnique({
where: {
blockingUserId_blockedUserId: {
blockingUserId,
blockedUserId,
},
},
});

if (!existingBlock) {
throw AppError.badRequest("You have not blocked this user");
}

await prisma.userBlock.delete({
where: {
blockingUserId_blockedUserId: {
blockingUserId,
blockedUserId,
},
},
});

return { success: true };
}

/**
* Check if there's any block relationship between two users
*/
static async isBlocked(userA: string, userB: string): Promise<boolean> {
const blockCount = await prisma.userBlock.count({
where: {
OR: [
{ blockingUserId: userA, blockedUserId: userB },
{ blockingUserId: userB, blockedUserId: userA },
],
},
});
return blockCount > 0;
}

/**
* List blocked users by a user
*/
static async listBlockedUsers(userId: string) {
return await prisma.userBlock.findMany({
where: { blockingUserId: userId },
include: {
blockedUser: {
select: {
id: true,
userType: true,
influencerProfile: { select: { displayName: true, avatar: true } },
brandProfile: { select: { companyName: true, logo: true } },
},
},
},
orderBy: { createdAt: "desc" },
});
}

/**
* Report a user
*/
static async reportUser(
reporterId: string,
reportedId: string,
reason: string,
description?: string,
) {
if (reporterId === reportedId) {
throw AppError.badRequest("You cannot report yourself");
}

const targetUser = await prisma.user.findUnique({
where: { id: reportedId },
});
if (!targetUser) {
throw AppError.notFound("User to report not found");
}

if (!reason || reason.trim().length < 3) {
throw AppError.badRequest("Report reason must be at least 3 characters long");
}

return await prisma.userReport.create({
data: {
reporterId,
reportedId,
reason: reason.trim(),
description: description?.trim() || null,
},
});
}
}
