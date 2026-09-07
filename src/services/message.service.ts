import { AppError } from "@/lib/errors";
import prisma from "@/lib/db";
import { Message, Prisma, DealStatus } from "@prisma/client";
import { checkMessageForContacts, checkAttachmentForContacts } from "@/lib/contact-filter";
import { ACTIVE_DEAL_STATUSES } from "@/lib/utils";
import { redis } from "@/lib/redis";
import { checkRateLimit } from "@/lib/rate-limit";
import { stripHtml } from "@/lib/sanitize";
import { NotificationService } from "@/services/notification.service";
import { BlockService } from "./block.service";
import { logger } from "@/lib/logger";
import { isAdmin } from "@/lib/rbac";

const TYPING_TTL_SECONDS = 7;
const TYPING_REFRESH_SECONDS = 4;

const SENDER_SELECT_PROJECTION = {
id: true,
email: true,
userType: true,
influencerProfile: {
select: { displayName: true, avatar: true },
},
brandProfile: { select: { companyName: true, logo: true } },
};

type ConversationAccess = {
isAdmin: boolean;
participantIds: string[];
conversationKey: string;
};

function conversationKeyForDirect(userA: string, userB: string) {
return `direct:${[userA, userB].sort((a, b) => a.localeCompare(b)).join(":")}`;
}

function typingKey(conversationKey: string, userId: string) {
return `typing:${conversationKey}:${userId}`;
}

function redactMessage(message: Message & { sender?: unknown }, isAdmin: boolean) {
return {
...message,
content:
message.isBlocked && !isAdmin
? "[MESSAGE REDACTED: SENSITIVE CONTACT INFO]"
: message.content,
fileUrl: message.isBlocked && !isAdmin ? null : message.fileUrl,
};
}

async function getUserRole(userId: string) {
const user = await prisma.user.findUnique({
where: { id: userId },
select: { userType: true },
});
return { isAdmin: isAdmin(user?.userType) };
}

async function getConversationAccess(
userId: string,
params: { dealId?: string; with?: string },
): Promise<ConversationAccess> {
const { isAdmin } = await getUserRole(userId);

if (params.dealId) {
const deal = await prisma.deal.findUnique({
where: { id: params.dealId },
include: {
influencer: { select: { userId: true } },
brand: { select: { userId: true } },
},
});

if (!deal) throw AppError.notFound("Deal not found");

const participantIds = [deal.influencer.userId, deal.brand?.userId].filter(
Boolean,
) as string[];
if (!participantIds.includes(userId) && !isAdmin) {
throw AppError.forbidden("Unauthorized");
}

return {
isAdmin,
participantIds,
conversationKey: `deal:${params.dealId}`,
};
}

if (!params.with) throw AppError.badRequest("Invalid parameters");
if (params.with === userId) throw AppError.badRequest("Cannot message yourself");

const [existingMessageCount, sharedDeal] = await Promise.all([
prisma.message.count({
where: {
OR: [
{ senderId: userId, receiverId: params.with },
{ senderId: params.with, receiverId: userId },
],
},
}),
prisma.deal.findFirst({
where: {
OR: [
{ influencer: { userId }, brand: { userId: params.with } },
{ brand: { userId }, influencer: { userId: params.with } },
],
},
select: { id: true },
}),
]);

if (!isAdmin && existingMessageCount === 0 && !sharedDeal) {
throw AppError.badRequest("You can only message users you have a deal with");
}

return {
isAdmin,
participantIds: [userId, params.with],
conversationKey: conversationKeyForDirect(userId, params.with),
};
}

async function getTypingPresence(access: ConversationAccess, userId: string) {
const otherParticipantIds = access.participantIds.filter((id) => id !== userId);
if (otherParticipantIds.length === 0) return { isTyping: false, users: [] };

try {
const values = await Promise.all(
otherParticipantIds.map(async (participantId) => {
const value = await redis.get(typingKey(access.conversationKey, participantId));
return value ? participantId : null;
}),
);

const users = values.filter(Boolean) as string[];
return { isTyping: users.length > 0, users };
} catch {
return { isTyping: false, users: [] };
}
}

