import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiWrapper } from "@/lib/api-wrapper";
import { MessageService } from "@/services/message.service";
import { dbIdSchema, messageSchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { parsePagination } from "@/lib/utils";

const typingSchema = z
.object({
dealId: dbIdSchema.optional(),
with: dbIdSchema.optional(),
isTyping: z.boolean(),
})
.refine((value) => Boolean(value.dealId || value.with), {
message: "dealId or with is required",
});

export const GET = apiWrapper(async (req) => {
const session = await auth();
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

return NextResponse.json(result); // Returns { messages } or { messages, dealId }
});

export const POST = apiWrapper(async (req) => {
const session = await auth();
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const limit = await checkRateLimit(session.user.id, "MESSAGES");
if (!limit.success) {
const retryAfterSeconds = Math.max(
1,
Math.ceil(limit.reset - Date.now() / 1000),
);

return NextResponse.json(
{
error: `Rate limit exceeded. Try again in ${retryAfterSeconds}s.`,
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

export const PATCH = apiWrapper(async (req) => {
const session = await auth();
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
});
