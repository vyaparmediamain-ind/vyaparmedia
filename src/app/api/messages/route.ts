import { NextResponse } from "next/server";
import { apiWrapper, ValidatedNextRequest } from "@/lib/api-wrapper";
import { MessageService } from "@/services/message.service";
import { dbIdSchema, messageSchema } from "@/lib/validations";
import { checkRateLimit, checkTieredRateLimit } from "@/lib/rate-limit";
import { getSecureClientIp } from "@/lib/ip";
import { z } from "zod";
import { parsePagination } from "@/lib/utils";
import { assertKillSwitchInactive } from "@/lib/kill-switch";

const typingSchema = z
.object({
dealId: dbIdSchema.optional(),
with: dbIdSchema.optional(),
isTyping: z.boolean(),
})
.refine((value) => Boolean(value.dealId || value.with), {
message: "dealId or with is required",
});

export const GET = apiWrapper(async (req: ValidatedNextRequest) => {
const session = req.session;
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const { searchParams } = new URL(req.url);
const dealId = searchParams.get("dealId")?.trim();
const conversationWith = searchParams.get("with")?.trim();
const { page, limit } = parsePagination(searchParams, 50);

// List Conversations
if (!dealId && !conversationWith) {
const convPage = Math.max(
1,
Number.parseInt(searchParams.get("convPage") || "1", 10) || 1,
);
const result = await MessageService.listConversations(
session.user.id,
convPage,
50,
);
return NextResponse.json({
conversations: result.conversations,
pagination: {
page: convPage,
limit: 50,
total: result.total,
totalPages: Math.ceil(result.total / 50),
},
});
}

// List specific messages
const result = await MessageService.listMessages(session.user.id, {
...(dealId ? { dealId } : {}),
...(conversationWith ? { with: conversationWith } : {}),
page,
limit,
});

return NextResponse.json(result);
}, { requireAuth: true });

export const POST = apiWrapper(async (req: ValidatedNextRequest) => {
await assertKillSwitchInactive("killswitch:messaging");
const session = req.session;
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const clientIp = getSecureClientIp(req);
const sessionUser = session.user as { id: string; trustScore?: number; kycVerified?: boolean };

const limit = await checkTieredRateLimit({
  userId: sessionUser.id,
  ip: clientIp,
  action: "MESSAGES",
  trustScore: sessionUser.trustScore,
  isKycVerified: sessionUser.kycVerified,
});

if (!limit.success) {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil(limit.reset - Date.now() / 1000),
  );

  return NextResponse.json(
    {
      error: `Messaging rate limit exceeded (${limit.userLimit}/hr for your tier). Try again in ${retryAfterSeconds}s.`,
      blockedBy: limit.blockedBy,
    },
    { status: 429 },
  );
}

const body = await req.json();
const parsed = messageSchema.parse(body);

if (parsed.receiverId === session.user.id) {
return NextResponse.json(
{ error: "You cannot message yourself" },
{ status: 400 },
);
}

const message = await MessageService.sendMessage(session.user.id, {
receiverId: parsed.receiverId,
content: parsed.content,
...(parsed.dealId ? { dealId: parsed.dealId } : {}),
...(parsed.messageType ? { messageType: parsed.messageType } : {}),
...(parsed.fileUrl ? { fileUrl: parsed.fileUrl } : {}),
...(parsed.metadata ? { metadata: parsed.metadata } : {}),
});

return NextResponse.json({
success: true,
message,
});
});

export const PATCH = apiWrapper(async (req: ValidatedNextRequest) => {
const session = req.session;
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const limit = await checkRateLimit(session.user.id, "MESSAGES_MIN");
if (!limit.success) {
return NextResponse.json({ error: "Too many typing updates" }, { status: 429 });
}

const parsed = typingSchema.parse(await req.json());
const result = await MessageService.setTyping(session.user.id, {
...(parsed.dealId ? { dealId: parsed.dealId } : {}),
...(parsed.with ? { with: parsed.with } : {}),
isTyping: parsed.isTyping,
});

return NextResponse.json({ success: true, presence: result });
}, { requireAuth: true });