async function validateBasicAndRateLimits(userId: string, receiverId: string) {
  if (receiverId === userId) throw AppError.badRequest("Cannot message yourself");

  if (await BlockService.isBlocked(userId, receiverId)) {
    throw AppError.forbidden("You cannot message this user because a block relationship exists.");
  }

  // Enterprise-grade Redis sliding-window check for high concurrency rate-limiting
  const [minLimit, dayLimit] = await Promise.all([
    checkRateLimit(userId, "MESSAGES_MIN"),
    checkRateLimit(userId, "MESSAGES_DAY"),
  ]);

  if (!minLimit.success) {
    throw AppError.badRequest("You are sending messages too fast. Please wait a moment.");
  }
  if (!dayLimit.success) {
    throw AppError.badRequest("Daily message limit reached.");
  }

  await MessageService.validateSenderAndReceiver(userId, receiverId);
}

async function validateDealAccess(userId: string, receiverId: string, dealId?: string) {
  const { isAdmin: senderIsAdmin } = await getUserRole(userId);
  if (!senderIsAdmin) {
    if (dealId) {
      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: { status: true },
      });
      if (!deal || !ACTIVE_DEAL_STATUSES.includes(deal.status)) {
        throw AppError.badRequest("Cannot send messages because this deal is completed or cancelled.");
      }
    } else {
      const activeDeal = await prisma.deal.findFirst({
        where: {
          OR: [
            { influencer: { userId }, brand: { userId: receiverId } },
            { brand: { userId }, influencer: { userId: receiverId } },
          ],
          status: {
            in: ACTIVE_DEAL_STATUSES as DealStatus[],
          },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!activeDeal) {
        throw AppError.badRequest("Cannot send messages because there are no active deals between you and this user.");
      }
    }
  }
}

export class MessageService {
static async listMessages(
userId: string,
params: { dealId?: string; with?: string; page: number; limit: number },
) {
const access = await getConversationAccess(userId, params);

let whereClause: Prisma.MessageWhereInput;

if (params.dealId) {
if (access.participantIds.includes(userId)) {
await prisma.message.updateMany({
where: { dealId: params.dealId, receiverId: userId, isRead: false },
data: { isRead: true, readAt: new Date() },
});
}
whereClause = { dealId: params.dealId };
} else {
await prisma.message.updateMany({
where: { senderId: params.with!, receiverId: userId, isRead: false },
data: { isRead: true, readAt: new Date() },
});
whereClause = {
OR: [
{ senderId: userId, receiverId: params.with! },
{ senderId: params.with!, receiverId: userId },
],
};
}

const rawMessages = await prisma.message.findMany({
where: whereClause,
include: {
sender: {
select: SENDER_SELECT_PROJECTION,
},
},
orderBy: { createdAt: "asc" },
skip: (params.page - 1) * params.limit,
take: params.limit,
});

  const presence = await getTypingPresence(access, userId);

  let hasActiveDeal = true;
  if (!access.isAdmin) {
    if (params.dealId) {
      const deal = await prisma.deal.findUnique({
        where: { id: params.dealId },
        select: { status: true },
      });
      hasActiveDeal = Boolean(
        deal && ACTIVE_DEAL_STATUSES.includes(deal.status),
      );
    } else if (params.with) {
      const activeDeal = await prisma.deal.findFirst({
        where: {
          OR: [
            { influencer: { userId }, brand: { userId: params.with } },
            { brand: { userId }, influencer: { userId: params.with } },
          ],
          status: {
            in: ACTIVE_DEAL_STATUSES as DealStatus[],
          },
          deletedAt: null,
        },
        select: { id: true },
      });
      hasActiveDeal = Boolean(activeDeal);
    }
  }

  return {
    messages: rawMessages.map((message) =>
      redactMessage(message, access.isAdmin),
    ),
    ...(params.dealId ? { dealId: params.dealId } : {}),
    presence,
    hasActiveDeal,
  };
}

static async listConversations(userId: string, page: number, limit: number) {
const { isAdmin } = await getUserRole(userId);

// Safety cap to prevent memory bomb - fetch up to 1000 distinct partners max
// Pagination happens in JS after this, so we need enough for the requested page
const maxPartners = 1000;
const sent = await prisma.message.findMany({
where: { senderId: userId },
select: { receiverId: true },
distinct: ["receiverId"],
take: maxPartners,
});
const received = await prisma.message.findMany({
where: { receiverId: userId },
select: { senderId: true },
distinct: ["senderId"],
take: maxPartners,
});

const blocks = await prisma.userBlock.findMany({
where: {
OR: [
{ blockingUserId: userId },
{ blockedUserId: userId },
],
},
take: 200,
select: {
blockingUserId: true,
blockedUserId: true,
},
});

const blockedUserIds = new Set(
blocks.map((b) => (b.blockingUserId === userId ? b.blockedUserId : b.blockingUserId))
);

const allPartnerIds = Array.from(
new Set([
...sent.map((message) => message.receiverId),
...received.map((message) => message.senderId),
]),
).filter((partnerId) => !blockedUserIds.has(partnerId));

const total = allPartnerIds.length;
const pagePartnerIds = allPartnerIds.slice(
(page - 1) * limit,
page * limit,
);

if (pagePartnerIds.length === 0) {
return { conversations: [], total };
}

const users = await prisma.user.findMany({
where: { id: { in: pagePartnerIds } },
select: SENDER_SELECT_PROJECTION,
});
const userMap = new Map(users.map((user) => [user.id, user]));

// Batched query 1: latest message per partner
// Fetch all messages between this user and every partner on the current page
// in one query, ordered newest-first, then pick the first occurrence per
// partner in JS. Previously this was 1 findFirst N partners = N queries.
const allMessages = await prisma.message.findMany({
where: {
OR: pagePartnerIds.flatMap((contactId) => [
{ senderId: userId, receiverId: contactId },
{ senderId: contactId, receiverId: userId },
]),
},
orderBy: { createdAt: "desc" },
take: 500, // Safety cap: max 500 messages per conversation page
});

const latestMessageByPartner = new Map<string, typeof allMessages[0]>();
for (const msg of allMessages) {
const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
if (!latestMessageByPartner.has(partnerId)) {
latestMessageByPartner.set(partnerId, msg);
}
}

// Batched query 2: unread counts per partner
// groupBy returns one row per senderId one round-trip for all partners.
// Previously this was 1 count N partners = N queries.
const unreadGroups = await prisma.message.groupBy({
by: ["senderId"],
where: {
receiverId: userId,
senderId: { in: pagePartnerIds },
isRead: false,
},
_count: { _all: true },
});

const unreadByPartner = new Map<string, number>(
unreadGroups.map((g: { senderId: string; _count: { _all: number } }) => [g.senderId, g._count._all]),
);

// Assemble conversation objects
const presenceResults = await Promise.all(
pagePartnerIds.map((contactId) => {
const access: ConversationAccess = {
isAdmin,
participantIds: [userId, contactId],
conversationKey: conversationKeyForDirect(userId, contactId),
};
return getTypingPresence(access, userId).then((presence) => ({ contactId, presence }));
}),
);
const presenceByPartner = new Map(presenceResults.map(({ contactId, presence }) => [contactId, presence]));

const conversations = pagePartnerIds.map((contactId) => {
const latest = latestMessageByPartner.get(contactId) ?? null;
return {
userId: contactId,
user: userMap.get(contactId) || null,
latestMessage: latest ? redactMessage(latest, isAdmin) : null,
unreadCount: unreadByPartner.get(contactId) ?? 0,
presence: presenceByPartner.get(contactId),
};
});
const sortedConversations = [...conversations].sort(
(a, b) =>
(b.latestMessage?.createdAt.getTime() || 0) -
(a.latestMessage?.createdAt.getTime() || 0),
);

return { conversations: sortedConversations, total };
}

static async setTyping(
userId: string,
data: { dealId?: string; with?: string; isTyping: boolean },
) {
const access = await getConversationAccess(userId, data);
const key = typingKey(access.conversationKey, userId);

try {
if (data.isTyping) {
await redis.set(key, "1", "EX", TYPING_TTL_SECONDS);
} else {
await redis.del(key);
}
} catch {
return {
isTyping: false,
refreshAfterSeconds: TYPING_REFRESH_SECONDS,
};
}

return {
isTyping: data.isTyping,
refreshAfterSeconds: TYPING_REFRESH_SECONDS,
};
}

static async validateSenderAndReceiver(userId: string, receiverId: string): Promise<void> {
const receiver = await prisma.user.findUnique({
where: { id: receiverId },
select: { status: true },
});
    if (
      !receiver ||
      receiver.status === "BANNED" ||
      receiver.status === "SUSPENDED" ||
      receiver.status === "DELETED"
    ) {
      throw AppError.notFound("Recipient not found or unavailable");
    }

    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (!sender || sender.status === "BANNED" || sender.status === "SUSPENDED" || sender.status === "DELETED") {
      throw AppError.badRequest("Your account is restricted from sending messages");
    }
}

private static async applyContactFilterToContent(
  content: string,
  fileUrl: string | undefined,
): Promise<{ isBlocked: boolean; hasWarning: boolean; findings: string[] }> {
  const filterResult = checkMessageForContacts(content);
  let isBlocked = filterResult.hasContactInfo;
  let hasWarning = filterResult.hasContactInfo;

  if (fileUrl) {
    // 1. Filename check
    const fileFilter = checkAttachmentForContacts(fileUrl);
    if (fileFilter.hasContactInfo) {
      isBlocked = true;
      hasWarning = true;
      filterResult.findings.push(...fileFilter.findings);
    }

    // 2. Media contents OCR check (Image and Video)
    const lowerUrl = fileUrl.toLowerCase();
    const isMedia = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".mp4", ".webm", ".mov", ".qt"].some((ext) =>
      lowerUrl.endsWith(ext)
    ) || lowerUrl.includes("/uploads/chat/");

    if (isMedia) {
      try {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        
        let filePath = "";
        const filename = path.basename(fileUrl);
        
        if (fileUrl.startsWith("/uploads/")) {
          const relativeKey = fileUrl.replace(/^\/uploads\//, "");
          filePath = path.resolve(process.cwd(), "public", "uploads", relativeKey);
        } else {
          try {
            const urlObj = new URL(fileUrl);
            const pathname = decodeURIComponent(urlObj.pathname);
            const relativeKey = pathname.startsWith("/uploads/") ? pathname.replace(/^\/uploads\//, "") : pathname.replace(/^\//, "");
            filePath = path.resolve(process.cwd(), "public", "uploads", relativeKey);
          } catch {
            // Fallback if not a valid URL
          }
        }

        if (filePath) {
          const exists = await fs.access(filePath).then(() => true).catch(() => false);
          if (exists) {
            const isVideo = [".mp4", ".webm", ".mov", ".qt"].some((ext) => lowerUrl.endsWith(ext));
            if (isVideo) {
              // Video OCR is computationally heavy and must be run asynchronously via Cloud Video Intelligence
              // (e.g. AWS Rekognition / Google Video Intelligence). For synchronous chat blocks, we run
              // a simulated check using the filename keywords fallback.
              const { checkImageBufferForContacts } = await import("@/lib/contact-filter");
              const videoFilter = await checkImageBufferForContacts(Buffer.alloc(0), filename);
              if (videoFilter.hasContactInfo) {
                isBlocked = true;
                hasWarning = true;
                filterResult.findings.push(...videoFilter.findings.map(f => f.replace("image_", "video_")));
              }
            } else {
              const fileBuffer = await fs.readFile(filePath);
              const { checkImageBufferForContacts } = await import("@/lib/contact-filter");
              const imageFilter = await checkImageBufferForContacts(fileBuffer, filename);
              if (imageFilter.hasContactInfo) {
                isBlocked = true;
                hasWarning = true;
                filterResult.findings.push(...imageFilter.findings);
              }
            }
          }
        }
      } catch (err) {
        logger.error("OCR attachment check failed", err);
      }
    }
  }
  return { isBlocked, hasWarning, findings: filterResult.findings };
}

private static async notifyBlockedMessage(
userId: string,
receiverId: string,
messageId: string,
findings: string[],
): Promise<void> {
await NotificationService.createNotification({
userId,
type: "system_warning",
title: "Message Blocked",
message:
"Your message was blocked for containing contact details. Sharing contact details is not allowed before the contract starts.",
data: { messageId },
});

const adminUsers = await prisma.user.findMany({
where: { userType: "ADMIN", status: "ACTIVE" },
select: { id: true },
take: 20,
});
if (adminUsers.length > 0) {
await NotificationService.createNotifications(
adminUsers.map((admin) => ({
userId: admin.id,
type: "admin_alert",
title: "Contact Details Shared",
message: `User ${userId} attempted to share contact details with ${receiverId}.`,
data: {
type: "contact_violation",
senderId: userId,
receiverId,
messageId,
findings,
},
}))
);
}
}

static async sendMessage(
  userId: string,
  data: {
    dealId?: string;
    receiverId: string;
    content: string;
    messageType?: string;
    fileUrl?: string;
    metadata?: Record<string, unknown>;
  },
) {
  await validateBasicAndRateLimits(userId, data.receiverId);
  await validateDealAccess(userId, data.receiverId, data.dealId);

if (data.dealId) {
const access = await getConversationAccess(userId, { dealId: data.dealId });
if (!access.participantIds.includes(data.receiverId)) {
throw AppError.badRequest("Recipient is not part of this deal");
}
} else {
await getConversationAccess(userId, { with: data.receiverId });
}

const sanitizedContent = stripHtml(data.content || "");
const { isBlocked, hasWarning, findings } = await MessageService.applyContactFilterToContent(
  sanitizedContent,
  data.fileUrl,
);

const createData: Prisma.MessageUncheckedCreateInput = {
senderId: userId,
receiverId: data.receiverId,
content: sanitizedContent,
messageType: data.messageType || "TEXT",
isBlocked,
hasWarning,
};
if (data.dealId) {
createData.dealId = data.dealId;
}
if (data.fileUrl) {
createData.fileUrl = data.fileUrl;
}
const resolvedMetadata = data.metadata ||
(findings.length > 0
? { filterReason: findings }
: undefined);
if (resolvedMetadata !== undefined) {
createData.metadata = resolvedMetadata as Prisma.InputJsonValue;
}

const message = await prisma.message.create({
data: createData,
include: {
sender: {
select: SENDER_SELECT_PROJECTION,
},
},
});

await MessageService.setTyping(userId, {
...(data.dealId ? { dealId: data.dealId } : { with: data.receiverId }),
isTyping: false,
});

await NotificationService.createNotification({
userId: data.receiverId,
type: "new_message",
title: "New Message",
message: isBlocked
? "A message has been blocked by contact filtering rules."
: "You have a new message",
data: { senderId: userId, dealId: data.dealId, messageId: message.id },
});

if (isBlocked) {
await MessageService.notifyBlockedMessage(userId, data.receiverId, message.id, findings);
}

return message;
}
}
